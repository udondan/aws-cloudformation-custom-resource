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
