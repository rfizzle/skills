# Client discovery is the subject of these skills, so they may name clients.
CLIENT_SKILLS := create-skill,project-docs,backlog-batches

.PHONY: check test validate

check: test validate ## Everything CI runs

test: ## Go and Node tests for the checkers
	go vet ./...
	go test ./...
	node --test scripts/*.test.mjs

validate: ## Lint every skill: frontmatter, size, links, client-neutral wording
	node scripts/validate-skills.mjs . --allow-client-terms=$(CLIENT_SKILLS)
