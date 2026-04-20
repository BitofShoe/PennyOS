export function createChatRequestGuard({
  createAbortController = () => new AbortController(),
} = {}) {
  let activeRequest = null;
  let nextRequestId = 0;

  return {
    start() {
      const requestId = ++nextRequestId;
      const controller = createAbortController();
      const previous = activeRequest;
      activeRequest = { requestId, controller };
      previous?.controller?.abort?.();
      return {
        requestId,
        controller,
        signal: controller.signal,
        replacedRequestId: previous?.requestId ?? null,
      };
    },
    cancel() {
      if (!activeRequest) return null;
      const canceledRequest = activeRequest;
      activeRequest = null;
      canceledRequest.controller?.abort?.();
      return canceledRequest.requestId;
    },
    isActive(requestId) {
      return activeRequest?.requestId === requestId;
    },
    finish(requestId) {
      if (activeRequest?.requestId !== requestId) return false;
      activeRequest = null;
      return true;
    },
    getActiveRequestId() {
      return activeRequest?.requestId ?? null;
    },
  };
}

export function isAbortError(error) {
  return String(error?.name || '') === 'AbortError' || String(error?.code || '') === 'ABORT_ERR';
}
