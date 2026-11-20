# Client discovery is the subject of these skills, so they may name clients.
CLIENT_SKILLS := create-skill,project-docs,backlog-batches
# explainer-animation is here only while its prototypes/ tree and planning documents (which quote
# session paths containing the word) exist; SKILL.md and references/ already pass the full lint.
# Remove it from the list when those are deleted.
CLIENT_SKILLS := $(CLIENT_SKILLS),explainer-animation

.PHONY: check test validate

check: test validate ## Everything CI runs

test: ## Go and Node tests for the checkers
	go vet ./...
	go test ./...
	node --test scripts/*.test.mjs api-topology/scripts/*.test.mjs flow-map/scripts/*.test.mjs ui-sketch/scripts/*.test.mjs explainer-animation/scripts/*.test.mjs
	bash deterministic-tests/scripts/test-time-check.bash --self-test

validate: ## Lint every skill: frontmatter, size, links, client-neutral wording
	node scripts/validate-skills.mjs . --allow-client-terms=$(CLIENT_SKILLS)
