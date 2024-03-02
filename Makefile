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
	@npm clean-install

build: install
	@echo Building library...
	@rm -r dist
	@npx tsc

test:
	@\
	cd test && \
	$(MAKE) deploy && \
	$(MAKE) deploy && \
	version=$$(aws ssm get-parameter --name "TestResource1" --query "Parameter.Version" --output text) && \
	if [ "$$version" -ne 2 ]; then \
		echo "Error: Version is not 2." >&2; \
		$(MAKE) DESTROY; \
		exit 1; \
	fi && \
	$(MAKE) DESTROY
