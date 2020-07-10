# aws-cloudformation-custom-resource

[![npm version](https://badge.fury.io/js/aws-cloudformation-custom-resource.svg)][npm]
[![npm](https://img.shields.io/npm/dt/aws-cloudformation-custom-resource)][npm]
[![Vulnerabilities](https://img.shields.io/snyk/vulnerabilities/npm/aws-cloudformation-custom-resource)][npm]
[![License](https://img.shields.io/github/license/udondan/aws-cloudformation-custom-resource)][license]

Helper for managing custom AWS CloudFormation resources in a Lambda function.

## Usage

```typescript
import { CustomResource, Event, StandardLogger } from 'aws-cloudformation-custom-resource';
import { Callback, Context } from 'aws-lambda';
import AWS = require('aws-sdk');

export const handler = function (event: Event, context: Context, callback: Callback) {
    new CustomResource(context, callback)
        .onCreate(Create)
        .onUpdate(Update)
        .onDelete(Delete)
        .handle(event);
};

function Create(event: Event): Promise<Event | AWS.AWSError> {
    return new Promise(function (resolve, reject) {
        // do stuff
        resolve(event)
    });
}

function Update(event: Event): Promise<Event | AWS.AWSError> {
    return new Promise(function (resolve, reject) {
        // do stuff
        resolve(event)
    });
}

function Delete(event: Event): Promise<Event | AWS.AWSError> {
    return new Promise(function (resolve, reject) {
        // do stuff
        resolve(event)
    });
}
```

   [npm]: https://www.npmjs.com/package/aws-cloudformation-custom-resource
   [license]: https://github.com/udondan/aws-cloudformation-custom-resource/blob/master/LICENSE
