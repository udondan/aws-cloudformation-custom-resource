# Changelog

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
