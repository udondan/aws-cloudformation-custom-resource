SHELL := /bin/bash -euo pipefail

NO_COLOR=\x1b[0m
TARGET_COLOR=\x1b[96m
ERROR_COLOR=\033[0;31m

PARAMETER_NAME=CustomResourceTestParameter

.PHONY: test

install:
	@echo -e "$(TARGET_COLOR)Running install$(NO_COLOR)"
	@npm clean-install --prefer-offline --cache .npm
	@npm list

build: install
	@echo -e "$(TARGET_COLOR)Running build$(NO_COLOR)"
	@npx tsc

test:
	@echo -e "$(TARGET_COLOR)Running test$(NO_COLOR)"
	@\
	cd test && \
	$(MAKE) build && \
	$(MAKE) deploy && \
	$(MAKE) deploy && \
	version=$$(aws ssm get-parameter --name "$(PARAMETER_NAME)" --query "Parameter.Version" --output text) && \
	if [ "$${version}" -ne 2 ]; then \
		echo -e "$(ERROR_COLOR)Error: Unexpected version of parameter $(PARAMETER_NAME) Got $${version} instead of 2.$(NO_COLOR)" >&2; \
		$(MAKE) DESTROY; \
		exit 1; \
	fi && \
	$(MAKE) DESTROY

publish: install
	@echo -e "$(TARGET_COLOR)Running publish$(NO_COLOR)"
	@npx tsc -p tsconfig.publish.json
	@npm publish --dry-run 2>&1 | tee publish_output.txt
	@if ! grep -q "src/index.js" publish_output.txt; then \
		echo "❌ src/index.js is NOT included in the package"; \
		exit 1; \
	fi
	@if ! grep -q "src/index.d.ts" publish_output.txt; then \
		echo "❌ src/index.d.ts is NOT included in the package"; \
		exit 1; \
	fi
	@file_count=$$(grep -o "npm notice total files:   [0-9]+" publish_output.txt | awk '{print $$NF}'); \
	if [[ "$${file_count}" -ne 5 ]]; then \
		echo "❌ Package does not contain exactly 6 files"; \
		exit 1; \
	fi
	@rm publish_output.txt
	@if [[ "$${GITHUB_EVENT}" != "pull_request" ]]; then \
		npm publish; \
	fi

eslint:
	@echo -e "$(TARGET_COLOR)Running eslint $$(npx eslint --version)$(NO_COLOR)"
	@npx eslint .; \
	echo "Passed"
