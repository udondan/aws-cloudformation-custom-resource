SHELL := /bin/bash -euo pipefail

NO_COLOR=\x1b[0m
TARGET_COLOR=\x1b[96m

install:
	@echo -e "$(TARGET_COLOR)Running install$(NO_COLOR)"
	@cd .. && bun install --frozen-lockfile

build:
	@echo -e "$(TARGET_COLOR)Running build$(NO_COLOR)"
	@bun run build

diff:
	@echo -e "$(TARGET_COLOR)Running diff$(NO_COLOR)"
	@AWS_REGION=us-east-1 bun run cdk diff --color

deploy:
	@echo -e "$(TARGET_COLOR)Running deploy$(NO_COLOR)"
	@AWS_REGION=us-east-1 bun run cdk deploy --color --require-approval never

DESTROY:
	@echo -e "$(TARGET_COLOR)Running DESTROY$(NO_COLOR)"
	@AWS_REGION=us-east-1 bun run cdk destroy --color --force
