// backend/src/config/env.js

import dotenv from "dotenv";

// Load .env file
dotenv.config();

/**
 * Main configuration object
 */
const config = {
  // Server configuration
  server: {
    port: parseInt(process.env.PORT) || 5000,
    env: process.env.NODE_ENV || "development",
    nodeEnv: process.env.NODE_ENV || "development",
    frontendUrl: process.env.FRONTEND_URL || "http://localhost:5173",
    isProduction: process.env.NODE_ENV === "production",
    isDevelopment: process.env.NODE_ENV === "development",
    isTest: process.env.NODE_ENV === "test",
  },

  // Database configuration
  database: {
    uri: process.env.MONGODB_URI,
    options: {
      serverSelectionTimeoutMS: 5000,
      maxPoolSize: 10,
      minPoolSize: 2,
    },
  },

  // Shorthand for compatibility
  mongodb: {
    uri: process.env.MONGODB_URI,
  },

  // JWT configuration
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRE || "7d",
    algorithm: "HS256",
  },

  // Frontend configuration
  frontend: {
    url: process.env.FRONTEND_URL || "http://localhost:5173",
    corsOrigins: (
      process.env.CORS_ORIGINS || "http://localhost:5173,http://localhost:3000"
    )
      .split(",")
      .map((o) => o.trim()),
  },

  // Cloudinary configuration
  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    apiKey: process.env.CLOUDINARY_API_KEY,
    apiSecret: process.env.CLOUDINARY_API_SECRET,
    isConfigured: !!(
      process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET
    ),
  },

  // Email configuration
  email: {
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: parseInt(process.env.SMTP_PORT) || 587,
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    password: process.env.SMTP_PASS, // Alias for compatibility
    fromName:
      process.env.SMTP_FROM_NAME || process.env.APP_NAME || "ExpenseFlow",
    fromEmail: process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER,
    appName: process.env.APP_NAME || "ExpenseFlow",
    isConfigured: !!(process.env.SMTP_USER && process.env.SMTP_PASS),
  },

  // App configuration
  app: {
    name: process.env.APP_NAME || "ExpenseFlow",
    version: process.env.APP_VERSION || "1.0.0",
  },

  // Rate limiting configuration
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
    max: parseInt(process.env.RATE_LIMIT_MAX) || 100,
    loginMax: parseInt(process.env.LOGIN_RATE_LIMIT_MAX) || 5,
    registerMax: parseInt(process.env.REGISTER_RATE_LIMIT_MAX) || 3,
  },

  // Security configuration
  security: {
    bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS) || 12,
    cookieSecret:
      process.env.COOKIE_SECRET || "default-cookie-secret-change-in-production",
    corsOrigin: process.env.CORS_ORIGIN || process.env.FRONTEND_URL || "*",
  },
};

/**
 * Validate required environment variables
 * @throws {Error} If any required env var is missing
 */
export function validateConfig() {
  const required = [
    { key: "MONGODB_URI", value: config.database.uri, name: "Database URI" },
    { key: "JWT_SECRET", value: config.jwt.secret, name: "JWT Secret" },
  ];

  const missing = required.filter((item) => !item.value);

  if (missing.length > 0 && !config.server.isTest) {
    console.error("\n❌ CRITICAL: Missing required environment variables:\n");
    missing.forEach((item) => {
      console.error(`   - ${item.name} (${item.key})`);
    });
    console.error(
      "\nPlease check your .env file and ensure all required variables are set.\n",
    );
    throw new Error("Missing required environment variables");
  }

  // Validate JWT secret strength in production
  if (
    config.jwt.secret &&
    config.jwt.secret.length < 32 &&
    config.server.isProduction
  ) {
    console.warn(
      "\n⚠️  WARNING: JWT_SECRET should be at least 32 characters in production\n",
    );
  }

  // Log optional service warnings
  const warnings = [];

  if (!config.cloudinary.isConfigured) {
    warnings.push("Cloudinary not configured - file uploads will fail");
  }

  if (!config.email.isConfigured) {
    warnings.push("Email not configured - notifications will be disabled");
  }

  if (warnings.length > 0 && config.server.isDevelopment) {
    console.warn("\n⚠️  Optional services not configured:");
    warnings.forEach((w) => console.warn(`   - ${w}`));
    console.warn();
  }

  // Log configuration status in development
  if (config.server.isDevelopment) {
    console.log("📋 Configuration loaded:");
    console.log(`   Environment: ${config.server.nodeEnv}`);
    console.log(
      `   Database: ${config.database.uri ? "Configured ✓" : "Missing ✗"}`,
    );
    console.log(`   JWT: ${config.jwt.secret ? "Configured ✓" : "Missing ✗"}`);
    console.log(
      `   Cloudinary: ${config.cloudinary.isConfigured ? "Configured ✓" : "Not configured"}`,
    );
    console.log(
      `   Email: ${config.email.isConfigured ? "Configured ✓" : "Not configured"}`,
    );
  }
}

// Export default config object
export default config;

// Export convenience getters
export const getMongoUri = () => config.mongodb.uri;
export const getJwtSecret = () => config.jwt.secret;
export const getServerPort = () => config.server.port;
export const getCorsOrigins = () => config.frontend.corsOrigins;
export const isProduction = () => config.server.isProduction;
export const isDevelopment = () => config.server.isDevelopment;
