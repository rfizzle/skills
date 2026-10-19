# Agent Skills specification (condensed)

Full source: https://agentskills.io/specification

## Directory structure

```
skill-name/
├── SKILL.md          # Required: metadata + instructions
├── scripts/           # Optional: executable code
├── references/        # Optional: documentation, loaded on demand
├── assets/             # Optional: templates, resources
└── ...                 # Any additional files or directories
```

## SKILL.md frontmatter fields

| Field           | Required | Constraints |
|-----------------|----------|--------------|
| `name`          | Yes | Max 64 chars. Lowercase letters, numbers, hyphens only. No leading/trailing hyphen. No consecutive hyphens. Must match the parent directory name. |
| `description`   | Yes | Max 1024 chars, non-empty. Describes what the skill does AND when to use it. |
| `license`       | No | License name or reference to a bundled license file. |
| `compatibility` | No | Max 500 chars. Environment requirements (product, system packages, network access). Most skills don't need this. |
| `metadata`      | No | Arbitrary string-to-string map for client-specific extensions. Use reasonably unique keys. |
| `allowed-tools` | No | Space-separated string of pre-approved tools, e.g. `Bash(git:*) Bash(jq:*) Read`. Experimental — support varies by client. |

### `name` validity examples

Valid: `pdf-processing`, `data-analysis`, `code-review`
Invalid: `PDF-Processing` (uppercase), `-pdf` (leading hyphen), `pdf--processing` (consecutive hyphens)

### `description` quality

Good: "Extracts text and tables from PDF files, fills PDF forms, and merges multiple PDFs. Use when working with PDF documents or when the user mentions PDFs, forms, or document extraction."

Poor: "Helps with PDFs."

See `description-writing.md` for the full methodology.

## Body content

Markdown after the frontmatter, no format restrictions. Recommended: step-by-step instructions, input/output examples, common edge cases. The whole file loads once the skill activates, so split long content into `references/` files.

## Optional directories

- **`scripts/`** — executable code the agent can run. Self-contained or clearly documented deps; helpful error messages; handle edge cases.
- **`references/`** — additional docs loaded on demand (`REFERENCE.md`, domain-specific files). Keep individual files focused/small.
- **`assets/`** — static resources: templates, images, data files, schemas.

## Progressive disclosure (why structure matters)

1. **Metadata** (~100 tokens): `name` + `description` loaded for every skill at startup.
2. **Instructions** (<5000 tokens recommended): full `SKILL.md` body loaded only on activation.
3. **Resources**: files in `scripts/`, `references/`, `assets/` loaded only as needed.

Keep `SKILL.md` under 500 lines. Move detail elsewhere.

## File references

Use relative paths from the skill root. Keep references one level deep from `SKILL.md` — avoid deeply nested reference chains.

## Validation

Reference implementation: https://github.com/agentskills/agentskills/tree/main/skills-ref

```bash
skills-ref validate ./my-skill
```
