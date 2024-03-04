SHELL := /bin/bash -euo pipefail

install:
	@echo Installing dependencies...
	@npm clean-install --prefer-offline --cache ../.npm

build:
	@echo Building application...
	@npm run build

diff:
	@echo Running diff...
	@AWS_REGION=us-east-1 npm run cdk -- diff --color

deploy:
	@echo Deploying application...
	@AWS_REGION=us-east-1 npm run cdk -- deploy --color --require-approval never

DESTROY:
	@echo Destroying application...
	@AWS_REGION=us-east-1 npm run cdk -- destroy  --color --force
