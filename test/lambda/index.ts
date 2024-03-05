// This test implementation manages an SSM parameter identified by the given `Name` property and returns the `ParameterVersion` as a response value.
// Of course this does not make much sense, but it is a simple test case suits as an example of how to use the `aws-cloudformation-custom-resource` package to create a custom resource.
import {
  DeleteParameterCommand,
  PutParameterCommand,
  SSMClient,
} from '@aws-sdk/client-ssm';
import {
  CustomResource,
  StandardLogger,
  LogLevel,
} from 'aws-cloudformation-custom-resource';

import type {
  DeleteParameterCommandInput,
  PutParameterCommandInput,
} from '@aws-sdk/client-ssm';
import type {
  Event,
  Callback,
  Context,
} from 'aws-cloudformation-custom-resource';

const region = 'us-east-1';
const ssmClient = new SSMClient({ region });
const logger = new StandardLogger(LogLevel.debug);

export const handler = function (
  event: Event,
  context: Context,
  callback: Callback,
) {
  new CustomResource(context, callback, logger)
    .onCreate(createResource)
    .onUpdate(updateResource)
    .onDelete(deleteResource)
    .handle(event);
};

function createResource(event: Event): Promise<Event> {
  return new Promise(function (resolve, reject) {
    const params: PutParameterCommandInput = {
      /* eslint-disable @typescript-eslint/naming-convention */
      Name: event.ResourceProperties?.name,
      Value: event.ResourceProperties?.value,
      Type: 'String',
      Overwrite: false,
      /* eslint-enable @typescript-eslint/naming-convention */
    };
    const putParameterCommand = new PutParameterCommand(params);
    ssmClient
      .send(putParameterCommand)
      .then((data) => {
        event.addResponseValue('ParameterVersion', data.Version!.toString());
        resolve(event);
      })
      .catch((error) => {
        reject(error);
      });
  });
}

function updateResource(event: Event): Promise<Event> {
  return new Promise(function (resolve, reject) {
    const params: PutParameterCommandInput = {
      /* eslint-disable @typescript-eslint/naming-convention */
      Name: event.ResourceProperties?.name,
      Value: event.ResourceProperties?.value,
      Type: 'String',
      Overwrite: true,
      /* eslint-enable @typescript-eslint/naming-convention */
    };
    const putParameterCommand = new PutParameterCommand(params);
    ssmClient
      .send(putParameterCommand)
      .then((data) => {
        event.addResponseValue('ParameterVersion', data.Version!.toString());
        resolve(event);
      })
      .catch((error) => {
        reject(error);
      });
  });
}

function deleteResource(event: Event): Promise<Event> {
  return new Promise(function (resolve, reject) {
    const params: DeleteParameterCommandInput = {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      Name: event.ResourceProperties?.name,
    };
    const deleteParameterCommand = new DeleteParameterCommand(params);
    ssmClient
      .send(deleteParameterCommand)
      .then((_data) => {
        resolve(event);
      })
      .catch((error) => {
        reject(error);
      });
  });
}
