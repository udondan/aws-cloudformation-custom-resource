// The tests build CloudFormation events and responses, which use PascalCase keys throughout.
/* eslint-disable @typescript-eslint/naming-convention */
import * as assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import * as https from 'node:https';
import { afterEach, beforeEach, describe, it, mock } from 'node:test';

import {
  Callback,
  Context,
  CustomResource,
  Event,
  HandlerFunction,
  Logger,
  LogLevel,
  StandardLogger,
} from './index';

interface Properties {
  name: string;
  tags?: Record<string, string>;
}

interface ResponseBody {
  Status: 'SUCCESS' | 'FAILED';
  Reason: string;
  PhysicalResourceId: string;
  StackId: string;
  RequestId: string;
  LogicalResourceId: string;
  Data: Record<string, string>;
  NoEcho: boolean;
}

function makeEvent(
  overrides: Partial<Event<Properties>> = {},
): Event<Properties> {
  return {
    StackId: 'stack-id',
    RequestId: 'request-id',
    LogicalResourceId: 'logical-id',
    ResponseURL: 'https://cloudformation.example.com/response?signature=abc',
    RequestType: 'Create',
    ResourceProperties: { name: 'my-resource' },
    ...overrides,
  };
}

function makeContext(remainingTime = 60_000): Context {
  return {
    functionName: 'function',
    functionVersion: '1',
    invokedFunctionArn: 'arn',
    memoryLimitInMB: '128',
    awsRequestId: 'aws-request-id',
    logGroupName: 'log-group',
    logStreamName: 'log-stream',
    getRemainingTimeInMillis: () => remainingTime,
  };
}

// A handler that never settles, so the timeout has to answer.
const neverSettles: HandlerFunction<Properties> = () =>
  new Promise<void>(() => undefined);

const silentLogger: Logger = {
  log: () => undefined,
  info: () => undefined,
  debug: () => undefined,
  warn: () => undefined,
  error: () => undefined,
};

const resolved: HandlerFunction<Properties> = () => Promise.resolve();

interface SentRequest {
  options: https.RequestOptions;
  body: ResponseBody;
}

/**
 * Replaces https.request. Every request either gets a response or emits the given error.
 */
function mockHttps(error?: Error): SentRequest[] {
  const sent: SentRequest[] = [];
  mock.method(
    https,
    'request',
    (
      options: https.RequestOptions,
      onResponse: (response: { statusCode: number; headers: object }) => void,
    ) => {
      const request = new EventEmitter();
      let body = '';
      Object.assign(request, {
        write: (chunk: string) => {
          body += chunk;
          return true;
        },
        end: () => {
          sent.push({ options, body: JSON.parse(body) as ResponseBody });
          if (error) {
            request.emit('error', error);
          } else {
            onResponse({ statusCode: 200, headers: {} });
          }
        },
      });
      return request;
    },
  );
  return sent;
}

function create(
  event: Event<Properties>,
  handlers: Partial<
    Record<'create' | 'update' | 'delete', HandlerFunction<Properties>>
  > = {},
  context = makeContext(),
) {
  const resource = new CustomResource<Properties>(
    event,
    context,
    handlers.create ?? resolved,
    handlers.update ?? resolved,
    handlers.delete ?? resolved,
  );
  resource.setLogger(silentLogger);
  return resource;
}

beforeEach(() => {
  // handleError() logs the raw error via console.log
  mock.method(console, 'log', () => undefined);
});

afterEach(() => {
  mock.restoreAll();
  mock.timers.reset();
});

