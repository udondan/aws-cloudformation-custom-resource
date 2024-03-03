import { Callback, Context } from 'aws-lambda';
import https = require('https');

/**
 * The event passed to the Lambda handler
 */
export type LambdaEvent = Record<string, unknown> & {
  /* eslint-disable @typescript-eslint/naming-convention */
  PhysicalResourceId?: string;
  StackId: string;
  RequestId: string;
  LogicalResourceId: string;
  ResponseURL?: string;
  RequestType: 'Create' | 'Update' | 'Delete';
  ResourceProperties?: Record<string, string> & {
    Name?: string;
  };
  /* eslint-enable @typescript-eslint/naming-convention */
};

/**
 * The response value returned to CloudFormation
 * Aa Cloudformation will transform any value to a string, we're upfront explicit and only allow strings to avoid surprises
 * Technically it would be possible though, to accept booleans and numbers as well.
 */
type ResponseValue = string;

/**
 * The event passed through the promises.
 */
export interface Event extends LambdaEvent {
  /**
   * Adds values to the response returned to CloudFormation
   */
  addResponseValue: (key: string, value: ResponseValue) => void;

  /**
   * Set the physical ID of the resource
   */
  setPhysicalResourceId: (value: string) => void;
}

/**
 * Function signature
 */
export type HandlerFunction = (event: Event) => Promise<Event>;

/**
 * Custom CloudFormation resource helper
 */
export class CustomResource {
  /**
   * Stores functions executed when resource creation is requested
   */
  createFunctions: HandlerFunction[] = [];

  /**
   * Stores functions executed when resource update is requested
   */
  updateFunctions: HandlerFunction[] = [];

  /**
   * Stores functions executed when resource deletion is requested
   */
  deleteFunctions: HandlerFunction[] = [];

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
  responseData: Record<string, ResponseValue> = {};

  /**
   * Stores values physical ID of the resource
   */
  physicalResourceId?: string;

  /**
   * Logger class
   */
  logger: Logger;

  constructor(context: Context, callback: Callback, logger?: Logger) {
    this.context = context;
    this.callback = callback;
    this.logger = logger ?? new StandardLogger();
  }

  /**
   * Adds a function to the CREATE queue
   */
  onCreate(func: HandlerFunction): this {
    this.createFunctions.push(func);
    return this;
  }

  /**
   * Adds a function to the UPDATE queue
   */
  onUpdate(func: HandlerFunction): this {
    this.updateFunctions.push(func);
    return this;
  }

  /**
   * Adds a function to the DELETE queue
   */
  onDelete(func: HandlerFunction): this {
    this.deleteFunctions.push(func);
    return this;
  }

  /**
   * Handles the Lambda event
   */
  handle(event: LambdaEvent): this {
    const lambdaEvent = event;

    if (typeof lambdaEvent.ResponseURL === 'undefined') {
      throw new Error('ResponseURL missing');
    }

    this.logger.debug(`REQUEST RECEIVED:\n${JSON.stringify(lambdaEvent)}`);
    this.timeout(lambdaEvent);

    event.addResponseValue = (key: string, value: ResponseValue) => {
      this.responseData[key] = value;
    };

    event.setPhysicalResourceId = (value: string) => {
      this.physicalResourceId = value;
    };

    try {
      let queue: HandlerFunction[];
      if (lambdaEvent.RequestType == 'Create') queue = this.createFunctions;
      else if (lambdaEvent.RequestType == 'Update')
        queue = this.updateFunctions;
      else if (lambdaEvent.RequestType == 'Delete')
        queue = this.deleteFunctions;
      else {
        this.sendResponse(
          lambdaEvent,
          'FAILED',
          // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
          `Unexpected request type: ${lambdaEvent.RequestType}`,
        );
        return this;
      }

      const result = queue.reduce(
        async (
          current: Promise<Event> | HandlerFunction,
          next: HandlerFunction,
        ) => {
          const value = await (current as Promise<Event>);
          return await next(value);
        },
        Promise.resolve(event as Event),
      );

      result
        .then((event: Event) => {
          this.logger.debug(event);
          this.sendResponse(
            lambdaEvent,
            'SUCCESS',
            `${lambdaEvent.RequestType} completed successfully`,
          );
        })
        .catch((err: unknown) => {
          this.handleError(event, err);
        });
    } catch (err) {
      this.handleError(event, err);
    }
    return this;
  }

