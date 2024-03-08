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
export type Event<ResourceProperties = Record<string, string>> = Omit<
  Record<string, unknown>,
  'ResourceProperties'
> & {
  /* eslint-disable @typescript-eslint/naming-convention */
  PhysicalResourceId?: string;
  StackId: string;
  RequestId: string;
  LogicalResourceId: string;
  ResponseURL?: string;
  RequestType: 'Create' | 'Update' | 'Delete';
  ResourceProperties: ResourceProperties;
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
export type HandlerFunction<ResourceProperties> = (
  resource: CustomResource<ResourceProperties>,
  logger: Logger,
) => Promise<void>;

/**
 * Custom CloudFormation resource helper
 */
export class CustomResource<ResourceProperties = Record<string, string>> {
  /**
   * Stores function executed when resource creation is requested
   */
  private createFunction: HandlerFunction<ResourceProperties>;

  /**
   * Stores function executed when resource update is requested
   */
  private updateFunction: HandlerFunction<ResourceProperties>;

  /**
   * Stores function executed when resource deletion is requested
   */
  private deleteFunction: HandlerFunction<ResourceProperties>;

  /**
   * The event passed to the Lambda handler
   */
  public readonly event: Event<ResourceProperties>;

  /**
   * The context passed to the Lambda handler
   */
  public readonly context: Context;

  /**
   * The callback function passed to the Lambda handler
   */
  public readonly callback: Callback;

  /**
   * The properties passed to the Lambda function
   */
  public readonly properties: ResourceProperties;

  /**
   * Stores values returned to CloudFormation
   */
  private responseData: Record<string, ResponseValue> = {};

  /**
   * Stores values physical ID of the resource
   */
  private physicalResourceId?: string;

  /**
   * Indicates whether to mask the output of the custom resource when it's retrieved by using the `Fn::GetAtt` function.
   *
   * If set to `true`, all returned values are masked with asterisks (*****), except for information stored in the locations specified below. By default, this value is `false`.
   */
  private noEcho = false;

  /**
   * Logger class
   */
  private logger: Logger;

  /**
   * Timer for the Lambda timeout
   *
   * One second before the Lambda times out, we send a FAILED response to CloudFormation.
   * We store the timer, so we can clear it when we send the response.
   */
  private timeoutTimer?: NodeJS.Timeout;

  constructor(
    event: Event<ResourceProperties>,
    context: Context,
    callback: Callback,
    createFunction: HandlerFunction<ResourceProperties>,
    updateFunction: HandlerFunction<ResourceProperties>,
    deleteFunction: HandlerFunction<ResourceProperties>,
  ) {
    this.event = event;
    this.context = context;
    this.callback = callback;
    this.properties = event.ResourceProperties;
    this.createFunction = createFunction;
    this.updateFunction = updateFunction;
    this.deleteFunction = deleteFunction;
    this.logger = new StandardLogger();
    if (this.event.PhysicalResourceId) {
      this.setPhysicalResourceId(this.event.PhysicalResourceId);
    }
    setTimeout(() => {
      this.handle();
    });
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
   * Get the physical ID of the resource
   */
  getPhysicalResourceId() {
    return this.physicalResourceId;
  }

  /**
   * Set whether to mask the output of the custom resource when it's retrieved by using the `Fn::GetAtt` function.
   *
   * If set to `true`, all returned values are masked with asterisks (*****), except for information stored in the locations specified below. By default, this value is `false`.
   */
  setNoEcho(value: boolean) {
    this.noEcho = value;
  }

  /**
   * Get whether to mask the output of the custom resource when it's retrieved by using the `Fn::GetAtt` function.
   */
  getNoEcho() {
    return this.noEcho;
  }

  /**
   * Set the logger class
   */
  setLogger(logger: Logger) {
    this.logger = logger;
  }

  /**
   * Handles the Lambda event
   */
  private handle(): this {
    if (typeof this.event.ResponseURL === 'undefined') {
      throw new Error('ResponseURL missing');
    }

    this.logger.debug('REQUEST RECEIVED:', JSON.stringify(this.event));
    this.timeout();

    try {
      let handlerFunction: HandlerFunction<ResourceProperties>;
      switch (
        this.event.RequestType // Changed to switch for better readability
      ) {
        case 'Create':
          handlerFunction = this.createFunction;
          break;
        case 'Update':
          handlerFunction = this.updateFunction;
          break;
        case 'Delete':
          handlerFunction = this.deleteFunction;
          break;
        default:
          this.sendResponse(
            'FAILED',
            // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
            `Unexpected request type: ${this.event.RequestType}`,
          );
          return this;
      }

      handlerFunction(this, this.logger)
        .then(() => {
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

  private handleError(err: unknown) {
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
  private timeout() {
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
  private sendResponse(
    responseStatus: 'SUCCESS' | 'FAILED',
    responseData: string,
  ) {
    this.logger.debug(
      `Clearing timeout timer, as we're about to send a response...`,
    );
    clearTimeout(this.timeoutTimer);

    this.logger.debug(
      `Sending response ${responseStatus}:`,
      JSON.stringify(responseData, null, 2),
    );

    const body = {
      /* eslint-disable @typescript-eslint/naming-convention */
      Status: responseStatus,
      Reason: `${responseData} | ${responseStatus === 'FAILED' ? 'Full error' : 'Details'} in CloudWatch ${this.context.logStreamName}`,
      PhysicalResourceId:
        this.physicalResourceId ??
        (this.event.ResourceProperties as Record<string, string>).name ??
        this.context.logStreamName,
      StackId: this.event.StackId,
      RequestId: this.event.RequestId,
      LogicalResourceId: this.event.LogicalResourceId,
      Data: this.responseData,
      NoEcho: this.noEcho,
      /* eslint-enable @typescript-eslint/naming-convention */
    };

    const bodyString = JSON.stringify(body);

    const url = new URL(this.event.ResponseURL!);

    const options = {
      hostname: url.hostname,
      port: 443,
      path: `${url.pathname}${url.search}`,
      method: 'PUT',
      headers: {
        /* eslint-disable @typescript-eslint/naming-convention */
        'content-type': '',
        'content-length': bodyString.length,
        /* eslint-enable @typescript-eslint/naming-convention */
      },
    };

    this.logger.info(
      'SENDING RESPONSE...',
      JSON.stringify({ options, body }, null, 2),
    );

    const request = https.request(options, (response) => {
      this.logger.debug('RESULT:', {
        status: response.statusCode,
        headers: response.headers,
      });
      this.callback(null, 'done');
    });

    request.on('error', (error) => {
      this.logger.error('sendResponse Error:', JSON.stringify(error));
      this.callback(error);
    });

    request.write(bodyString);
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