describe('CustomResource', () => {
  for (const requestType of ['Create', 'Update', 'Delete'] as const) {
    it(`runs the ${requestType} handler and sends SUCCESS`, async () => {
      const sent = mockHttps();
      const called: string[] = [];
      const resource = create(makeEvent({ RequestType: requestType }), {
        create: () => {
          called.push('Create');
          return Promise.resolve();
        },
        update: () => {
          called.push('Update');
          return Promise.resolve();
        },
        delete: () => {
          called.push('Delete');
          return Promise.resolve();
        },
      });

      await resource.done();

      assert.deepEqual(called, [requestType]);
      assert.equal(sent.length, 1);
      assert.equal(sent[0].body.Status, 'SUCCESS');
      assert.equal(
        sent[0].body.Reason,
        `${requestType} completed successfully | Details in CloudWatch log-stream`,
      );
    });
  }

  it('sends the request to the response URL', async () => {
    const sent = mockHttps();
    const resource = create(makeEvent());

    await resource.done();

    const { options, body } = sent[0];
    assert.equal(options.hostname, 'cloudformation.example.com');
    assert.equal(options.port, 443);
    assert.equal(options.path, '/response?signature=abc');
    assert.equal(options.method, 'PUT');
    assert.deepEqual(options.headers, {
      'content-type': '',
      'content-length': JSON.stringify(body).length,
    });
    assert.equal(body.StackId, 'stack-id');
    assert.equal(body.RequestId, 'request-id');
    assert.equal(body.LogicalResourceId, 'logical-id');
  });

  it('returns response values and the NoEcho flag', async () => {
    const sent = mockHttps();
    const resource = create(makeEvent());
    assert.equal(resource.getNoEcho(), false);
    resource.addResponseValue('Foo', 'bar');
    resource.setNoEcho(true);
    assert.equal(resource.getNoEcho(), true);

    await resource.done();

    assert.deepEqual(sent[0].body.Data, { Foo: 'bar' });
    assert.equal(sent[0].body.NoEcho, true);
  });

  describe('physical resource ID', () => {
    it('uses the ID from the event', async () => {
      const sent = mockHttps();
      const resource = create(makeEvent({ PhysicalResourceId: 'from-event' }));
      assert.equal(resource.getPhysicalResourceId(), 'from-event');

      await resource.done();

      assert.equal(sent[0].body.PhysicalResourceId, 'from-event');
    });

    it('prefers an explicitly set ID', async () => {
      const sent = mockHttps();
      const resource = create(makeEvent({ PhysicalResourceId: 'from-event' }));
      resource.setPhysicalResourceId('explicit');
      assert.equal(resource.getPhysicalResourceId(), 'explicit');

      await resource.done();

      assert.equal(sent[0].body.PhysicalResourceId, 'explicit');
    });

    it('falls back to the name property', async () => {
      const sent = mockHttps();
      const resource = create(makeEvent());
      assert.equal(resource.getPhysicalResourceId(), undefined);

      await resource.done();

      assert.equal(sent[0].body.PhysicalResourceId, 'my-resource');
    });

    it('falls back to the log stream name', async () => {
      const sent = mockHttps();
      const resource = create(
        makeEvent({ ResourceProperties: {} as Properties }),
      );

      await resource.done();

      assert.equal(sent[0].body.PhysicalResourceId, 'log-stream');
    });
  });

  describe('failures', () => {
    it('sends FAILED for an unexpected request type', async () => {
      const sent = mockHttps();
      const resource = create(
        makeEvent({ RequestType: 'Replace' as Event['RequestType'] }),
      );

      await resource.done();

      assert.equal(sent[0].body.Status, 'FAILED');
      assert.equal(
        sent[0].body.Reason,
        'Unexpected request type: Replace | Full error in CloudWatch log-stream',
      );
    });

    const errors: [string, unknown, string][] = [
      ['an Error', new Error('boom'), 'boom'],
      ['a string', 'boom', 'boom'],
      ['anything else', { code: 42 }, 'Unknown error: {"code":42}'],
    ];
    for (const [description, error, message] of errors) {
      it(`sends FAILED when the handler rejects with ${description}`, async () => {
        const sent = mockHttps();
        const resource = create(makeEvent(), {
          // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors -- non-Error rejections are under test
          create: () => Promise.reject(error),
        });

        await resource.done();

        assert.equal(sent[0].body.Status, 'FAILED');
        assert.equal(
          sent[0].body.Reason,
          `${message} | Full error in CloudWatch log-stream`,
        );
      });
    }

    it('sends FAILED when the handler throws synchronously', async () => {
      const sent = mockHttps();
      const resource = create(makeEvent(), {
        create: () => {
          throw new Error('sync boom');
        },
      });

      await resource.done();

      assert.equal(sent[0].body.Status, 'FAILED');
      assert.match(sent[0].body.Reason, /^sync boom/);
    });

    it('sends FAILED shortly before the Lambda times out', async () => {
      const sent = mockHttps();
      const resource = create(
        makeEvent(),
        { create: neverSettles },
        makeContext(1010),
      );

      await resource.done();

      assert.equal(sent.length, 1);
      assert.equal(sent[0].body.Status, 'FAILED');
      assert.match(sent[0].body.Reason, /^Function timed out/);
    });

    it('rejects done() when the ResponseURL is missing', async () => {
      const sent = mockHttps();
      const resource = create(makeEvent({ ResponseURL: undefined }));

      await assert.rejects(resource.done(), /ResponseURL missing/);
      assert.equal(sent.length, 0);
    });

    it('rejects done() when the response cannot be sent', async () => {
      mockHttps(new Error('network down'));
      const resource = create(makeEvent());

      await assert.rejects(resource.done(), /network down/);
    });
  });

  describe('with a callback', () => {
    function createWithCallback(event: Event<Properties>, callback: Callback) {
      const resource = new CustomResource<Properties>(
        event,
        makeContext(),
        callback,
        resolved,
        resolved,
        resolved,
      );
      resource.setLogger(silentLogger);
      return resource;
    }

    it('calls the callback once the response was sent', async () => {
      const sent = mockHttps();
      const callback = mock.fn<Callback>();
      const resource = createWithCallback(makeEvent(), callback);

      await resource.done();

      assert.equal(sent[0].body.Status, 'SUCCESS');
      assert.equal(resource.callback, callback);
      assert.deepEqual(callback.mock.calls[0].arguments, [null, 'done']);
    });

    it('passes the error to the callback when the response cannot be sent', async () => {
      const error = new Error('network down');
      mockHttps(error);
      const callback = mock.fn<Callback>();
      const resource = createWithCallback(makeEvent(), callback);

      await assert.rejects(resource.done(), /network down/);

      assert.deepEqual(callback.mock.calls[0].arguments, [error]);
    });

    it('throws when the ResponseURL is missing', () => {
      mock.timers.enable({ apis: ['setTimeout'] });
      const resource = createWithCallback(
        makeEvent({ ResponseURL: undefined }),
        mock.fn<Callback>(),
      );

      assert.throws(() => mock.timers.runAll(), /ResponseURL missing/);
      return assert.rejects(resource.done(), /ResponseURL missing/);
    });
  });

  describe('properties', () => {
    function properties(
      ResourceProperties: Properties,
      OldResourceProperties?: Properties,
    ) {
      mockHttps();
      const resource = create(
        makeEvent({ ResourceProperties, OldResourceProperties }),
      );
      return { resource, properties: resource.properties };
    }

    it('exposes value, before and changed', async () => {
      const { resource, properties: props } = properties(
        { name: 'new', tags: { a: '1' } },
        { name: 'old', tags: { a: '1' } },
      );

      assert.equal(props.name.value, 'new');
      assert.equal(props.name.before, 'old');
      assert.equal(props.name.changed, true);
      assert.deepEqual(props.tags?.value, { a: '1' });
      assert.equal(props.tags?.changed, false);
      await resource.done();
    });

    it('reports a change when there are no old properties', async () => {
      const { resource, properties: props } = properties({ name: 'new' });

      assert.equal(props.name.before, undefined);
      assert.equal(props.name.changed, true);
      await resource.done();
    });

    it('converts to the plain value', async () => {
      const { resource, properties: props } = properties({ name: 'new' });

      assert.equal(props.name.toString(), 'new');
      assert.equal(props.name.valueOf(), 'new');
      await resource.done();
    });

    it('returns undefined for unknown keys and symbols', async () => {
      const { resource, properties: props } = properties({ name: 'new' });

      assert.equal(
        (props.name as unknown as Record<string, unknown>).other,
        undefined,
      );
      assert.equal(
        (props as unknown as Record<symbol, unknown>)[Symbol.iterator],
        undefined,
      );
      await resource.done();
    });
  });

  it('uses the StandardLogger by default', async () => {
    mockHttps();
    const error = mock.method(console, 'error', () => undefined);
    const resource = new CustomResource<Properties>(
      makeEvent(),
      makeContext(),
      () => Promise.reject(new Error('boom')),
      resolved,
      resolved,
    );

    await resource.done();

    assert.ok(error.mock.callCount() > 0);
  });
});

