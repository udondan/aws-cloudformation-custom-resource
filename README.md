# aws-cloudformation-custom-resource

[![npm version](https://badge.fury.io/js/aws-cloudformation-custom-resource.svg)][npm]
[![npm](https://img.shields.io/npm/dt/aws-cloudformation-custom-resource)][npm]
[![License](https://img.shields.io/github/license/udondan/aws-cloudformation-custom-resource)][license]

Helper for managing custom AWS CloudFormation resources in a Lambda function.

## Usage

You can find a complete example in the [test](test) directory.

Basic usage:

```typescript
import { CustomResource, Event } from 'aws-cloudformation-custom-resource';
import { Callback, Context } from 'aws-lambda';

export const handler = function (
  event: Event,
  context: Context,
  callback: Callback,
) {
  new CustomResource(context, callback)
    .onCreate(createResource)
    .onUpdate(updateResource)
    .onDelete(deleteResource)
    .handle(event);
};

function createResource(event: Event): Promise<Event> {
  return new Promise(function (resolve, reject) {
    // Every custom resource requires a physical ID.
    // Either you can pass a `Name` parameter to the lambda function
    // or you can manually set the ID:
    event.setPhysicalResourceId('some-physical-resource-id');

    // you can return values from the Lambda function:
    event.addResponseValue('Foo', 'bar');

    // do stuff
    resolve(event);
  });
}

function updateResource(event: Event): Promise<Event> {
  return new Promise(function (resolve, reject) {
    event.addResponseValue('Foo', 'bar');

    // do stuff
    resolve(event);
  });
}

function deleteResource(event: Event): Promise<Event> {
  return new Promise(function (resolve, reject) {
    // do stuff
    resolve(event);
  });
}
```

[npm]: https://www.npmjs.com/package/aws-cloudformation-custom-resource
[license]: https://github.com/udondan/aws-cloudformation-custom-resource/blob/main/LICENSE
