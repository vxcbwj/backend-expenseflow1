/**
 * Rate limiting middleware configuration
 * Protects against brute force and DoS attacks
 */

import rateLimit from "express-rate-limit";

/**
 * Login rate limiter
 * 5 attempts per 15 minutes per IP
 */
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  message: {
    success: false,
    error: "Too many login attempts, please try again later",
    retryAfter: "15 minutes",
  },
  statusCode: 429,
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
  keyGenerator: (req) => {
    // Use IP address for rate limiting
    return req.ip || req.connection.remoteAddress;
  },
  skip: (req) => {
    // Don't rate limit in test environments
    return process.env.NODE_ENV === "test";
  },
});

/**
 * Register rate limiter
 * 3 attempts per hour per IP
 */
export const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3,
  message: {
    success: false,
    error: "Too many registration attempts, please try again later",
    retryAfter: "1 hour",
  },
  statusCode: 429,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip || req.connection.remoteAddress,
  skip: (req) => process.env.NODE_ENV === "test",
});

/**
 * General API rate limiter
 * 100 requests per minute per IP
 */
export const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100,
  message: {
    success: false,
    error: "Too many requests, please try again later",
  },
  statusCode: 429,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Use user ID if authenticated, otherwise use IP
    return req.user?._id?.toString() || req.ip || req.connection.remoteAddress;
  },
  skip: (req) => process.env.NODE_ENV === "test",
});

/**
 * Strict API rate limiter for sensitive operations
 * 10 requests per minute per user/IP
 */
export const strictLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 10,
  message: {
    success: false,
    error: "Too many requests to this endpoint",
  },
  statusCode: 429,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.user?._id?.toString() || req.ip || req.connection.remoteAddress;
  },
  skip: (req) => process.env.NODE_ENV === "test",
});

export default {
  loginLimiter,
  registerLimiter,
  apiLimiter,
  strictLimiter,
};
