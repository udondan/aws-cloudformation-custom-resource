# aws-cloudformation-custom-resource

[![npm version](https://badge.fury.io/js/aws-cloudformation-custom-resource.svg)][npm]
[![npm](https://img.shields.io/npm/dt/aws-cloudformation-custom-resource)][npm]
[![License](https://img.shields.io/github/license/udondan/aws-cloudformation-custom-resource)][license]

Helper for managing custom AWS CloudFormation resources in a Lambda function.

## Usage

You can find a complete example in the [test](test) directory.

The use of generics is optional. If no `ResourceProperties` is passed to the `Event` and `CustomResource`, the default type is `Records<string, string>`.

Basic usage:

```typescript
import {
  Callback,
  Context,
  CustomResource,
  Event,
  Logger,
} from 'aws-cloudformation-custom-resource';

export interface ResourceProperties {
  name: string;
  value: string;
}

export const handler = function (
  event: Event<ResourceProperties>,
  context: Context,
  callback: Callback,
) {
  new CustomResource<ResourceProperties>(
    event,
    context,
    callback,
    createResource,
    updateResource,
    deleteResource,
  );
};

function createResource(
  resource: CustomResource<ResourceProperties>,
  log: Logger,
): Promise<void> {
  return new Promise(function (resolve, reject) {
    log.log('Hello from create');

    // Every custom resource requires a physical ID.
    // Either you can pass a `name` parameter to the lambda function
    // (accessed via `resource.event.ResourceProperties.name`)
    // or you can manually set the ID:
    resource.setPhysicalResourceId('some-physical-resource-id');

    // you can return values from the Lambda function:
    resource.addResponseValue('Foo', 'bar');

    // do stuff
    resolve();
  });
}

function updateResource(
  resource: CustomResource<ResourceProperties>,
  log: Logger,
): Promise<void> {
  log.log('Hello from update');
  return new Promise(function (resolve, reject) {
    resource.addResponseValue('Foo', 'bar');

    // do stuff
    resolve();
  });
}

function deleteResource(
  resource: CustomResource<ResourceProperties>,
  log: Logger,
): Promise<void> {
  log.log('Hello from delete');
  return new Promise(function (resolve, reject) {
    // do stuff
    resolve();
  });
}
```

By default only errors are logged. You can change the log level or use another logging library:

```typescript
import {
  Callback,
  Context,
  CustomResource,
  Event,
  LogLevel,
  StandardLogger,
} from 'aws-cloudformation-custom-resource';

const logger = new StandardLogger(LogLevel.debug);

const resource = new CustomResource(
  event,
  context,
  callback,
  createResource,
  updateResource,
  deleteResource,
);

resource.setLogger(logger);
```

[npm]: https://www.npmjs.com/package/aws-cloudformation-custom-resource
[license]: https://github.com/udondan/aws-cloudformation-custom-resource/blob/main/LICENSE
