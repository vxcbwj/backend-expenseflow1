/**
 * Test suite for authMiddleware
 * Tests: C4 - User active status verification
 */

import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import authMiddleware from "../../../src/middleware/authMiddleware.js";
import User from "../../../src/models/user.js";
import jwt from "jsonwebtoken";

// Mock User model
jest.mock("../../../src/models/user.js");

// Mock config
jest.mock("../../../src/config/env.js", () => ({
  default: {
    jwt: {
      secret: "test-secret-key",
    },
  },
}));

describe("authMiddleware - C4: User Active Status Check", () => {
  let req, res, next, token;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Mock request/response
    req = {
      headers: {
        authorization: "",
      },
      user: null,
    };

    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    next = jest.fn();

    // Create valid JWT token
    token = jwt.sign(
      { userId: "507f1f77bcf86cd799439011" },
      "test-secret-key",
      { expiresIn: "7d" },
    );
  });

  describe("Active User Access", () => {
    it("should allow access for active users with valid token", async () => {
      req.headers.authorization = `Bearer ${token}`;

      const mockUser = {
        _id: "507f1f77bcf86cd799439011",
        email: "active@example.com",
        isActive: true,
        role: "manager",
        canAccessCompany: jest.fn().mockReturnValue(true),
      };

      User.findById.mockResolvedValue(mockUser);

      // Call middleware
      await authMiddleware(req, res, next);

      // Verify user was attached to request
      expect(req.user).toBeDefined();
      expect(req.user.isActive).toBe(true);
      expect(req.user.email).toBe("active@example.com");

      // Verify next() was called (access granted)
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe("Deactivated User Prevention (C4 Fix)", () => {
    it("should block access for deactivated users with valid token", async () => {
      req.headers.authorization = `Bearer ${token}`;

      const mockUser = {
        _id: "507f1f77bcf86cd799439011",
        email: "deactivated@example.com",
        isActive: false,
        role: "manager",
      };

      User.findById.mockResolvedValue(mockUser);

      // Call middleware
      await authMiddleware(req, res, next);

      // Verify 401 response was sent
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "USER_NOT_FOUND",
        error: expect.any(String),
      });

      // Verify next() was NOT called (access denied)
      expect(next).not.toHaveBeenCalled();
    });

    it("should use same error message for deactivated users as invalid token (prevent enumeration)", async () => {
      req.headers.authorization = `Bearer ${token}`;

      const mockUser = {
        _id: "507f1f77bcf86cd799439011",
        email: "deactivated@example.com",
        isActive: false,
        role: "manager",
      };

      User.findById.mockResolvedValue(mockUser);

      // Call middleware
      await authMiddleware(req, res, next);

      // Verify error message matches "user not found" pattern
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "USER_NOT_FOUND",
        }),
      );
    });

    it("should log deactivated login attempts for audit trail", async () => {
      const consoleLogSpy = jest.spyOn(console, "log").mockImplementation();

      req.headers.authorization = `Bearer ${token}`;

      const mockUser = {
        _id: "507f1f77bcf86cd799439011",
        email: "deactivated@example.com",
        isActive: false,
        role: "manager",
      };

      User.findById.mockResolvedValue(mockUser);

      // Call middleware
      await authMiddleware(req, res, next);

      // Verify log message
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("Deactivated user"),
      );

      consoleLogSpy.mockRestore();
    });
  });

  describe("Missing Token Handling", () => {
    it("should reject requests without authorization header", async () => {
      req.headers.authorization = "";

      await authMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: "No token provided",
        }),
      );
      expect(next).not.toHaveBeenCalled();
    });

    it("should reject requests with invalid token format", async () => {
      req.headers.authorization = "InvalidFormat token";

      await authMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });

    it("should reject requests with expired token", async () => {
      const expiredToken = jwt.sign(
        { userId: "507f1f77bcf86cd799439011" },
        "test-secret-key",
        { expiresIn: "0s" },
      );

      req.headers.authorization = `Bearer ${expiredToken}`;

      // Wait a moment to ensure token is expired
      await new Promise((resolve) => setTimeout(resolve, 100));

      await authMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe("User Not Found Handling", () => {
    it("should reject access when user is not found in database", async () => {
      req.headers.authorization = `Bearer ${token}`;
      User.findById.mockResolvedValue(null);

      await authMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "USER_NOT_FOUND",
        }),
      );
      expect(next).not.toHaveBeenCalled();
    });
  });
});
