function summarizeTodo(todo = {}) {
  const title = String(todo.title || '').trim();
  const priority = String(todo.priority || 'normal').trim();
  return `${title || 'untitled'} [${priority || 'normal'}]`;
}

module.exports = {
  summarizeTodo,
};
