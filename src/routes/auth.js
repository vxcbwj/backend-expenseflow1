// backend/src/routes/auth.js - WITH AUDIT LOGGING AND RATE LIMITING
import express from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import User from "../models/user.js";
import Company from "../models/company.js";
import Invitation from "../models/invitation.js";
import protect from "../middleware/authMiddleware.js";
import { auditLogger } from "../utils/auditLogger.js";
import { loginLimiter, registerLimiter } from "../middleware/rateLimiter.js";
import config from "../config/env.js";

// ✅ FIX: Removed unused "import { register } from 'module'" that was present
//         in the original file — it imported nothing useful and could cause
//         subtle conflicts depending on the Node version.

const router = express.Router();

const generateToken = (userId) => {
  return jwt.sign({ userId }, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn,
  });
};

const validatePassword = (password) => {
  if (!password || typeof password !== "string") return "Password is required";
  if (password.length < 8) return "Password must be at least 8 characters";
  if (!/[A-Za-z]/.test(password))
    return "Password must contain at least one letter";
  if (!/[0-9]/.test(password))
    return "Password must contain at least one number";
  return null; // null means valid
};

// POST /api/auth/register
router.post("/register", registerLimiter, async (req, res) => {
  try {
    const {
      email,
      password,
      firstName,
      lastName,
      phone,
      registerAsAdmin,
      invitationToken,
    } = req.body;

    if (!email || !password || !firstName || !lastName) {
      return res.status(400).json({
        success: false,
        error: "Email, password, first name, and last name are required",
      });
    }

    const passwordError = validatePassword(password);
    if (passwordError)
      return res.status(400).json({ success: false, error: passwordError });

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: "User already exists",
      });
    }

    let role = "manager";
    let companyId = null;
    let invitation = null;

    if (registerAsAdmin) {
      role = "admin";
    }

    if (invitationToken) {
      invitation = await Invitation.findOne({
        token: invitationToken,
        status: "pending",
        expiresAt: { $gt: new Date() },
      });

      if (!invitation) {
        return res.status(400).json({
          success: false,
          error: "Invalid or expired invitation",
        });
      }

      if (invitation.email.toLowerCase() !== email.toLowerCase()) {
        return res.status(400).json({
          success: false,
          error: "Email doesn't match invitation",
        });
      }

      companyId = invitation.companyId;
      role = "manager";
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await User.create({
      email: email.toLowerCase(),
      password: hashedPassword,
      firstName,
      lastName,
      phone,
      globalRole: role,
      companyId,
      joinedCompanyAt: companyId ? new Date() : null,
    });

    if (invitation) {
      await invitation.accept(user._id);

      const company = await Company.findById(companyId);
      if (company) {
        await company.addManager(user._id);
      }

      await auditLogger.invitationAccepted(invitation._id, user._id, companyId);
    }

    await auditLogger.userCreated(
      user._id,
      user._id,
      {
        email: user.email,
        role: user.globalRole,
        registrationType: registerAsAdmin ? "admin" : "manager_invitation",
      },
      companyId,
    );

    const token = generateToken(user._id);

    console.log("✅ User registered:", {
      email: user.email,
      role: user.globalRole,
      companyId: user.companyId,
    });

    res.status(201).json({
      success: true,
      message: "User registered successfully",
      token,
      user: user.toSafeObject(),
      nextStep: role === "admin" ? "create_company" : "complete",
    });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({
      success: false,
      error: "Registration failed",
    });
  }
});

// POST /api/auth/login
router.post("/login", loginLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: "Email and password are required",
      });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json({
        success: false,
        error: "Invalid email or password",
      });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        error: "Invalid email or password",
      });
    }

    // ✅ FIX: isActive check moved BEFORE the audit log so deactivated users
    //         with correct credentials are not recorded as successful logins.
    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        error: "Invalid email or password",
      });
    }

    // Audit log only reaches here for genuinely successful logins
    await auditLogger.login(
      user._id,
      user.companyId,
      req.ip,
      req.get("user-agent"),
    );

    const token = generateToken(user._id);

    console.log("✅ Login successful:", user.email);

    res.json({
      success: true,
      message: "Login successful",
      token,
      user: user.toSafeObject(),
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({
      success: false,
      error: "Login failed",
    });
  }
});

// GET /api/auth/profile
router.get("/profile", protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .select("-password")
      .populate("companyId", "name industry logo currency");

    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    res.json({
      success: true,
      user: user.toSafeObject(),
    });
  } catch (error) {
    console.error("Profile error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch profile",
    });
  }
});

// PUT /api/auth/profile
router.put("/profile", protect, async (req, res) => {
  try {
    const { firstName, lastName, phone, preferences, avatar } = req.body;

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    const changes = {};
    if (firstName && firstName !== user.firstName) {
      changes.firstName = { from: user.firstName, to: firstName };
      user.firstName = firstName;
    }
    if (lastName && lastName !== user.lastName) {
      changes.lastName = { from: user.lastName, to: lastName };
      user.lastName = lastName;
    }
    if (phone !== undefined && phone !== user.phone) {
      changes.phone = { from: user.phone, to: phone };
      user.phone = phone;
    }
    if (avatar !== undefined && avatar !== user.avatar) {
      changes.avatar = { from: user.avatar, to: avatar };
      user.avatar = avatar;
    }
    if (preferences) {
      changes.preferences = {
        from: user.preferences,
        to: { ...user.preferences, ...preferences },
      };
      user.preferences = { ...user.preferences, ...preferences };
    }

    await user.save();

    if (Object.keys(changes).length > 0) {
      await auditLogger.userUpdated(
        user._id,
        user._id,
        changes,
        user.companyId,
      );
    }

    res.json({
      success: true,
      message: "Profile updated successfully",
      user: user.toSafeObject(),
    });
  } catch (error) {
    console.error("Update profile error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to update profile",
    });
  }
});

// PUT /api/auth/password
router.put("/password", protect, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        error: "Current password and new password are required",
      });
    }

    const passwordError = validatePassword(newPassword);
    if (passwordError)
      return res.status(400).json({ success: false, error: passwordError });

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    const isPasswordValid = await bcrypt.compare(
      currentPassword,
      user.password,
    );
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        error: "Current password is incorrect",
      });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);
    user.password = hashedPassword;
    await user.save();

    await auditLogger.userUpdated(
      user._id,
      user._id,
      {
        action: "password_changed",
        timestamp: new Date().toISOString(),
      },
      user.companyId,
    );

    res.json({
      success: true,
      message: "Password updated successfully",
    });
  } catch (error) {
    console.error("Change password error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to change password",
    });
  }
});

export default router;
