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
	@npm i

build: install
	@echo Building library...
	@rm -rf dist
	@npx tsc

test:
	@\
	cd test && \
	$(MAKE) deploy DESTROY
