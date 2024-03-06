// This test implementation manages an SSM parameter identified by the given `Name` property and returns the `ParameterVersion` as a response value.
// Of course this does not make much sense, but it is a simple test case and suits as an example of how to use the `aws-cloudformation-custom-resource` package to manage custom resources.
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
  new CustomResource(
    event,
    context,
    callback,
    createResource,
    updateResource,
    deleteResource,
    logger,
  );
};

function createResource(resource: CustomResource): Promise<void> {
  return new Promise(function (resolve, reject) {
    const params: PutParameterCommandInput = {
      /* eslint-disable @typescript-eslint/naming-convention */
      Name: resource.event.ResourceProperties?.name,
      Value: resource.event.ResourceProperties?.value,
      Type: 'String',
      Overwrite: false,
      /* eslint-enable @typescript-eslint/naming-convention */
    };
    const putParameterCommand = new PutParameterCommand(params);
    ssmClient
      .send(putParameterCommand)
      .then((data) => {
        resource.addResponseValue('ParameterVersion', data.Version!.toString());
        resolve();
      })
      .catch((error) => {
        reject(error);
      });
  });
}

function updateResource(resource: CustomResource): Promise<void> {
  return new Promise(function (resolve, reject) {
    const params: PutParameterCommandInput = {
      /* eslint-disable @typescript-eslint/naming-convention */
      Name: resource.event.ResourceProperties?.name,
      Value: resource.event.ResourceProperties?.value,
      Type: 'String',
      Overwrite: true,
      /* eslint-enable @typescript-eslint/naming-convention */
    };
    const putParameterCommand = new PutParameterCommand(params);
    ssmClient
      .send(putParameterCommand)
      .then((data) => {
        resource.addResponseValue('ParameterVersion', data.Version!.toString());
        resolve();
      })
      .catch((error) => {
        reject(error);
      });
  });
}

function deleteResource(resource: CustomResource): Promise<void> {
  return new Promise(function (resolve, reject) {
    const params: DeleteParameterCommandInput = {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      Name: resource.event.ResourceProperties?.name,
    };
    const deleteParameterCommand = new DeleteParameterCommand(params);
    ssmClient
      .send(deleteParameterCommand)
      .then((_data) => {
        resolve();
      })
      .catch((error) => {
        reject(error);
      });
  });
}