describe('StandardLogger', () => {
  const methods = ['error', 'warn', 'info', 'debug'] as const;

  function spyConsole() {
    return {
      error: mock.method(console, 'error', () => undefined),
      warn: mock.method(console, 'warn', () => undefined),
      info: mock.method(console, 'info', () => undefined),
      debug: mock.method(console, 'debug', () => undefined),
    };
  }

  it('defaults to the warn level', () => {
    assert.equal(new StandardLogger().level, LogLevel.warn);
  });

  for (const level of [
    LogLevel.error,
    LogLevel.warn,
    LogLevel.info,
    LogLevel.debug,
  ]) {
    it(`logs up to level ${LogLevel[level]}`, () => {
      const spies = spyConsole();
      const logger = new StandardLogger(level);

      for (const method of methods) {
        logger[method]('message', 'param');
      }

      for (const method of methods) {
        const expected = LogLevel[method] <= level ? 1 : 0;
        assert.equal(spies[method].mock.callCount(), expected, method);
      }
    });
  }

  it('suppresses everything below the error level', () => {
    const spies = spyConsole();
    const logger = new StandardLogger(-1 as LogLevel);

    for (const method of methods) {
      logger[method]('message');
    }

    for (const method of methods) {
      assert.equal(spies[method].mock.callCount(), 0, method);
    }
  });

  it('logs log() as info', () => {
    const spies = spyConsole();
    new StandardLogger(LogLevel.info).log('message', 'param');

    assert.deepEqual(spies.info.mock.calls[0].arguments, ['message', 'param']);
  });
});
