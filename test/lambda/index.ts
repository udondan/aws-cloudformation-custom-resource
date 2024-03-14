// This test implementation manages an SSM parameter identified by the given `Name` property and returns the `ParameterVersion` as a response value.
// Of course this does not make much sense, but it is a simple test case and suits as an example of how to use the `aws-cloudformation-custom-resource` package to manage custom resources.
import {
  DeleteParameterCommand,
  GetParameterCommand,
  PutParameterCommand,
  SSMClient,
  AddTagsToResourceCommand,
  AddTagsToResourceCommandInput,
  RemoveTagsFromResourceCommand,
} from '@aws-sdk/client-ssm';
import {
  CustomResource,
  StandardLogger,
  LogLevel,
} from 'aws-cloudformation-custom-resource';

import type {
  DeleteParameterCommandInput,
  PutParameterCommandInput,
  RemoveTagsFromResourceCommandInput,
  Tag,
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
   * If your properties do not contain a `name`, you later need to manually set the physical resource ID using `resource.setPhysicalResourceId()`.
   */
  readonly name: string;

  /** Value of the parameter */
  readonly value: string;

  readonly tags?: Record<string, string>;
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
      Name: resource.properties.name.value,
      Value: String(resource.properties.value),
      Type: 'String',
      Overwrite: false,
      Tags: makeTags(resource.properties.tags?.value),
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
      .catch(reject);
  });
}

async function updateResource(
  resource: CustomResource<ResourceProperties>,
  log: Logger,
): Promise<void> {
  if (!resource.properties.value.changed) {
    log.info('No update of parameter value required');

    const version = await getParameterVersion(
      resource.properties.name.value,
      log,
    );
    if (!version) {
      throw new Error('Error getting parameter version');
    }

    resource.addResponseValue('ParameterVersion', String(version));
  } else {
    log.info(
      `Updating parameter ${resource.properties.name.value} value: ${resource.properties.value.before} -> ${resource.properties.value.value}`,
    );

    const params: PutParameterCommandInput = {
      /* eslint-disable @typescript-eslint/naming-convention */
      Name: resource.properties.name.value.toString(),
      Value: resource.properties.value.value.valueOf(),
      Type: 'String',
      Overwrite: true,
      /* eslint-enable @typescript-eslint/naming-convention */
    };

    const putParameterCommand = new PutParameterCommand(params);
    const data = await ssmClient.send(putParameterCommand);

    log.info('Parameter updated successfully.');
    resource.addResponseValue('ParameterVersion', data.Version!.toString());
  }
  if (resource.properties.tags?.changed) {
    log.debug(
      'Tags have changed:',
      resource.properties.tags?.value,
      resource.properties.tags?.before,
    );
    await Promise.all([
      updateParameterAddTags(resource, log),
      updateParameterRemoveTags(resource, log),
    ]);
  } else {
    log.debug('No tag changes detected');
  }
}

function deleteResource(
  resource: CustomResource<ResourceProperties>,
  log: Logger,
): Promise<void> {
  return new Promise(function (resolve, reject) {
    const parameterName = resource.properties.name.value;
    if (!parameterName) {
      // this might happen, when resource creation failed and therefore the physical resource ID is undefined.
      // even though resource creation fails, CloudFormation still will issue a delete request.
      log.warn('Parameter name is not defined.');
      resolve();
      return;
    }
    const params: DeleteParameterCommandInput = {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      Name: parameterName,
    };
    getParameterVersion(parameterName, log)
      .then((version) => {
        if (!version) {
          log.warn(
            `Parameter ${parameterName} does not exist. Nothing to delete.`,
          );
          resolve();
          return;
        }
        const deleteParameterCommand = new DeleteParameterCommand(params);
        ssmClient
          .send(deleteParameterCommand)
          .then((_data) => {
            log.info(`Parameter ${parameterName} deleted successfully`);
            resolve();
          })
          .catch(reject);
      })
      .catch(reject);
  });
}

