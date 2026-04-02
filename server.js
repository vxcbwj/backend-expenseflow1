import express from "express";
import mongoose from "mongoose";
import helmet from "helmet";
import mongoSanitize from "express-mongo-sanitize";
import swaggerUi from "swagger-ui-express";
import swaggerSpec from "./src/config/swagger.js";

// ✅ FIXED: Import config FIRST before anything else
import config, { validateConfig } from "./src/config/env.js";
import corsMiddleware from "./src/config/cors.js";
import {
  apiLimiter,
  loginLimiter,
  registerLimiter,
} from "./src/middleware/rateLimiter.js";

// ✅ ADDED: Validate configuration on startup
validateConfig();

process.env.MONGOOSE_DRIVER_SILENT = "true";

// Route imports
import authRoutes from "./src/routes/auth.js";
import expenseRoutes from "./src/routes/expenses.js";
import companyRoutes from "./src/routes/companies.js";
import analyticsRoutes from "./src/routes/analytics.js";
import budgetRoutes from "./src/routes/budgets.js";
import invitationRoutes from "./src/routes/invitations.js";
import auditLogRoutes from "./src/routes/auditLogs.js";

const app = express();
mongoose.set("strictQuery", false);
process.env.SUPPRESS_NO_CONFIG_WARNING = "true";

// ✅ FIXED: Apply CORS before all other middleware (with whitelist)
app.use(corsMiddleware);

app.use(helmet());
app.use(mongoSanitize());

// Middleware
app.use(express.json());

// ✅ FIXED: Apply global API rate limiting (with test environment bypass)
if (process.env.NODE_ENV !== "test") {
  app.use("/api/", apiLimiter);
}

// MongoDB Connection
const connectDB = async () => {
  try {
    console.log("🔄 Connecting to MongoDB...");

    await mongoose.connect(config.mongodb.uri, {
      serverSelectionTimeoutMS: 5000,
    });

    console.log("✅ MongoDB Connected Successfully!");

    // Event listeners
    mongoose.connection.on("error", (err) => {
      console.error("❌ MongoDB connection error:", err);
    });

    mongoose.connection.on("disconnected", () => {
      console.log("⚠️ MongoDB disconnected");
    });
  } catch (error) {
    console.error("❌ MongoDB Connection Failed:");
    console.error("   Error:", error.message);

    if (error.message.includes("queryTxt ETIMEOUT")) {
      console.log("\n💡 DNS Resolution Issue Detected!");
      console.log("   Try these solutions:");
      console.log("   1. Check your internet connection");
      console.log("   2. Use mobile hotspot if available");
      console.log("   3. Restart your router");
      console.log("   4. Try again in a few minutes");
    }

    process.exit(1);
  }
};

// Connect to database
connectDB();

// ✅ Swagger UI — development only
if (config.server.env !== "production") {
  app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
}

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/expenses", expenseRoutes);
app.use("/api/companies", companyRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/budgets", budgetRoutes);
app.use("/api/invitations", invitationRoutes);
app.use("/api/audit-logs", auditLogRoutes);

// Health check
app.get("/health", (req, res) => {
  const dbState = mongoose.connection.readyState;
  // 1 = connected, anything else = not ready
  if (dbState !== 1) {
    return res.status(503).json({
      status: "UNAVAILABLE",
      database: "disconnected",
      timestamp: new Date().toISOString(),
    });
  }
  res.json({
    status: "OK",
    timestamp: new Date().toISOString(),
    database: "connected",
    uptime: process.uptime(),
  });
});

// Welcome route
app.get("/", (req, res) => {
  res.json({
    message: "ExpenseFlow Backend API",
    version: "1.0.0",
    status: "running",
    endpoints: {
      auth: "/api/auth",
      expenses: "/api/expenses",
      companies: "/api/companies",
      analytics: "/api/analytics",
      budgets: "/api/budgets",
      invitations: "/api/invitations",
      auditLogs: "/api/audit-logs",
      docs: config.server.env !== "production" ? "/api/docs" : null,
    },
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: `Route ${req.method} ${req.url} not found`,
  });
});

// ✅ Global error handler — distinguishes operational vs unexpected errors
app.use((err, req, res, next) => {
  // Log all errors server-side
  console.error("Server error:", err);

  // Operational errors: known, intentional (thrown via AppError)
  if (err.isOperational) {
    return res.status(err.statusCode).json({
      success: false,
      status: err.status,
      error: err.message,
      ...(config.server.isDevelopment && { stack: err.stack }),
    });
  }

  // Unexpected / programmer errors: don't leak details to client
  res.status(500).json({
    success: false,
    status: "error",
    error: "Internal server error",
    ...(config.server.isDevelopment && {
      details: err.message,
      stack: err.stack,
    }),
  });
});

// Start server
const PORT = config.server.port;
const server = app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`🌐 http://localhost:${PORT}`);
  console.log(`📊 Health: http://localhost:${PORT}/health`);
  console.log(`🔒 Environment: ${config.server.env}`);
  console.log(`🌍 CORS Origins: ${config.frontend.corsOrigins.join(", ")}`);
  if (config.server.env !== "production") {
    console.log(`📚 Swagger UI: http://localhost:${PORT}/api/docs`);
  }
});

// Graceful shutdown
const shutdown = (signal) => {
  console.log(`\n⚠️  Received ${signal}. Shutting down...`);

  server.close(async () => {
    console.log("🔌 HTTP server closed");

    try {
      await mongoose.connection.close();
      console.log("🔌 MongoDB connection closed");
      process.exit(0);
    } catch (err) {
      console.error("Error closing MongoDB:", err);
      process.exit(1);
    }
  });

  // Force shutdown after 10 seconds
  setTimeout(() => {
    console.error("⚠️  Forcing shutdown...");
    process.exit(1);
  }, 10000);
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

// Handle unhandled rejections
process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
});

export default app;
