// backend/src/utils/AppError.js

/**
 * Operational error class for predictable, user-facing errors.
 * Extend this instead of throwing plain Error objects so the global
 * error handler can distinguish operational errors (4xx / known 5xx)
 * from unexpected programmer errors and respond appropriately.
 *
 * Usage:
 *   throw new AppError('Expense not found', 404);
 *   throw new AppError('You must be assigned to a company', 400);
 */
class AppError extends Error {
  /**
   * @param {string} message  - Human-readable error message sent to the client
   * @param {number} statusCode - HTTP status code (4xx or 5xx)
   */
  constructor(message, statusCode) {
    super(message);

    this.statusCode = statusCode;
    // 'fail' for client errors (4xx), 'error' for server errors (5xx)
    this.status = `${statusCode}`.startsWith("4") ? "fail" : "error";
    // Flag that marks this as a known, intentional error — not a bug
    this.isOperational = true;

    // Capture stack trace excluding this constructor call for cleaner output
    Error.captureStackTrace(this, this.constructor);
  }
}

export default AppError;