/**
 * Retrieves the version of a specific parameter from the SSM Parameter Store.
 * @param parameterName The name of the parameter.
 * @returns A Promise that resolves to the version of the parameter.
 */
async function getParameterVersion(
  parameterName: string,
  log: Logger,
): Promise<number | false> {
  try {
    const command = new GetParameterCommand({
      /* eslint-disable @typescript-eslint/naming-convention */
      Name: parameterName,
      WithDecryption: false,
      /* eslint-enable @typescript-eslint/naming-convention */
    });

    const response = await ssmClient.send(command);
    const version = response.Parameter?.Version;
    return version ?? false;
  } catch (error) {
    log.error('Error getting parameter version:', error);
    return false;
  }
}

function makeTags(eventTags?: Record<string, string>): Tag[] {
  return eventTags
    ? Object.entries(eventTags).map(([key, value]) => ({
        /* eslint-disable @typescript-eslint/naming-convention */
        Key: key,
        Value: value,
        /* eslint-enable @typescript-eslint/naming-convention */
      }))
    : [];
}

function getMissingTags(oldTags: Tag[], newTags: Tag[]): string[] {
  const missing = oldTags.filter(missingTags(newTags));
  return missing.map(function (tag: Tag) {
    return tag.Key!;
  });
}

function missingTags(newTags: Tag[]) {
  return (currentTag: Tag) => {
    return (
      newTags.filter((newTag: Tag) => {
        return newTag.Key == currentTag.Key;
      }).length == 0
    );
  };
}

function updateParameterAddTags(
  resource: CustomResource<ResourceProperties>,
  log: Logger,
): Promise<void> {
  const parameter = resource.properties.name.value;
  log.info(`Attempting to update tags for parameter ${parameter}`);
  return new Promise(function (resolve, reject) {
    const oldTags = makeTags(resource.properties.tags?.before);
    const newTags = makeTags(resource.properties.tags?.value);
    if (JSON.stringify(oldTags) == JSON.stringify(newTags)) {
      log.info(
        `No changes of tags detected for parameter ${parameter}. Not attempting any update`,
      );
      return resolve();
    }
    const params: AddTagsToResourceCommandInput = {
      /* eslint-disable @typescript-eslint/naming-convention */
      ResourceType: 'Parameter',
      ResourceId: parameter,
      Tags: newTags,
      /* eslint-enable @typescript-eslint/naming-convention */
    };
    log.debug(`AddTagsToResourceCommandInput: ${JSON.stringify(params)}`);
    ssmClient
      .send(new AddTagsToResourceCommand(params))
      .then((_data) => {
        resolve();
      })
      .catch((err) => {
        reject(err);
      });
  });
}

function updateParameterRemoveTags(
  resource: CustomResource<ResourceProperties>,
  log: Logger,
): Promise<void> {
  const parameter = resource.properties.name.value;
  log.info(`Attempting to remove some tags for parameter ${parameter}`);
  return new Promise(function (resolve, reject) {
    const oldTags = makeTags(resource.properties.tags?.before);
    const newTags = makeTags(resource.properties.tags?.value);
    const tagsToRemove = getMissingTags(oldTags, newTags);
    if (
      JSON.stringify(oldTags) == JSON.stringify(newTags) ||
      !tagsToRemove.length
    ) {
      log.info(
        `No changes of tags detected for parameter ${parameter}. Not attempting any update`,
      );
      return resolve();
    }

    log.info(`Will remove the following tags: ${JSON.stringify(tagsToRemove)}`);
    const params: RemoveTagsFromResourceCommandInput = {
      /* eslint-disable @typescript-eslint/naming-convention */
      ResourceType: 'Parameter',
      ResourceId: parameter,
      TagKeys: tagsToRemove,
      /* eslint-enable @typescript-eslint/naming-convention */
    };
    log.debug(`RemoveTagsFromResourceCommandInput: ${JSON.stringify(params)}`);
    ssmClient
      .send(new RemoveTagsFromResourceCommand(params))
      .then((_data) => {
        resolve();
      })
      .catch((err) => {
        reject(err);
      });
  });
}