  handleError(event: LambdaEvent, err: unknown) {
    console.log(err);
    this.logger.error(JSON.stringify(err, null, 2));

    let errorMessage: string;
    if (err instanceof Error) {
      errorMessage = err.message;
    } else if (typeof err === 'string') {
      errorMessage = err;
    } else {
      errorMessage = `Unknown error: ${JSON.stringify(err)}`;
    }

    this.sendResponse(event, 'FAILED', errorMessage);
  }

  /**
   * Sends CloudFormation response just before the Lambda times out
   */
  timeout(event: LambdaEvent) {
    const handler = () => {
      this.logger.error('Timeout FAILURE!');
      new Promise(() =>
        this.sendResponse(event, 'FAILED', 'Function timed out'),
      )
        .then(() => this.callback(new Error('Function timed out')))
        .catch((err: unknown) => {
          this.handleError(event, err);
        });
    };
    setTimeout(handler, this.context.getRemainingTimeInMillis() - 1000);
  }

  /**
   * Sends CloudFormation response
   */
  sendResponse(
    event: LambdaEvent,
    responseStatus: 'SUCCESS' | 'FAILED',
    responseData: string,
  ) {
    this.logger.debug(
      `Sending response ${responseStatus}:`,
      JSON.stringify(responseData, null, 2),
    );

    const data = this.responseData;
    //data.Message = responseData; // why??

    const body = JSON.stringify({
      /* eslint-disable @typescript-eslint/naming-convention */
      Status: responseStatus,
      Reason: `${responseData} | Full error in CloudWatch ${this.context.logStreamName}`,
      PhysicalResourceId:
        this.physicalResourceId ??
        event.PhysicalResourceId ??
        event.ResourceProperties?.Name ??
        this.context.logStreamName,
      StackId: event.StackId,
      RequestId: event.RequestId,
      LogicalResourceId: event.LogicalResourceId,
      Data: data,
      /* eslint-enable @typescript-eslint/naming-convention */
    });

    this.logger.debug('RESPONSE BODY:\n', body);

    const url = new URL(event.ResponseURL!);

    const options = {
      hostname: url.hostname,
      port: 443,
      path: `${url.pathname}${url.search}`,
      method: 'PUT',
      headers: {
        /* eslint-disable @typescript-eslint/naming-convention */
        'content-type': '',
        'content-length': body.length,
        /* eslint-enable @typescript-eslint/naming-convention */
      },
    };

    this.logger.info(
      'SENDING RESPONSE...',
      JSON.stringify({ options, body }, null, 2),
    );

    const request = https.request(options, (response) => {
      this.logger.debug(`STATUS: ${response.statusCode}`);
      this.logger.debug(`HEADERS: ${JSON.stringify(response.headers)}`);
      this.callback('done');
    });

    request.on('error', (error) => {
      this.logger.error(`sendResponse Error:`, JSON.stringify(error));
      this.callback(null, error);
    });

    request.write(body);
    request.end();
  }
}

/**
 * Logger class
 */
export interface Logger {
  log(message: unknown, ...optionalParams: unknown[]): void;
  info(message: unknown, ...optionalParams: unknown[]): void;
  debug(message: unknown, ...optionalParams: unknown[]): void;
  warn(message: unknown, ...optionalParams: unknown[]): void;
  error(message: unknown, ...optionalParams: unknown[]): void;
}

/**
 * LogLevels supported by the logger
 */
export const enum LogLevel {
  error,
  warn,
  info,
  debug,
}

/**
 * Standard logger class
 */
export class StandardLogger {
  /**
   * The log level
   *
   * @default LogLevel.warn
   */
  level: LogLevel;

  constructor(level?: LogLevel) {
    this.level = level ?? LogLevel.warn;
  }
  /**
   * Logs message with level ERROR
   */
  error(message: unknown, ...optionalParams: unknown[]) {
    if (this.level < LogLevel.error) return;
    console.error(message, ...optionalParams);
  }

  /**
   * Logs message with level WARN
   */
  warn(message: unknown, ...optionalParams: unknown[]) {
    if (this.level < LogLevel.warn) return;
    console.warn(message, ...optionalParams);
  }

  /**
   * Logs message with level INFO
   */
  info(message: unknown, ...optionalParams: unknown[]) {
    if (this.level < LogLevel.info) return;
    console.info(message, ...optionalParams);
  }

  /**
   * Logs message with level DEBUG
   */
  debug(message: unknown, ...optionalParams: unknown[]) {
    if (this.level < LogLevel.debug) return;
    console.debug(message, ...optionalParams);
  }

  /**
   * Alias for info
   */
  log(message: unknown, ...optionalParams: unknown[]) {
    this.info(message, ...optionalParams);
  }
}
