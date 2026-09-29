# Changelog

## [5.1.1](https://github.com/udondan/aws-cloudformation-custom-resource/compare/v5.1.0...v5.1.1) (2026-09-29)


### Dependencies

* **deps:** update dependency @aws-sdk/client-ssm to v3.1142.0 ([#339](https://github.com/udondan/aws-cloudformation-custom-resource/issues/339)) ([cfd08b4](https://github.com/udondan/aws-cloudformation-custom-resource/commit/cfd08b4f1e0ef7c2c3c25dd762fe70f2f73c9649))
* **deps:** update dependency @types/node to v24.19.0 ([#340](https://github.com/udondan/aws-cloudformation-custom-resource/issues/340)) ([7fefad4](https://github.com/udondan/aws-cloudformation-custom-resource/commit/7fefad47eb56641db365e246b4585568975bfd54))
* **deps:** update dependency aws-cdk to v2.1143.0 ([#341](https://github.com/udondan/aws-cloudformation-custom-resource/issues/341)) ([e5f3ad4](https://github.com/udondan/aws-cloudformation-custom-resource/commit/e5f3ad42f32e7b8d74915da68c458321dc9f7338))
* **deps:** update dependency aws-cdk-lib to v2.271.0 ([#342](https://github.com/udondan/aws-cloudformation-custom-resource/issues/342)) ([9b04c05](https://github.com/udondan/aws-cloudformation-custom-resource/commit/9b04c0574ac04d704aa3f2050d35b21048c672af))
* **deps:** update dependency esbuild to v0.28.2 ([#344](https://github.com/udondan/aws-cloudformation-custom-resource/issues/344)) ([20bdebb](https://github.com/udondan/aws-cloudformation-custom-resource/commit/20bdebb05ae3df912db7fb007bd1eab90b8af8f7))
* **deps:** update dependency eslint to v10.11.0 ([#345](https://github.com/udondan/aws-cloudformation-custom-resource/issues/345)) ([c7922dc](https://github.com/udondan/aws-cloudformation-custom-resource/commit/c7922dcebce552e91f60e38ff027ce757e01af2c))
* **deps:** update dependency prettier to v3.9.9 ([#336](https://github.com/udondan/aws-cloudformation-custom-resource/issues/336)) ([d9513da](https://github.com/udondan/aws-cloudformation-custom-resource/commit/d9513dabbb5571f9c78a5a9a298203c229615ce2))
* **deps:** update dependency typescript to v5.9.3 ([#346](https://github.com/udondan/aws-cloudformation-custom-resource/issues/346)) ([1617922](https://github.com/udondan/aws-cloudformation-custom-resource/commit/16179220088a4a6d79b9a881e0a25801f1a9bcdc))
* **deps:** update dependency typescript-eslint to v8.70.1 ([#337](https://github.com/udondan/aws-cloudformation-custom-resource/issues/337)) ([3367dd5](https://github.com/udondan/aws-cloudformation-custom-resource/commit/3367dd5c3aca46d9d21b9a5d23745cf3e0a8dd58))
* **deps:** update dependency typescript-eslint to v8.71.0 ([#347](https://github.com/udondan/aws-cloudformation-custom-resource/issues/347)) ([b25de37](https://github.com/udondan/aws-cloudformation-custom-resource/commit/b25de3757c7ff554b2d97f78bf5b845acc3ab09f))
* **deps:** update swc monorepo ([#349](https://github.com/udondan/aws-cloudformation-custom-resource/issues/349)) ([5f0f25b](https://github.com/udondan/aws-cloudformation-custom-resource/commit/5f0f25bb156a4e6b3255fa9575dee94a70cfee07))

## [5.1.0](https://github.com/udondan/aws-cloudformation-custom-resource/compare/v5.0.0...v5.1.0) (2026-09-16)


### Features

* support Node.js 24 (async Lambda handlers), modernize CI and fix renovate config ([#331](https://github.com/udondan/aws-cloudformation-custom-resource/issues/331)) ([178fee3](https://github.com/udondan/aws-cloudformation-custom-resource/commit/178fee30fd08c042268cdc35ecfd2633f01970cb))

## [5.0.0](https://github.com/udondan/aws-cloudformation-custom-resource/compare/v4.2.0...v5.0.0) (2024-03-15)


### ⚠ BREAKING CHANGES

* implements proxy to easily get the changed state and previous value in update requests ([#41](https://github.com/udondan/aws-cloudformation-custom-resource/issues/41))

### Features

* implements proxy to easily get the changed state and previous value in update requests ([#41](https://github.com/udondan/aws-cloudformation-custom-resource/issues/41)) ([26fdf79](https://github.com/udondan/aws-cloudformation-custom-resource/commit/26fdf793ab4ef24cbfbefe35b683980f1bc4efe2))

## [4.2.0](https://github.com/udondan/aws-cloudformation-custom-resource/compare/v4.1.0...v4.2.0) (2024-03-08)


### Features

* for convenience, expose event.ResourceProperties as resource.properties ([#32](https://github.com/udondan/aws-cloudformation-custom-resource/issues/32)) ([006aaf6](https://github.com/udondan/aws-cloudformation-custom-resource/commit/006aaf6292c0557db9596a36fb9a0d24032639f5))

## [4.1.0](https://github.com/udondan/aws-cloudformation-custom-resource/compare/v4.0.0...v4.1.0) (2024-03-07)


### Features

* CustomResource now accepts a generic type describing resource properties ([#30](https://github.com/udondan/aws-cloudformation-custom-resource/issues/30)) ([2461169](https://github.com/udondan/aws-cloudformation-custom-resource/commit/246116959578efbbacab14cf4aaf709287058636))

## [4.0.0](https://github.com/udondan/aws-cloudformation-custom-resource/compare/v3.1.1...v4.0.0) (2024-03-06)


### ⚠ BREAKING CHANGES

* complete refactor to streamline API ([#23](https://github.com/udondan/aws-cloudformation-custom-resource/issues/23))
* integrate ESLint with naming-convention rules ([#12](https://github.com/udondan/aws-cloudformation-custom-resource/issues/12))

### Features

* implements noEcho feature, so secrets can be masked ([#28](https://github.com/udondan/aws-cloudformation-custom-resource/issues/28)) ([f446af7](https://github.com/udondan/aws-cloudformation-custom-resource/commit/f446af74de463c348fbf7bad3fdd62285919232a))


### Bug Fixes

* fix usage of log level enum ([#19](https://github.com/udondan/aws-cloudformation-custom-resource/issues/19)) ([eeabeae](https://github.com/udondan/aws-cloudformation-custom-resource/commit/eeabeaec29723cfadbfbfb75b355ba913961edb4))


### Code Refactoring

* complete refactor to streamline API ([#23](https://github.com/udondan/aws-cloudformation-custom-resource/issues/23)) ([022592b](https://github.com/udondan/aws-cloudformation-custom-resource/commit/022592bf1efd18520db5c2b4d2a653ab9d5f5924))
* integrate ESLint with naming-convention rules ([#12](https://github.com/udondan/aws-cloudformation-custom-resource/issues/12)) ([6ece2b6](https://github.com/udondan/aws-cloudformation-custom-resource/commit/6ece2b66e984935b9f95d644becd6ad257d38ad5))
