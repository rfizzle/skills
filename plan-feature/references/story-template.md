# Story template

The fields are what `backlog-batches` reads from an item. Write it in the
tracker's own format.

```markdown
### S-124: List endpoint returns exports for the caller (E-12)

- Layer: API contract
- Depends on: S-123
- Touches: api/openapi.yaml, internal/api/gen/
- Overlaps: none

Acceptance criteria:
- [ ] `GET /api/v1/exports` with `cursor`, `limit`, `nextCursor`
- [ ] `TestListExports_PagesByCursor` passes
- [ ] Deploys alone: the operation is new; the handler returns 501 until S-125
```
