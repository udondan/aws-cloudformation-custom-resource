# aws-cloudformation-custom-resource

Helper for managing custom AWS CloudFormation resources in a Lambda function.

## Usage

```typescript
import { CustomResource, Event, StandardLogger } from 'aws-cloudformation-custom-resource';
import { Callback, Context } from 'aws-lambda';
import AWS = require('aws-sdk');

export const handler = function (event: Event = {}, context: Context, callback: Callback) {
    new CustomResource(event, context, callback)
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
