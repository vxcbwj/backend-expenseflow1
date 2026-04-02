// backend/src/utils/catchAsync.js

/**
 * Async error wrapper for Express route handlers.
 * Eliminates repetitive try/catch boilerplate by forwarding any
 * rejected promise to Express's next() error handler, where the
 * global error handler in server.js takes over.
 *
 * Usage:
 *   export const myHandler = catchAsync(async (req, res, next) => {
 *     // No try/catch needed — errors bubble to the global handler
 *     const data = await SomeModel.find(...);
 *     res.json({ success: true, data });
 *   });
 *
 * @param {Function} fn - Async Express handler (req, res, next)
 * @returns {Function} Express middleware that catches async errors
 */
const catchAsync = (fn) => (req, res, next) =>
  fn(req, res, next).catch(next);

export default catchAsync;
