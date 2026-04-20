const test = require('node:test');
const assert = require('node:assert/strict');

const helpersPromise = import('../public/js/penny-chat-request-guard.mjs');

function createAbortControllerFactory() {
  const controllers = [];
  return {
    controllers,
    createAbortController() {
      const controller = {
        signal: { aborted: false },
        abortCalls: 0,
        abort() {
          this.abortCalls += 1;
          this.signal.aborted = true;
        },
      };
      controllers.push(controller);
      return controller;
    },
  };
}

test('chat request guard aborts the previous request when a newer send starts', async () => {
  const { createChatRequestGuard } = await helpersPromise;
  const factory = createAbortControllerFactory();
  const guard = createChatRequestGuard({ createAbortController: factory.createAbortController });

  const first = guard.start();
  const second = guard.start();

  assert.equal(first.requestId, 1);
  assert.equal(second.requestId, 2);
  assert.equal(second.replacedRequestId, 1);
  assert.equal(factory.controllers[0].abortCalls, 1);
  assert.equal(factory.controllers[0].signal.aborted, true);
  assert.equal(guard.isActive(first.requestId), false);
  assert.equal(guard.isActive(second.requestId), true);
});

test('chat request guard cancels and clears the active request', async () => {
  const { createChatRequestGuard } = await helpersPromise;
  const factory = createAbortControllerFactory();
  const guard = createChatRequestGuard({ createAbortController: factory.createAbortController });

  const active = guard.start();
  const canceledRequestId = guard.cancel();

  assert.equal(canceledRequestId, active.requestId);
  assert.equal(factory.controllers[0].abortCalls, 1);
  assert.equal(factory.controllers[0].signal.aborted, true);
  assert.equal(guard.isActive(active.requestId), false);
  assert.equal(guard.getActiveRequestId(), null);
});

test('chat request guard only finishes the currently active request', async () => {
  const { createChatRequestGuard } = await helpersPromise;
  const guard = createChatRequestGuard({
    createAbortController() {
      return {
        signal: { aborted: false },
        abort() {},
      };
    },
  });

  const first = guard.start();
  const second = guard.start();

  assert.equal(guard.finish(first.requestId), false);
  assert.equal(guard.isActive(second.requestId), true);
  assert.equal(guard.finish(second.requestId), true);
  assert.equal(guard.getActiveRequestId(), null);
});

test('isAbortError recognizes fetch aborts without treating normal errors as cancellations', async () => {
  const { isAbortError } = await helpersPromise;

  assert.equal(isAbortError({ name: 'AbortError' }), true);
  assert.equal(isAbortError({ code: 'ABORT_ERR' }), true);
  assert.equal(isAbortError(new Error('boom')), false);
});
