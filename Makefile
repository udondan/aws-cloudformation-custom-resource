SHELL := /bin/bash -euo pipefail

.PHONY: test

push:
	git commit -am testing
	git push

update: push re-release

install:
	@echo Installing library dependencies...
	@npm clean-install --prefer-offline --cache .npm

build: install
	@echo Building library...
	@rm -r dist
	@npx tsc

test:
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
	@echo Publishing library...
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
	@if [ -z "$${NODE_AUTH_TOKEN}" ]; then \
		echo "⚠️ NODE_AUTH_TOKEN is not set. Skipping publish"; \
	else \
		if [[ "${{ github.event_name }}" != "pull_request" ]]; then
			npm publish
		else
			npm publish --dry-run
		fi
	fi
