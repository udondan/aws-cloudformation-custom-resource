import { Callback, Context } from 'aws-lambda';
import AWS = require('aws-sdk');
import https = require('https');
import URL = require('url');

/**
 * The event passed to the Lambda handler
 */
export interface Event {
    [key: string]: any;
}

/**
 * Function signature
 */
export type func = (input: any) => Promise<any>;

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
     * The event passed to the Lambda handler
     */
    event: Event;

    /**
     * The context passed to the Lambda handler
     */
    context: Context;

    /**
     * The callback function passed to the Lambda handler
     */
    callback: Callback;

    /**
     * Logger class
     */
    logger: Logger;

    constructor(
        event: Event,
        context: Context,
        callback: Callback,
        logger?: Logger
    ) {
        if (typeof event.ResponseURL === 'undefined') {
            throw new Error('ResponseURL missing');
        }
        this.event = event;
        this.context = context;
        this.callback = callback;
        this.logger = logger || new StandardLogger();
        this.logger.debug(`REQUEST RECEIVED:\n${JSON.stringify(event)}`);
        this.timeout();
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
    handle(input?: any): this {
        const construct = this;
        try {
            let queue: func[];
            if (this.event.RequestType == 'Create')
                queue = this.createFunctions;
            else if (this.event.RequestType == 'Update')
                queue = this.updateFunctions;
            else if (this.event.RequestType == 'Delete')
                queue = this.deleteFunctions;
            else {
                this.sendResponse(
                    'FAILED',
                    `Unexpected request type: ${this.event.RequestType}`
                );
                return this;
            }

            let result = queue.reduce((current, next) => {
                return current.then((value: any) => {
                    return next(value);
                });
            }, Promise.resolve(input));

            result
                .then(function (response) {
                    construct.logger.debug(response);
                    construct.sendResponse(
                        'SUCCESS',
                        `${construct.event.RequestType} completed successfully`
                    );
                })
                .catch(function (err: AWS.AWSError) {
                    construct.logger.error(err, err.stack);
                    construct.sendResponse('FAILED', err.message || err.code);
                });
        } catch (err) {
            construct.sendResponse('FAILED', err.message || err.code);
        }
        return this;
    }

    /**
     * Sends CloudFormation response just before the Lambda times out
     */
    timeout() {
        const construct = this;
        const handler = () => {
            construct.logger.error('Timeout FAILURE!');
            new Promise(() =>
                construct.sendResponse('FAILED', 'Function timed out')
            ).then(() => construct.callback(new Error('Function timed out')));
        };
        setTimeout(handler, this.context.getRemainingTimeInMillis() - 1000);
    }

    /**
     * Sends CloudFormation response
     */
    sendResponse(responseStatus: string, responseData: string) {
        const construct = this;
        construct.logger.debug(
            `Sending response ${responseStatus}:\n${JSON.stringify(
                responseData
            )}`
        );

        var body = JSON.stringify({
            Status: responseStatus,
            Reason: `${responseData} | Full error in CloudWatch ${construct.context.logStreamName}`,
            PhysicalResourceId: construct.event.ResourceProperties.Name,
            StackId: construct.event.StackId,
            RequestId: construct.event.RequestId,
            LogicalResourceId: construct.event.LogicalResourceId,
            Data: {
                Message: responseData,
                Name: construct.event.ResourceProperties.Name,
            },
        });

        construct.logger.debug('RESPONSE BODY:\n', body);

        var url = URL.parse(construct.event.ResponseURL);
        var options = {
            hostname: url.hostname,
            port: 443,
            path: url.path,
            method: 'PUT',
            headers: {
                'content-type': '',
                'content-length': body.length,
            },
        };

        construct.logger.info('SENDING RESPONSE...\n');

        var request = https.request(options, function (response: any) {
            construct.logger.debug(`STATUS: ${response.statusCode}`);
            construct.logger.debug(
                `HEADERS: ${JSON.stringify(response.headers)}`
            );
            construct.context.done();
        });

        request.on('error', function (error: Error) {
            construct.logger.error(`sendResponse Error: ${error}`);
            construct.context.done();
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
