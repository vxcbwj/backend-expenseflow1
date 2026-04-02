// backend/src/controllers/invitationController.js
import User from "../models/user.js";
import Company from "../models/company.js";
import Invitation from "../models/invitation.js";
import { auditLogger } from "../utils/auditLogger.js";
import { sendInvitationEmail } from "../utils/emailService.js";
import catchAsync from "../utils/catchAsync.js";
import AppError from "../utils/AppError.js";

// POST /api/invitations/send
export const sendInvitation = catchAsync(async (req, res, next) => {
  const { email, message } = req.body;

  if (!email) return next(new AppError("Email is required", 400));
  if (!req.user.companyId) return next(new AppError("You must create a company first", 400));

  const existingUser = await User.findOne({ email: email.toLowerCase() });
  if (existingUser) return next(new AppError("User with this email already exists", 400));

  const existingInvitation = await Invitation.findPendingByEmail(email, req.user.companyId);
  if (existingInvitation) return next(new AppError("Invitation already sent to this email", 400));

  const invitation = await Invitation.create({
    email: email.toLowerCase(),
    companyId: req.user.companyId,
    invitedBy: req.user._id,
    role: "manager",
    message,
  });

  await auditLogger.invitationSent(
    invitation._id,
    req.user._id,
    { email: invitation.email, role: invitation.role, expiresAt: invitation.expiresAt },
    req.user.companyId
  );

  try {
    const company = await Company.findById(req.user.companyId);
    await sendInvitationEmail(
      invitation.email,
      invitation.token,
      `${req.user.firstName} ${req.user.lastName}`,
      company?.name || "ExpenseFlow"
    );
  } catch (emailError) {
    console.error("Failed to send invitation email (non-blocking):", emailError);
  }

  console.log("📧 Invitation created:", {
    email: invitation.email,
    companyId: invitation.companyId,
    link: invitation.getInvitationLink(),
  });

  res.status(201).json({
    success: true,
    message: "Invitation sent successfully",
    invitation: {
      id: invitation._id,
      email: invitation.email,
      expiresAt: invitation.expiresAt,
      invitationLink: invitation.getInvitationLink(),
    },
  });
});

// GET /api/invitations
export const getInvitations = catchAsync(async (req, res) => {
  if (!req.user.companyId) {
    return res.json({ success: true, invitations: [] });
  }

  const invitations = await Invitation.findByCompany(req.user.companyId);

  res.json({ success: true, invitations, count: invitations.length });
});

// GET /api/invitations/verify/:token
export const verifyInvitation = catchAsync(async (req, res, next) => {
  const { token } = req.params;

  const invitation = await Invitation.findActiveByToken(token)
    .populate("companyId", "name industry logo")
    .populate("invitedBy", "firstName lastName email");

  if (!invitation) return next(new AppError("Invalid or expired invitation", 404));

  res.json({
    success: true,
    invitation: {
      email: invitation.email,
      role: invitation.role,
      company: invitation.companyId,
      invitedBy: invitation.invitedBy,
      expiresAt: invitation.expiresAt,
      message: invitation.message,
    },
  });
});

// POST /api/invitations/resend/:id
export const resendInvitation = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  const invitation = await Invitation.findById(id);
  if (!invitation) return next(new AppError("Invitation not found", 404));

  if (invitation.companyId.toString() !== req.user.companyId?.toString()) {
    return next(new AppError("Access denied", 403));
  }

  await invitation.regenerateToken();

  await auditLogger.invitationSent(
    invitation._id,
    req.user._id,
    { email: invitation.email, role: invitation.role, action: "resent", expiresAt: invitation.expiresAt },
    req.user.companyId
  );

  console.log("📧 Invitation resent:", { email: invitation.email, link: invitation.getInvitationLink() });

  res.json({
    success: true,
    message: "Invitation resent successfully",
    invitation: {
      id: invitation._id,
      email: invitation.email,
      expiresAt: invitation.expiresAt,
      invitationLink: invitation.getInvitationLink(),
    },
  });
});

// POST /api/invitations/revoke/:id
export const revokeInvitation = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  const invitation = await Invitation.findById(id);
  if (!invitation) return next(new AppError("Invitation not found", 404));

  if (invitation.companyId.toString() !== req.user.companyId?.toString()) {
    return next(new AppError("Access denied", 403));
  }

  await invitation.revoke();

  await auditLogger.invitationRevoked(invitation._id, req.user._id, req.user.companyId);

  res.json({ success: true, message: "Invitation revoked successfully" });
});

// DELETE /api/invitations/managers/:managerId
export const removeManager = catchAsync(async (req, res, next) => {
  const { managerId } = req.params;

  const manager = await User.findById(managerId);
  if (!manager) return next(new AppError("Manager not found", 404));

  if (manager.companyId?.toString() !== req.user.companyId?.toString()) {
    return next(new AppError("Access denied", 403));
  }

  if (manager.globalRole !== "manager") {
    return next(new AppError("Can only remove managers", 400));
  }

  const company = await Company.findById(req.user.companyId);
  if (company) await company.removeManager(managerId);

  await manager.removeFromCompany();

  await auditLogger.userUpdated(
    manager._id,
    req.user._id,
    { action: "removed_from_company", companyId: req.user.companyId },
    req.user.companyId
  );

  res.json({ success: true, message: "Manager removed from company" });
});
