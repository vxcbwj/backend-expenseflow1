// backend/src/controllers/authController.js
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import User from "../models/user.js";
import Company from "../models/company.js";
import Invitation from "../models/invitation.js";
import { auditLogger } from "../utils/auditLogger.js";
import config from "../config/env.js";
import catchAsync from "../utils/catchAsync.js";
import AppError from "../utils/AppError.js";

const generateToken = (userId) =>
  jwt.sign({ userId }, config.jwt.secret, { expiresIn: config.jwt.expiresIn });

const validatePassword = (password) => {
  if (!password || typeof password !== "string") return "Password is required";
  if (password.length < 8) return "Password must be at least 8 characters";
  if (!/[A-Za-z]/.test(password)) return "Password must contain at least one letter";
  if (!/[0-9]/.test(password)) return "Password must contain at least one number";
  return null;
};

// POST /api/auth/register
export const register = catchAsync(async (req, res, next) => {
  const { email, password, firstName, lastName, phone, registerAsAdmin, invitationToken } = req.body;

  if (!email || !password || !firstName || !lastName) {
    return next(new AppError("Email, password, first name, and last name are required", 400));
  }

  const passwordError = validatePassword(password);
  if (passwordError) return next(new AppError(passwordError, 400));

  const existingUser = await User.findOne({ email: email.toLowerCase() });
  if (existingUser) return next(new AppError("User already exists", 400));

  let role = "manager";
  let companyId = null;
  let invitation = null;

  if (registerAsAdmin) role = "admin";

  if (invitationToken) {
    invitation = await Invitation.findOne({
      token: invitationToken,
      status: "pending",
      expiresAt: { $gt: new Date() },
    });

    if (!invitation) return next(new AppError("Invalid or expired invitation", 400));

    if (invitation.email.toLowerCase() !== email.toLowerCase()) {
      return next(new AppError("Email doesn't match invitation", 400));
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
    if (company) await company.addManager(user._id);
    await auditLogger.invitationAccepted(invitation._id, user._id, companyId);
  }

  await auditLogger.userCreated(
    user._id,
    user._id,
    { email: user.email, role: user.globalRole, registrationType: registerAsAdmin ? "admin" : "manager_invitation" },
    companyId
  );

  const token = generateToken(user._id);

  console.log("✅ User registered:", { email: user.email, role: user.globalRole, companyId: user.companyId });

  res.status(201).json({
    success: true,
    message: "User registered successfully",
    token,
    user: user.toSafeObject(),
    nextStep: role === "admin" ? "create_company" : "complete",
  });
});

// POST /api/auth/login
export const login = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;

  if (!email || !password) return next(new AppError("Email and password are required", 400));

  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) return next(new AppError("Invalid email or password", 401));

  const isPasswordValid = await bcrypt.compare(password, user.password);
  if (!isPasswordValid) return next(new AppError("Invalid email or password", 401));

  if (!user.isActive) return next(new AppError("Invalid email or password", 401));

  await auditLogger.login(user._id, user.companyId, req.ip, req.get("user-agent"));

  const token = generateToken(user._id);

  console.log("✅ Login successful:", user.email);

  res.json({ success: true, message: "Login successful", token, user: user.toSafeObject() });
});

// GET /api/auth/profile
export const getProfile = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.user._id)
    .select("-password")
    .populate("companyId", "name industry logo currency");

  if (!user) return next(new AppError("User not found", 404));

  res.json({ success: true, user: user.toSafeObject() });
});

// PUT /api/auth/profile
export const updateProfile = catchAsync(async (req, res, next) => {
  const { firstName, lastName, phone, preferences, avatar } = req.body;

  const user = await User.findById(req.user._id);
  if (!user) return next(new AppError("User not found", 404));

  const changes = {};
  if (firstName && firstName !== user.firstName) { changes.firstName = { from: user.firstName, to: firstName }; user.firstName = firstName; }
  if (lastName && lastName !== user.lastName) { changes.lastName = { from: user.lastName, to: lastName }; user.lastName = lastName; }
  if (phone !== undefined && phone !== user.phone) { changes.phone = { from: user.phone, to: phone }; user.phone = phone; }
  if (avatar !== undefined && avatar !== user.avatar) { changes.avatar = { from: user.avatar, to: avatar }; user.avatar = avatar; }
  if (preferences) {
    changes.preferences = { from: user.preferences, to: { ...user.preferences, ...preferences } };
    user.preferences = { ...user.preferences, ...preferences };
  }

  await user.save();

  if (Object.keys(changes).length > 0) {
    await auditLogger.userUpdated(user._id, user._id, changes, user.companyId);
  }

  res.json({ success: true, message: "Profile updated successfully", user: user.toSafeObject() });
});

// PUT /api/auth/password
export const changePassword = catchAsync(async (req, res, next) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return next(new AppError("Current password and new password are required", 400));
  }

  const passwordError = validatePassword(newPassword);
  if (passwordError) return next(new AppError(passwordError, 400));

  const user = await User.findById(req.user._id);
  if (!user) return next(new AppError("User not found", 404));

  const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
  if (!isPasswordValid) return next(new AppError("Current password is incorrect", 401));

  const hashedPassword = await bcrypt.hash(newPassword, 12);
  user.password = hashedPassword;
  await user.save();

  await auditLogger.userUpdated(
    user._id,
    user._id,
    { action: "password_changed", timestamp: new Date().toISOString() },
    user.companyId
  );

  res.json({ success: true, message: "Password updated successfully" });
});
