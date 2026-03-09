// backend/src/routes/invitations.js - WITH AUDIT LOGGING
import express from "express";
import User from "../models/user.js";
import Company from "../models/company.js";
import Invitation from "../models/invitation.js";
import protect from "../middleware/authMiddleware.js";
import { requireAdmin } from "../utils/roles.js";
import { auditLogger } from "../utils/auditLogger.js";
import { sendInvitationEmail } from "../utils/emailService.js";

const router = express.Router();

// POST /api/invitations/send - Admin invites manager
router.post("/send", protect, requireAdmin, async (req, res) => {
  try {
    const { email, message } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: "Email is required",
      });
    }

    if (!req.user.companyId) {
      return res.status(400).json({
        success: false,
        error: "You must create a company first",
      });
    }

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: "User with this email already exists",
      });
    }

    const existingInvitation = await Invitation.findPendingByEmail(
      email,
      req.user.companyId
    );

    if (existingInvitation) {
      return res.status(400).json({
        success: false,
        error: "Invitation already sent to this email",
      });
    }

    const invitation = await Invitation.create({
      email: email.toLowerCase(),
      companyId: req.user.companyId,
      invitedBy: req.user._id,
      role: "manager",
      message,
    });

    // Audit log
    await auditLogger.invitationSent(
      invitation._id,
      req.user._id,
      {
        email: invitation.email,
        role: invitation.role,
        expiresAt: invitation.expiresAt,
      },
      req.user.companyId
    );

    // Send invitation email (non-blocking)
    try {
      const company = await Company.findById(req.user.companyId);

      await sendInvitationEmail(
        invitation.email,
        invitation.token,
        `${req.user.firstName} ${req.user.lastName}`,
        company?.name || 'ExpenseFlow'
      );
    } catch (emailError) {
      console.error('Failed to send invitation email (non-blocking):', emailError);
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
  } catch (error) {
    console.error("Send invitation error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to send invitation",
    });
  }
});

// GET /api/invitations - Get all invitations (Admin only)
router.get("/", protect, requireAdmin, async (req, res) => {
  try {
    if (!req.user.companyId) {
      return res.json({
        success: true,
        invitations: [],
      });
    }

    const invitations = await Invitation.findByCompany(req.user.companyId);

    res.json({
      success: true,
      invitations,
      count: invitations.length,
    });
  } catch (error) {
    console.error("Get invitations error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch invitations",
    });
  }
});

// GET /api/invitations/verify/:token - Verify invitation token
router.get("/verify/:token", async (req, res) => {
  try {
    const { token } = req.params;

    const invitation = await Invitation.findActiveByToken(token)
      .populate("companyId", "name industry logo")
      .populate("invitedBy", "firstName lastName email");

    if (!invitation) {
      return res.status(404).json({
        success: false,
        error: "Invalid or expired invitation",
      });
    }

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
  } catch (error) {
    console.error("Verify invitation error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to verify invitation",
    });
  }
});

// POST /api/invitations/resend/:id - Resend invitation
router.post("/resend/:id", protect, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const invitation = await Invitation.findById(id);

    if (!invitation) {
      return res.status(404).json({
        success: false,
        error: "Invitation not found",
      });
    }

    if (invitation.companyId.toString() !== req.user.companyId?.toString()) {
      return res.status(403).json({
        success: false,
        error: "Access denied",
      });
    }

    await invitation.regenerateToken();

    // Audit log
    await auditLogger.invitationSent(
      invitation._id,
      req.user._id,
      {
        email: invitation.email,
        role: invitation.role,
        action: "resent",
        expiresAt: invitation.expiresAt,
      },
      req.user.companyId
    );

    console.log("📧 Invitation resent:", {
      email: invitation.email,
      link: invitation.getInvitationLink(),
    });

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
  } catch (error) {
    console.error("Resend invitation error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to resend invitation",
    });
  }
});

// POST /api/invitations/revoke/:id - Revoke invitation
router.post("/revoke/:id", protect, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const invitation = await Invitation.findById(id);

    if (!invitation) {
      return res.status(404).json({
        success: false,
        error: "Invitation not found",
      });
    }

    if (invitation.companyId.toString() !== req.user.companyId?.toString()) {
      return res.status(403).json({
        success: false,
        error: "Access denied",
      });
    }

    await invitation.revoke();

    // Audit log
    await auditLogger.invitationRevoked(
      invitation._id,
      req.user._id,
      req.user.companyId
    );

    res.json({
      success: true,
      message: "Invitation revoked successfully",
    });
  } catch (error) {
    console.error("Revoke invitation error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to revoke invitation",
    });
  }
});

// DELETE /api/invitations/managers/:managerId - Remove manager (Admin only)
router.delete(
  "/managers/:managerId",
  protect,
  requireAdmin,
  async (req, res) => {
    try {
      const { managerId } = req.params;

      const manager = await User.findById(managerId);
      if (!manager) {
        return res.status(404).json({
          success: false,
          error: "Manager not found",
        });
      }

      if (manager.companyId?.toString() !== req.user.companyId?.toString()) {
        return res.status(403).json({
          success: false,
          error: "Access denied",
        });
      }

      if (manager.globalRole !== "manager") {
        return res.status(400).json({
          success: false,
          error: "Can only remove managers",
        });
      }

      const company = await Company.findById(req.user.companyId);
      if (company) {
        await company.removeManager(managerId);
      }

      await manager.removeFromCompany();

      // Audit log
      await auditLogger.userUpdated(
        manager._id,
        req.user._id,
        {
          action: "removed_from_company",
          companyId: req.user.companyId,
        },
        req.user.companyId
      );

      res.json({
        success: true,
        message: "Manager removed from company",
      });
    } catch (error) {
      console.error("Remove manager error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to remove manager",
      });
    }
  }
);

export default router;
