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
  Logger,
} from 'aws-cloudformation-custom-resource';

const region = 'us-east-1';
const ssmClient = new SSMClient({ region });
const logger = new StandardLogger(LogLevel.debug);

export interface ResourceProperties {
  /**
   * Name of the parameter
   *
   * This will automatically be used as the physical resource ID.
   *
   * If you your properties do not contain a `name`, you later need to manually set the physical resource ID using `resource.setPhysicalResourceId()`.
   */
  name: string;

  /** Value of the parameter */
  value: string;
}

export const handler = function (
  event: Event<ResourceProperties>,
  context: Context,
  callback: Callback,
) {
  const resource = new CustomResource<ResourceProperties>(
    event,
    context,
    callback,
    createResource,
    updateResource,
    deleteResource,
  );

  resource.setLogger(logger);
  resource.setNoEcho(true);

  logger.debug(
    `Physical resource ID: ${resource.getPhysicalResourceId() ?? 'undefined'}`,
  );
};

function createResource(
  resource: CustomResource<ResourceProperties>,
  log: Logger,
): Promise<void> {
  return new Promise(function (resolve, reject) {
    const params: PutParameterCommandInput = {
      /* eslint-disable @typescript-eslint/naming-convention */
      Name: resource.properties.name,
      Value: resource.properties.value,
      Type: 'String',
      Overwrite: false,
      /* eslint-enable @typescript-eslint/naming-convention */
    };
    const putParameterCommand = new PutParameterCommand(params);
    ssmClient
      .send(putParameterCommand)
      .then((data) => {
        log.info('Parameter created successfully.');
        resource.addResponseValue('ParameterVersion', data.Version!.toString());
        resolve();
      })
      .catch((error) => {
        reject(error);
      });
  });
}

function updateResource(
  resource: CustomResource<ResourceProperties>,
  log: Logger,
): Promise<void> {
  return new Promise(function (resolve, reject) {
    const params: PutParameterCommandInput = {
      /* eslint-disable @typescript-eslint/naming-convention */
      Name: resource.properties.name,
      Value: resource.properties.value,
      Type: 'String',
      Overwrite: true,
      /* eslint-enable @typescript-eslint/naming-convention */
    };
    const putParameterCommand = new PutParameterCommand(params);
    ssmClient
      .send(putParameterCommand)
      .then((data) => {
        log.info('Parameter updated successfully.');
        resource.addResponseValue('ParameterVersion', data.Version!.toString());
        resolve();
      })
      .catch((error) => {
        reject(error);
      });
  });
}

function deleteResource(
  resource: CustomResource<ResourceProperties>,
  log: Logger,
): Promise<void> {
  return new Promise(function (resolve, reject) {
    const params: DeleteParameterCommandInput = {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      Name: resource.properties.name,
    };
    const deleteParameterCommand = new DeleteParameterCommand(params);
    ssmClient
      .send(deleteParameterCommand)
      .then((_data) => {
        log.info('Parameter deleted successfully.');
        resolve();
      })
      .catch((error) => {
        reject(error);
      });
  });
}
