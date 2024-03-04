SHELL := /bin/bash -euo pipefail

NO_COLOR=\x1b[0m
TARGET_COLOR=\x1b[96m

.PHONY: test

install:
	@echo -e "$(TARGET_COLOR)Running install$(NO_COLOR)"
	@npm clean-install --prefer-offline --cache .npm
	@npm list

build: install
	@echo -e "$(TARGET_COLOR)Running build$(NO_COLOR)"
	@rm -r dist
	@npx tsc

test:
	@echo -e "$(TARGET_COLOR)Running test...$(NO_COLOR)"
	@\
	cd test && \
	$(MAKE) build && \
	$(MAKE) deploy && \
	$(MAKE) deploy && \
	version=$$(aws ssm get-parameter --name "TestResource1" --query "Parameter.Version" --output text) && \
	if [ "$$version" -ne 2 ]; then \
		echo "Error: Version is not 2." >&2; \
		$(MAKE) DESTROY; \
		exit 1; \
	fi && \
	$(MAKE) DESTROY

publish: install
	@echo -e "$(TARGET_COLOR)Running publish$(NO_COLOR)"
	@npx tsc -p tsconfig.publish.json
	@npm publish --dry-run 2>&1 | tee publish_output.txt
	@if ! grep -q "dist/index.js" publish_output.txt; then \
		echo "❌ dist/index.js is NOT included in the package"; \
		exit 1; \
	fi
	@if ! grep -q "dist/index.d.ts" publish_output.txt; then \
		echo "❌ dist/index.d.ts is NOT included in the package"; \
		exit 1; \
	fi
	@rm publish_output.txt
	@if [[ "$${GITHUB_EVENT}" != "pull_request" ]]; then \
		npm publish; \
	fi
