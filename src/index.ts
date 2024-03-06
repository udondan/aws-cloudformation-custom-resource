import https = require('https');

export type Callback<TResult = unknown> = (
  error?: Error | string | null,
  result?: TResult,
) => void;

export interface Context {
  callbackWaitsForEmptyEventLoop: boolean;
  functionName: string;
  functionVersion: string;
  invokedFunctionArn: string;
  memoryLimitInMB: string;
  awsRequestId: string;
  logGroupName: string;
  logStreamName: string;
  getRemainingTimeInMillis(): number;
}

/**
 * The event passed to the Lambda handler
 */
export type Event = Record<string, unknown> & {
  /* eslint-disable @typescript-eslint/naming-convention */
  PhysicalResourceId?: string;
  StackId: string;
  RequestId: string;
  LogicalResourceId: string;
  ResponseURL?: string;
  RequestType: 'Create' | 'Update' | 'Delete';
  ResourceProperties?: Record<string, string> & {
    name?: string;
  };
  /* eslint-enable @typescript-eslint/naming-convention */
};

/**
 * A response value returned to CloudFormation.
 */
// As Cloudformation will transform any value to a string, we're upfront explicit and only allow strings to avoid surprises
// Technically it would be possible though, to accept booleans and numbers as well.
type ResponseValue = string;

/**
 * Function signature
 */
export type HandlerFunction = (resource: CustomResource) => Promise<void>;

/**
 * Custom CloudFormation resource helper
 */
export class CustomResource {
  /**
   * Stores function executed when resource creation is requested
   */
  createFunction: HandlerFunction;

  /**
   * Stores function executed when resource update is requested
   */
  updateFunction: HandlerFunction;

  /**
   * Stores function executed when resource deletion is requested
   */
  deleteFunction: HandlerFunction;

  /**
   * The event passed to the Lambda handler
   */
  public event: Event;

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
  public logger: Logger;

  /**
   * Timer for the Lambda timeout
   *
   * One second before the Lambda times out, we send a FAILED response to CloudFormation.
   * We store the timer, so we can clear it when we send the response.
   */
  timeoutTimer?: NodeJS.Timeout;

  constructor(
    event: Event,
    context: Context,
    callback: Callback,
    createFunction: HandlerFunction,
    updateFunction: HandlerFunction,
    deleteFunction: HandlerFunction,
    logger?: Logger,
  ) {
    this.event = event;
    this.context = context;
    this.callback = callback;
    this.createFunction = createFunction;
    this.updateFunction = updateFunction;
    this.deleteFunction = deleteFunction;
    this.logger = logger ?? new StandardLogger();
    this.handle();
  }

  /**
   * Adds values to the response returned to CloudFormation
   */
  addResponseValue(key: string, value: ResponseValue) {
    this.responseData[key] = value;
  }

  /**
   * Set the physical ID of the resource
   */
  setPhysicalResourceId(value: string) {
    this.physicalResourceId = value;
  }

  /**
   * Handles the Lambda event
   */
  private handle(): this {
    if (typeof this.event.ResponseURL === 'undefined') {
      throw new Error('ResponseURL missing');
    }

    this.logger.debug(`REQUEST RECEIVED:\n${JSON.stringify(this.event)}`);
    this.timeout();

    try {
      let handlerFunction: HandlerFunction;
      if (this.event.RequestType == 'Create')
        handlerFunction = this.createFunction;
      else if (this.event.RequestType == 'Update')
        handlerFunction = this.updateFunction;
      else if (this.event.RequestType == 'Delete')
        handlerFunction = this.deleteFunction;
      else {
        this.sendResponse(
          'FAILED',
          // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
          `Unexpected request type: ${this.event.RequestType}`,
        );
        return this;
      }

      handlerFunction(this)
        .then(() => {
          this.logger.debug(this.event);
          this.sendResponse(
            'SUCCESS',
            `${this.event.RequestType} completed successfully`,
          );
        })
        .catch((err: unknown) => {
          this.handleError(err);
        });
    } catch (err) {
      this.handleError(err);
    }
    return this;
  }

  handleError(err: unknown) {
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

    this.sendResponse('FAILED', errorMessage);
  }

  /**
   * Sends CloudFormation response just before the Lambda times out
   */
  timeout() {
    const handler = () => {
      this.logger.error('Timeout FAILURE!');
      new Promise(() => this.sendResponse('FAILED', 'Function timed out'))
        .then(() => this.callback(new Error('Function timed out')))
        .catch((err: unknown) => {
          this.handleError(err);
        });
    };
    this.timeoutTimer = setTimeout(
      handler,
      this.context.getRemainingTimeInMillis() - 1000,
    );
  }

  /**
   * Sends CloudFormation response
   */
  sendResponse(responseStatus: 'SUCCESS' | 'FAILED', responseData: string) {
    this.logger.debug(
      `CLearing timeout timer, as we're about to send a response...`,
    );
    clearTimeout(this.timeoutTimer);

    this.logger.debug(
      `Sending response ${responseStatus}:`,
      JSON.stringify(responseData, null, 2),
    );

    const body = JSON.stringify({
      /* eslint-disable @typescript-eslint/naming-convention */
      Status: responseStatus,
      Reason: `${responseData} | Full error in CloudWatch ${this.context.logStreamName}`,
      PhysicalResourceId:
        this.physicalResourceId ??
        this.event.PhysicalResourceId ??
        this.event.ResourceProperties?.name ??
        this.context.logStreamName,
      StackId: this.event.StackId,
      RequestId: this.event.RequestId,
      LogicalResourceId: this.event.LogicalResourceId,
      Data: this.responseData,
      /* eslint-enable @typescript-eslint/naming-convention */
    });

    this.logger.debug('RESPONSE BODY:\n', body);

    const url = new URL(this.event.ResponseURL!);

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
      this.callback(null, 'done');
    });

    request.on('error', (error) => {
      this.logger.error(`sendResponse Error:`, JSON.stringify(error));
      this.callback(error);
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
export enum LogLevel {
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
