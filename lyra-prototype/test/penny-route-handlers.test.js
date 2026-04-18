const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');

const { bindClientDisconnectAbort } = require('../lib/penny-route-handlers');

test('bindClientDisconnectAbort aborts on aborted, request close, and response close', () => {
  for (const eventName of ['aborted', 'request-close', 'response-close']) {
    const req = new EventEmitter();
    const res = new EventEmitter();
    const controller = new AbortController();
    const binding = bindClientDisconnectAbort(req, res, controller);

    if (eventName === 'response-close') {
      res.emit('close');
    } else if (eventName === 'request-close') {
      req.emit('close');
    } else {
      req.emit(eventName);
    }

    assert.equal(binding.isClosed(), true);
    assert.equal(controller.signal.aborted, true);
    binding.cleanup();
  }
});

test('bindClientDisconnectAbort cleanup removes listeners', () => {
  const req = new EventEmitter();
  const res = new EventEmitter();
  const controller = new AbortController();
  const binding = bindClientDisconnectAbort(req, res, controller);

  binding.cleanup();
  req.emit('aborted');
  req.emit('close');
  res.emit('close');

  assert.equal(binding.isClosed(), false);
  assert.equal(controller.signal.aborted, false);
});
