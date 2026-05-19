const test = require('node:test');
const assert = require('node:assert/strict');
const { summarizeTodo } = require('../src/todo');

test('summarizeTodo returns a compact title and priority', () => {
  assert.equal(summarizeTodo({ title: 'write receipt', priority: 'high' }), 'write receipt [high]');
});

test('summarizeTodo falls back safely for blank input', () => {
  assert.equal(summarizeTodo({}), 'untitled [normal]');
});
