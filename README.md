# aws-cloudformation-custom-resource

[![npm version](https://badge.fury.io/js/aws-cloudformation-custom-resource.svg)][npm]
[![npm](https://img.shields.io/npm/dt/aws-cloudformation-custom-resource)][npm]
[![License](https://img.shields.io/github/license/udondan/aws-cloudformation-custom-resource)][license]

Helper for managing custom AWS CloudFormation resources in a Lambda function.

## Usage

You can find a complete example in the [test](test) directory.

Basic usage:

```typescript
import {
  Callback,
  Context,
  CustomResource,
  Event,
  Logger,
} from 'aws-cloudformation-custom-resource';

export const handler = function (
  event: Event,
  context: Context,
  callback: Callback,
) {
  new CustomResource(
    event,
    context,
    callback,
    createResource,
    updateResource,
    deleteResource,
  );
};

function createResource(
  resource: CustomResource,
  logger: Logger,
): Promise<void> {
  return new Promise(function (resolve, reject) {
    logger.log('Hello from create');

    // Every custom resource requires a physical ID.
    // Either you can pass a `Name` parameter to the lambda function
    // or you can manually set the ID:
    resource.setPhysicalResourceId('some-physical-resource-id');

    // you can return values from the Lambda function:
    resource.addResponseValue('Foo', 'bar');

    // do stuff
    resolve();
  });
}

function updateResource(
  resource: CustomResource,
  logger: Logger,
): Promise<void> {
  logger.log('Hello from update');
  return new Promise(function (resolve, reject) {
    resource.addResponseValue('Foo', 'bar');

    // do stuff
    resolve();
  });
}

function deleteResource(
  resource: CustomResource,
  logger: Logger,
): Promise<void> {
  logger.log('Hello from delete');
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

new CustomResource(
  event,
  context,
  callback,
  createResource,
  updateResource,
  deleteResource,
  logger,
);
```

[npm]: https://www.npmjs.com/package/aws-cloudformation-custom-resource
[license]: https://github.com/udondan/aws-cloudformation-custom-resource/blob/main/LICENSE
