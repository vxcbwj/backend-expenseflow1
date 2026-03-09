/**
 * CORS configuration
 * Restricts API access to whitelisted origins
 */

import cors from "cors";
import config from "./env.js";

/**
 * Create CORS options with whitelisted origins
 * @returns {Object} CORS configuration object
 */
export const getCorsOptions = () => {
  const allowedOrigins = config.frontend.corsOrigins;

  return {
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"), false);
      }
    },
    credentials: true, // Allow cookies/auth headers
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    maxAge: 86400, // 24 hours
    optionsSuccessStatus: 200,
  };
};

/**
 * CORS error handler
 * Logs and responds to CORS violations
 */
export const corsErrorHandler = (err, req, res, next) => {
  if (err.message.includes("Not allowed by CORS")) {
    const origin = req.headers.origin || "unknown";
    console.warn(`⚠️  CORS violation from origin: ${origin}`);
    console.warn(
      `   Allowed origins: ${config.frontend.corsOrigins.join(", ")}`,
    );

    return res.status(403).json({
      success: false,
      error: "Access denied - CORS policy violation",
      details:
        process.env.NODE_ENV === "development"
          ? `Origin ${origin} is not whitelisted`
          : undefined,
    });
  }

  next(err);
};

/**
 * Create and return configured CORS middleware
 */
export const corsMiddleware = cors(getCorsOptions());

export default corsMiddleware;
