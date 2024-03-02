SHELL := /bin/bash -euo pipefail

install:
	@echo Installing dependencies...
	@npm clean-install --prefer-offline --cache ../.npm

build: install
	@echo Building application...
	@npm run build

diff: build
	@echo Running diff...
	@AWS_REGION=us-east-1 npm run cdk -- diff

deploy: build
	@echo Deploying application...
	@AWS_REGION=us-east-1 npm run cdk -- deploy --require-approval never

DESTROY: build
	@echo Destroying application...
	@AWS_REGION=us-east-1 npm run cdk -- destroy --force
