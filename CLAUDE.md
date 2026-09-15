# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

`aws-cloudformation-custom-resource` is a small npm library that helps Lambda functions implement CloudFormation custom resources. All library code is in `src/index.ts`. It has no runtime dependencies and uses only Node's `https` module.

## Commands

The Makefile is the entry point. `npm run build` just calls `make build`.

- `make install`: `npm clean-install` using the local `.npm` cache
- `make build`: install, delete all emitted `*.js`/`*.d.ts` outside `node_modules`, then run `npx tsc`
- `make eslint`: run `npx eslint .` (type-checked rules plus Prettier, see `eslint.config.mjs`)
- `make test`: **integration test against real AWS** (needs credentials, region `us-east-1`). It installs nothing itself, so run `make install` and `cd test && make install` first. It builds the CDK app in `test/`, deploys it twice, checks that the SSM parameter `CustomResourceTestParameter` is at version 2 (the second deploy must run the Update path), then destroys the stack.
- `make publish`: compile with `tsconfig.publish.json`, run `npm publish --dry-run`, and assert the package contains exactly 5 files, including `src/index.js` and `src/index.d.ts`. It only really publishes when `GITHUB_EVENT` is set and isn't `pull_request`.
- `cd test && make diff|deploy|DESTROY`: individual CDK steps

There are no unit tests and no way to run a single test. Validation is lint, `tsc`, and the AWS deploy cycle. CI (`.github/workflows/test.yml`) runs install, `make eslint`, `make test`, then `make publish` on PRs.

## Build output

`tsc` has no `outDir`. `.js` and `.d.ts` files are written next to the `.ts` sources and are gitignored. `package.json` `main`/`types` point to `src/index.js`/`src/index.d.ts`. `.npmignore` ignores everything except `*.js`/`*.d.ts` and excludes `test`. **Adding another source file to the package changes the file count and breaks the `make publish` check** (the Makefile expects exactly 5 files).

## Architecture (`src/index.ts`)

- `CustomResource<ResourceProperties>` takes the Lambda `event`, `context`, an optional `callback`, and the create/update/delete handlers (`HandlerFunction`, which returns `Promise<void>`). The constructor overloads are told apart by argument count: 5 arguments means an async handler, 6 means the callback style. The Lambda Node.js 24 runtime removed callback handlers, so async handlers `return resource.done()`, a promise that settles once the response is sent. **The constructor calls `handle()` from a `setTimeout`**, so callers can run `setLogger()`, `setNoEcho()`, etc. synchronously right after constructing it.
- `handle()` picks the handler from `event.RequestType`, starts a timeout timer that sends `FAILED` 1s before `context.getRemainingTimeInMillis()` runs out, and on resolve/reject calls `sendResponse()`. That function clears the timer, PUTs the JSON response to `event.ResponseURL` via `https`, then resolves `done()` and calls the callback if there is one. `done()` also resolves after a `FAILED` response and only rejects if the response can't be sent.
- The physical resource ID falls back in this order: explicit `setPhysicalResourceId()` (seeded from `event.PhysicalResourceId`), then `ResourceProperties.name`, then `context.logStreamName`.
- `resource.properties` is a two-level `Proxy` over `event.ResourceProperties`. Each property exposes `.value`, `.before` (from `OldResourceProperties`), and `.changed` (a `JSON.stringify` comparison).
- Response values (`addResponseValue`) are string-only on purpose, because CloudFormation turns everything into strings.
- Logging goes through the `Logger` interface. `StandardLogger` defaults to `LogLevel.warn`, and users can plug in their own logger.
- `Event`, `Context`, and `Callback` types are defined locally, not imported from `@types/aws-lambda`.

## Test app (`test/`)

A separate npm project with its own `package.json`/lockfile and its own `Makefile`. It depends on the library through `"aws-cloudformation-custom-resource": "file:.."`. `test/lambda/index.ts` is a full usage example (an SSM parameter custom resource with tags, bundled by `NodejsFunction`/esbuild). `test/lib/parameter.ts` is the CDK construct that wires it up. The README points to this directory as the reference example, so keep it in sync with API changes.

## Conventions

- Commits and PR titles must follow Conventional Commits (enforced on PR titles by CI). Releases are automated with release-please (`CHANGELOG.md`, `.release-please-manifest.json`), so don't bump versions by hand.
- ESLint enforces `@typescript-eslint/naming-convention`. AWS/CloudFormation PascalCase keys are wrapped in `/* eslint-disable @typescript-eslint/naming-convention */` blocks. Unused variables must start with `_`. Use template literals instead of string concatenation (`prefer-template`).
- Dependencies are updated by Renovate. `renovate.json` overrides `ignorePaths` (the `config:recommended` default skips `**/test/**`) and turns off the PR concurrency limit, so the `test/` app gets updates too.
- Actions maintained by GitHub (`actions/*`) are referenced by major version. All other actions are pinned to an exact version tag.
