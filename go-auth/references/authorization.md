# Principal and authorization

## Contents

- [The principal](#the-principal)
- [Roles and permissions](#roles-and-permissions)
- [A Can function](#a-can-function)
- [The tenant-filtered repository](#the-tenant-filtered-repository)
- [Mapping errors](#mapping-errors)
- [Required tests](#required-tests)

## The principal

`internal/domain` is a leaf (`go-project-layout`), so every module and the
auth middleware can import it.

```go
type AuthMethod int

const (
	AuthNone AuthMethod = iota // the zero value: anonymous
	AuthSession
	AuthAPIKey
)

// Principal is who is calling. Its zero value is the anonymous principal,
// so a request that never passed the auth middleware is refused, not admitted.
type Principal struct {
	Via      AuthMethod
	UserID   UserID
	TenantID TenantID
	Role     Role
	KeyID    string     // API keys only; the rate-limit key
	Scopes   Permission // API keys only
}

func (p Principal) Authenticated() bool { return p.Via != AuthNone }

// Has reports whether p holds every permission in perm.
func (p Principal) Has(perm Permission) bool {
	granted := rolePermissions[p.Role]
	if p.Via == AuthAPIKey {
		granted &= p.Scopes
	}
	return p.Authenticated() && granted&perm == perm
}

type principalKey struct{}

func WithPrincipal(ctx context.Context, p Principal) context.Context {
	return context.WithValue(ctx, principalKey{}, p)
}

// CurrentUser never returns nil and never panics: no principal is anonymous.
func CurrentUser(ctx context.Context) Principal {
	p, _ := ctx.Value(principalKey{}).(Principal)
	return p
}

var (
	ErrUnauthenticated = errors.New("unauthenticated")
	ErrForbidden       = errors.New("forbidden")
)
```

Only the auth middleware and tests call `WithPrincipal`. A background job
acting for a user builds its principal from the job's stored user and
tenant, through the same `WithPrincipal`, so the module's checks still run.

## Roles and permissions

```go
type Role int

const (
	RoleNone Role = iota // the zero value grants nothing
	RoleViewer
	RoleMember
	RoleAdmin
)

type Permission uint64

const (
	PermProjectRead Permission = 1 << iota
	PermProjectEdit
	PermMembersManage
)

var rolePermissions = map[Role]Permission{
	RoleViewer: PermProjectRead,
	RoleMember: PermProjectRead | PermProjectEdit,
	RoleAdmin:  PermProjectRead | PermProjectEdit | PermMembersManage,
}
```

The role is a column on the user (or on the membership row when a user
belongs to several tenants); it is stored as text (`viewer`, `member`,
`admin`) and parsed into the enum at the repository edge, so reordering
the constants never changes data. Adding a permission is a code change
reviewed like any other; there is no admin-editable permission table
unless the owner asks for one.

## A Can function

```go
// internal/modules/projects/authz.go

// CanEditProject is the one place that decides who may edit a project.
// Every exported method that changes a project calls it first.
func (s *Service) CanEditProject(ctx context.Context, id domain.ProjectID) (domain.Principal, error) {
	p := domain.CurrentUser(ctx)
	if !p.Authenticated() {
		return p, domain.ErrUnauthenticated
	}
	owner, err := s.repo.OwnerOf(ctx, p.TenantID, id) // not found for another tenant's project
	if err != nil {
		return p, err
	}
	if owner != p.UserID && !p.Has(domain.PermProjectEdit) {
		return p, domain.ErrForbidden
	}
	return p, nil
}

func (s *Service) Rename(ctx context.Context, id domain.ProjectID, name string) error {
	p, err := s.CanEditProject(ctx, id)
	if err != nil {
		return err
	}
	return s.repo.Rename(ctx, p.TenantID, id, name)
}
```

The function returns the principal so the caller uses the same tenant it
checked. The controller may call `Can...` only to build a capability hint
for the UI ("show the edit button"); the module never relies on it.

## The tenant-filtered repository

```go
// The tenant is a parameter, never read from the context inside the
// repository: context values are not arguments (golang-context).
func (r *Repository) Rename(ctx context.Context, tenant domain.TenantID, id domain.ProjectID, name string) error {
	tag, err := r.db.Exec(ctx,
		`UPDATE projects SET name = $3, updated_at = now() WHERE tenant_id = $1 AND id = $2`,
		tenant, id, name)
	if err != nil {
		return fmt.Errorf("renaming project: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return domain.ErrNotFound
	}
	return nil
}
```

Every query on a tenant-owned table has `tenant_id = $1`; every such table
has the column and an index that starts with it. A single-tenant app uses
the owning user as the tenant. A review that finds a query without the
filter treats it as a vulnerability, not a style issue.

## Mapping errors

| Module error | HTTP (OpenAPI) | Connect |
|---|---|---|
| `domain.ErrUnauthenticated` | 401 Problem | `CodeUnauthenticated` |
| `domain.ErrForbidden` | 403 Problem | `CodePermissionDenied` |
| `domain.ErrNotFound` (including another tenant's id) | 404 Problem | `CodeNotFound` |
| lockout or limit | 429 with `Retry-After` | `CodeResourceExhausted` |

## Required tests

| Case | Expect |
|---|---|
| No principal in the context | `ErrUnauthenticated`, and no repository call |
| Another tenant's id | `ErrNotFound` |
| A role without the permission | `ErrForbidden` |
| An API key whose scopes lack the permission, owner has it | `ErrForbidden` |
| Session idle past the limit, and past the absolute limit | anonymous, cookie cleared |
| The pre-sign-in session id after `Start` | anonymous |
| The eleventh failed sign-in in the window | 429 with `Retry-After`, even with the right password |
| Unsafe method, session cookie, no required header | 403 |
| Unsafe method with `Sec-Fetch-Site: cross-site` | 403 |
| A reset token used twice, or after 30 minutes | the generic expired answer |

Module tests set the principal with `domain.WithPrincipal` and use a fake
repository; the session and CSRF cases run through the real middleware
with `httptest` and a real database behind the integration tag
(`golang-database`).
