// backend/src/middleware/authMiddleware.js
import jwt from "jsonwebtoken";
import User from "../models/user.js";

const DEBUG = process.env.NODE_ENV === "development";
const TOKEN_PREFIX = "Bearer ";

const ERROR_MESSAGES = {
  NO_TOKEN: "Authentication required. Please log in.",
  INVALID_TOKEN: "Invalid authentication token. Please log in again.",
  EXPIRED_TOKEN: "Your session has expired. Please log in again.",
  USER_NOT_FOUND: "User account not found. Please contact support.",
  SERVER_ERROR: "Authentication service temporarily unavailable.",
};

const createErrorResponse = (type, details = {}) => ({
  success: false,
  error: ERROR_MESSAGES[type] || "Authentication failed",
  code: `AUTH_${type}`,
  timestamp: new Date().toISOString(),
  ...(DEBUG && { details }),
});

const protect = async (req, res, next) => {
  const startTime = Date.now();

  try {
    if (DEBUG) {
      console.log("\n" + "═".repeat(50));
      console.log("🔐 AUTHENTICATION MIDDLEWARE STARTED");
      console.log("═".repeat(50));
    }

    const authHeader = req.header("Authorization");

    if (!authHeader) {
      if (DEBUG) console.log("❌ No Authorization header found");
      return res.status(401).json(createErrorResponse("NO_TOKEN"));
    }

    if (!authHeader.startsWith(TOKEN_PREFIX)) {
      if (DEBUG) console.log("❌ Invalid token format");
      return res.status(401).json(createErrorResponse("INVALID_TOKEN"));
    }

    const token = authHeader.replace(TOKEN_PREFIX, "").trim();

    if (!token) {
      if (DEBUG) console.log("❌ Token is empty");
      return res.status(401).json(createErrorResponse("NO_TOKEN"));
    }

    if (DEBUG) console.log("✅ Token extracted successfully");

    if (DEBUG) console.log("🔐 Verifying JWT token...");

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (jwtError) {
      if (jwtError.name === "TokenExpiredError") {
        return res.status(401).json(createErrorResponse("EXPIRED_TOKEN"));
      }
      return res.status(401).json(createErrorResponse("INVALID_TOKEN"));
    }

    if (!decoded.userId) {
      if (DEBUG) console.log("❌ Token missing userId");
      return res.status(401).json(createErrorResponse("INVALID_TOKEN"));
    }

    if (DEBUG) console.log("🔍 Looking up user by ID:", decoded.userId);

    const user = await User.findById(decoded.userId).select("-password");

    if (!user) {
      if (DEBUG) console.log("❌ User not found");
      return res.status(401).json(createErrorResponse("USER_NOT_FOUND"));
    }

    // ✅ FIXED C4: Check if user is active (not deactivated)
    if (!user.isActive) {
      if (DEBUG) console.log("❌ User account is deactivated:", user._id);
      console.warn(
        `⚠️  Deactivated user attempted login: ${user.email} (ID: ${user._id})`,
      );
      return res.status(401).json(createErrorResponse("USER_NOT_FOUND")); // Same response as invalid token to prevent enumeration
    }

    if (DEBUG) {
      console.log("✅ User found:", {
        id: user._id,
        email: user.email,
        globalRole: user.globalRole,
        companyId: user.companyId || "none",
      });
    }

    req.user = user;
    req.token = token;

    req.authInfo = {
      userId: user._id.toString(),
      email: user.email,
      globalRole: user.globalRole,
      companyId: user.companyId?.toString() || null,
      authenticatedAt: new Date().toISOString(),
    };

    const elapsedTime = Date.now() - startTime;

    if (DEBUG) {
      console.log("✅ AUTHENTICATION SUCCESSFUL");
      console.log("   User:", user.email);
      console.log("   Role:", user.globalRole);
      console.log("   Company:", user.companyId || "none");
      console.log("   Time:", elapsedTime + "ms");
      console.log("═".repeat(50) + "\n");
    }

    next();
  } catch (error) {
    const elapsedTime = Date.now() - startTime;
    console.error("❌ AUTHENTICATION CRITICAL ERROR:", error);

    return res.status(500).json({
      success: false,
      error: "Authentication failed",
      ...(DEBUG && { details: error.message }),
    });
  }
};

export const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json(createErrorResponse("NO_TOKEN"));
    }

    const userRole = req.user.globalRole;
    const normalizedUserRole = userRole ? userRole.toLowerCase() : null;
    const normalizedRoles = roles.map((role) => role.toLowerCase());

    if (!normalizedRoles.includes(normalizedUserRole)) {
      return res.status(403).json({
        success: false,
        error: `Required role: ${roles.join(" or ")}`,
        userRole: normalizedUserRole,
        code: "INSUFFICIENT_PERMISSIONS",
      });
    }

    next();
  };
};

export const requireCompanyAccess = (companyIdParam = "companyId") => {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json(createErrorResponse("NO_TOKEN"));
    }

    const companyId =
      req.params[companyIdParam] ||
      req.params.id ||
      req.body.companyId ||
      req.query.companyId;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        error: "Company ID is required",
        code: "MISSING_COMPANY_ID",
      });
    }

    if (!req.user.canAccessCompany(companyId)) {
      return res.status(403).json({
        success: false,
        error: "Access denied to this company",
        code: "COMPANY_ACCESS_DENIED",
        userCompanyId: req.user.companyId?.toString() || null,
        requestedCompanyId: companyId,
      });
    }

    req.companyId = companyId;
    next();
  };
};

export default protect;
