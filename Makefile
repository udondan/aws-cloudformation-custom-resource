SHELL := /bin/bash -euo pipefail
VERSION := $(shell cat VERSION)
.PHONY: test

tag:
	@git tag -a "v$(VERSION)" -m 'Creates tag "v$(VERSION)"'
	@git push --tags

untag:
	@git push --delete origin "v$(VERSION)"
	@git tag --delete "v$(VERSION)"

release: tag

re-release: untag tag

push:
	git commit -am testing
	git push

update: push re-release

install:
	@echo Installing library dependencies...
	@npm clean-install --prefer-offline --cache .npm

build:
	@echo Building library...
	@rm -rf dist
	@npx tsc

test:
	@\
	cd test && \
	$(MAKE) build && \
	$(MAKE) deploy && \
	$(MAKE) deploy && \
	version=$$(aws ssm get-parameter --name "TestResource1" --query "Parameter.Version" --output text) && \
	if [ "$${version}" -ne 2 ]; then \
		echo -e "\033[0;31mError: Unexpected version of parameter TestResource1 Got $${version} instead of 2.\033[0m" >&2; \
		$(MAKE) DESTROY; \
		exit 1; \
	fi && \
	$(MAKE) DESTROY

eslint:
	@echo "Running eslint $$(npx eslint --version)..."; \
	npx eslint .; \
	echo "Passed"