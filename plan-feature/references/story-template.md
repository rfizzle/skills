# Story template

The fields are what `backlog-batches` reads from an item. Write it in the
tracker's own format.

```markdown
### S-124: ListExports returns the caller's exports (E-12)

- Status: drafted
- Layer: API contract
- Depends on: S-123
- Touches: proto/acme/exports/v1/exports.proto, internal/api/gen/, web/src/lib/api/gen/
- Overlaps: none

Acceptance criteria:
- [ ] `ExportService.ListExports` with `page_size`, `page_token`, `next_page_token`
- [ ] `TestListExports_PagesByToken` passes
- [ ] Deploys alone: the RPC is new; it answers `unimplemented` until S-125
```

In an OpenAPI project the story touches `api/openapi.yaml` and names the
operation (`GET /api/v1/exports`, answering 501 until the backend lands).

A story is filed `drafted`. Grooming (`groom`) adds a `Reference` section
holding the text form of its reference and the owner's acceptance, and
sets `Status: groomed <date>`; only a groomed story is launched.
