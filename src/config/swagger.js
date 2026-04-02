// backend/src/config/swagger.js
import swaggerJsdoc from "swagger-jsdoc";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "ExpenseFlow API",
      version: "1.0.0",
      description:
        "REST API for ExpenseFlow — multi-company expense management platform. " +
        "All protected routes require a Bearer JWT token in the Authorization header.",
      contact: {
        name: "ExpenseFlow Support",
      },
    },
    servers: [
      {
        url: "http://localhost:5000",
        description: "Local development server",
      },
    ],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description: "JWT token obtained from POST /api/auth/login",
        },
      },
      schemas: {
        SuccessResponse: {
          type: "object",
          properties: {
            success: { type: "boolean", example: true },
            message: { type: "string" },
          },
        },
        ErrorResponse: {
          type: "object",
          properties: {
            success: { type: "boolean", example: false },
            error: { type: "string" },
          },
        },
        User: {
          type: "object",
          properties: {
            _id: { type: "string" },
            email: { type: "string", format: "email" },
            firstName: { type: "string" },
            lastName: { type: "string" },
            globalRole: { type: "string", enum: ["admin", "manager"] },
            companyId: { type: "string", nullable: true },
            isActive: { type: "boolean" },
          },
        },
        Expense: {
          type: "object",
          properties: {
            _id: { type: "string" },
            amount: { type: "number" },
            category: { type: "string" },
            department: { type: "string" },
            description: { type: "string" },
            date: { type: "string", format: "date-time" },
            status: {
              type: "string",
              enum: ["pending", "approved", "rejected", "paid"],
            },
            companyId: { type: "string" },
            userId: { type: "string" },
          },
        },
        Budget: {
          type: "object",
          properties: {
            _id: { type: "string" },
            category: { type: "string" },
            amount: { type: "number" },
            currentSpending: { type: "number" },
            period: { type: "string", enum: ["monthly", "quarterly", "yearly"] },
            isActive: { type: "boolean" },
            companyId: { type: "string" },
          },
        },
        Company: {
          type: "object",
          properties: {
            _id: { type: "string" },
            name: { type: "string" },
            industry: { type: "string" },
            currency: { type: "string" },
            isActive: { type: "boolean" },
          },
        },
        Invitation: {
          type: "object",
          properties: {
            _id: { type: "string" },
            email: { type: "string", format: "email" },
            role: { type: "string" },
            status: { type: "string", enum: ["pending", "accepted", "revoked"] },
            expiresAt: { type: "string", format: "date-time" },
          },
        },
        AuditLog: {
          type: "object",
          properties: {
            _id: { type: "string" },
            action: { type: "string" },
            entity: { type: "string" },
            userId: { type: "string" },
            companyId: { type: "string" },
            timestamp: { type: "string", format: "date-time" },
          },
        },
      },
    },
    security: [{ BearerAuth: [] }],
  },
  apis: [join(__dirname, "../routes/*.js")],
};

const swaggerSpec = swaggerJsdoc(options);

export default swaggerSpec;
