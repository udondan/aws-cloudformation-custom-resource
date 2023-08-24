import { Callback, Context } from 'aws-lambda';
import https = require('https');
import URL = require('url');

/**
 * The event passed to the Lambda handler
 */

export interface LambdaEvent {
  [key: string]: any;
}

/**
 * The event passed through the promises.
 */
export interface Event extends LambdaEvent {
  /**
   * Adds values to the response returned to CloudFormation
   */
  addResponseValue: (key: string, value: any) => void;

  /**
   * Set the physical ID of the resource
   */
  setPhysicalResourceId: (value: any) => void;
}

/**
 * Function signature
 */
export type func = (event: Event) => Promise<Event | Error>;

/**
 * Custom CloudFormation resource helper
 */
export class CustomResource {
  /**
   * Stores functions executed when resource creation is requested
   */
  createFunctions: func[] = [];

  /**
   * Stores functions executed when resource update is requested
   */
  updateFunctions: func[] = [];

  /**
   * Stores functions executed when resource deletion is requested
   */
  deleteFunctions: func[] = [];

  /**
   * The context passed to the Lambda handler
   */
  context: Context;

  /**
   * The callback function passed to the Lambda handler
   */
  callback: Callback;

  /**
   * Stores values returned to CloudFormation
   */
  ResponseData: {
    [key: string]: any;
  } = {};

  /**
   * Stores values physical ID of the resource
   */
  PhysicalResourceId?: string;

  /**
   * Logger class
   */
  logger: Logger;

  constructor(context: Context, callback: Callback, logger?: Logger) {
    this.context = context;
    this.callback = callback;
    this.logger = logger || new StandardLogger();
  }

  /**
   * Adds a function to the CREATE queue
   */
  onCreate(func: func): this {
    this.createFunctions.push(func);
    return this;
  }

  /**
   * Adds a function to the UPDATE queue
   */
  onUpdate(func: func): this {
    this.updateFunctions.push(func);
    return this;
  }

  /**
   * Adds a function to the DELETE queue
   */
  onDelete(func: func): this {
    this.deleteFunctions.push(func);
    return this;
  }

  /**
   * Handles the Lambda event
   */
  handle(event: LambdaEvent): this {
    const lambdaEvent = event;
    const self = this;

    if (typeof lambdaEvent.ResponseURL === 'undefined') {
      throw new Error('ResponseURL missing');
    }

    this.logger.debug(`REQUEST RECEIVED:\n${JSON.stringify(lambdaEvent)}`);
    this.timeout(lambdaEvent);

    event.addResponseValue = (key: string, value: any) => {
      self.ResponseData[key] = value;
    };

    event.setPhysicalResourceId = (value: string) => {
      self.PhysicalResourceId = value;
    };

    try {
      let queue: func[];
      if (lambdaEvent.RequestType == 'Create') queue = this.createFunctions;
      else if (lambdaEvent.RequestType == 'Update')
        queue = this.updateFunctions;
      else if (lambdaEvent.RequestType == 'Delete')
        queue = this.deleteFunctions;
      else {
        this.sendResponse(
          lambdaEvent,
          'FAILED',
          `Unexpected request type: ${lambdaEvent.RequestType}`
        );
        return this;
      }

      let result = queue.reduce(
        (current: Promise<Event | Error> | func, next: func) => {
          return (current as Promise<Event>).then((value: Event) => {
            return next(value);
          });
        },
        Promise.resolve(event as Event)
      );

      result
        .then(function (event: Event | Error) {
          self.logger.debug(event);
          self.sendResponse(
            lambdaEvent,
            'SUCCESS',
            `${lambdaEvent.RequestType} completed successfully`
          );
        })
        .catch(function (err: any) {
          self.logger.error(err, err.stack);
          self.sendResponse(lambdaEvent, 'FAILED', err.message || err.code);
        });
    } catch (err: any) {
      this.sendResponse(lambdaEvent, 'FAILED', err.message || err.code);
    }
    return this;
  }

  /**
   * Sends CloudFormation response just before the Lambda times out
   */
  timeout(event: LambdaEvent) {
    const self = this;
    const handler = () => {
      self.logger.error('Timeout FAILURE!');
      new Promise(() =>
        self.sendResponse(event, 'FAILED', 'Function timed out')
      ).then(() => self.callback(new Error('Function timed out')));
    };
    setTimeout(handler, this.context.getRemainingTimeInMillis() - 1000);
  }

  /**
   * Sends CloudFormation response
   */
  sendResponse(
    event: LambdaEvent,
    responseStatus: string,
    responseData: string
  ) {
    const self = this;
    this.logger.debug(
      `Sending response ${responseStatus}:\n${JSON.stringify(responseData)}`
    );

    const data = this.ResponseData;
    data['Message'] = responseData;

    const body = JSON.stringify({
      Status: responseStatus,
      Reason: `${responseData} | Full error in CloudWatch ${this.context.logStreamName}`,
      PhysicalResourceId:
        self.PhysicalResourceId ||
        event.PhysicalResourceId ||
        event.ResourceProperties.Name,
      StackId: event.StackId,
      RequestId: event.RequestId,
      LogicalResourceId: event.LogicalResourceId,
      Data: data,
    });

    this.logger.debug('RESPONSE BODY:\n', body);

    const url = URL.parse(event.ResponseURL);
    const options = {
      hostname: url.hostname,
      port: 443,
      path: url.path,
      method: 'PUT',
      headers: {
        'content-type': '',
        'content-length': body.length,
      },
    };

    this.logger.info('SENDING RESPONSE...\n');

    const request = https.request(options, function (response: any) {
      self.logger.debug(`STATUS: ${response.statusCode}`);
      self.logger.debug(`HEADERS: ${JSON.stringify(response.headers)}`);
      self.context.done();
    });

    request.on('error', function (error: Error) {
      self.logger.error(`sendResponse Error: ${error}`);
      self.context.done();
    });

    request.write(body);
    request.end();
  }
}

/**
 * Logger class
 */
export interface Logger {
  log(message: any, ...optionalParams: any[]): void;
  info(message: any, ...optionalParams: any[]): void;
  debug(message: any, ...optionalParams: any[]): void;
  warn(message: any, ...optionalParams: any[]): void;
  error(message: any, ...optionalParams: any[]): void;
}

/**
 * LogLevels supported by the logger
 */
export const enum LogLevel {
  ERROR,
  WARN,
  INFO,
  DEBUG,
}

/**
 * Standard logger class
 */
export class StandardLogger {
  /**
   * The log level
   *
   * @default LogLevel.WARN
   */
  level: LogLevel;

  constructor(level?: LogLevel) {
    this.level = level || LogLevel.WARN;
  }

  /**
   * Logs message with level ERROR
   */
  error(message: any, ...optionalParams: any[]) {
    if (this.level < LogLevel.ERROR) return;
    console.error(message, ...optionalParams);
  }

  /**
   * Logs message with level WARN
   */
  warn(message: any, ...optionalParams: any[]) {
    if (this.level < LogLevel.WARN) return;
    console.warn(message, ...optionalParams);
  }

  /**
   * Logs message with level INFO
   */
  info(message: any, ...optionalParams: any[]) {
    if (this.level < LogLevel.INFO) return;
    console.info(message, ...optionalParams);
  }

  /**
   * Logs message with level DEBUG
   */
  debug(message: any, ...optionalParams: any[]) {
    if (this.level < LogLevel.DEBUG) return;
    console.debug(message, ...optionalParams);
  }

  /**
   * Alias for info
   */
  log(message: any, ...optionalParams: any[]) {
    this.info(message, ...optionalParams);
  }
}
