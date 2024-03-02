import {
  DeleteParameterCommand,
  DeleteParameterCommandInput,
  PutParameterCommand,
  PutParameterCommandInput,
  SSMClient,
} from '@aws-sdk/client-ssm';
import { CustomResource, Event } from 'aws-cloudformation-custom-resource';
import { Callback, Context } from 'aws-lambda';

const region = 'us-east-1';
const ssmClient = new SSMClient({ region });

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
    const params: PutParameterCommandInput = {
      Name: event.ResourceProperties.Name,
      Value: event.ResourceProperties.Value,
      Type: 'String',
      Overwrite: false,
    };
    const putParameterCommand = new PutParameterCommand(params);
    ssmClient
      .send(putParameterCommand)
      .then((data) => {
        event.addResponseValue('ParameterVersion', data.Version);
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
      Name: event.ResourceProperties.Name,
      Value: event.ResourceProperties.Value,
      Type: 'String',
      Overwrite: true,
    };
    const putParameterCommand = new PutParameterCommand(params);
    ssmClient
      .send(putParameterCommand)
      .then((data) => {
        event.addResponseValue('ParameterVersion', data.Version);
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
      Name: event.ResourceProperties.Name,
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
