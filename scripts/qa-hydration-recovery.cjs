/* Isolated-browser diagnostic only. React's commit hook runs before reporting
 * recoverable errors. Preserve Next's original callback, including pageerror,
 * while retaining the componentStack Next otherwise drops. No DOM mutation. */
module.exports = async function installHydrationRecoveryCapture(context) {
  await context.addInitScript(() => {
    if (globalThis.__REACT_DEVTOOLS_GLOBAL_HOOK__) throw Error('QA requires an isolated browser without another React DevTools hook');
    const wrapped = new WeakSet();
    globalThis.__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
      supportsFiber: true,
      inject() { return 1; },
      onCommitFiberRoot(_renderer, root) {
        if (wrapped.has(root)) return;
        wrapped.add(root);
        const original = root.onRecoverableError;
        root.onRecoverableError = function (error, info) {
          console.error('TRADINGLAB_RECOVERABLE_STACK', JSON.stringify({ pathname: location.pathname,
            message: String(error?.message), componentStack: info?.componentStack }));
          return original.apply(this, arguments);
        };
      },
      onCommitFiberUnmount() {},
    };
  });
};
