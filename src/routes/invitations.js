// backend/src/routes/invitations.js
import express from "express";
import protect from "../middleware/authMiddleware.js";
import { requireAdmin } from "../utils/roles.js";
import {
  sendInvitation,
  getInvitations,
  verifyInvitation,
  resendInvitation,
  revokeInvitation,
  removeManager,
} from "../controllers/invitationController.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Invitations
 *   description: Manager invitation management
 */

/**
 * @swagger
 * /api/invitations/send:
 *   post:
 *     summary: Send an invitation to a new manager (Admin only)
 *     tags: [Invitations]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email: { type: string, format: email }
 *               message: { type: string }
 *     responses:
 *       201:
 *         description: Invitation sent successfully
 *       400:
 *         description: Validation error or invitation already sent
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Admin role required
 *       500:
 *         description: Internal server error
 */
router.post("/send", protect, requireAdmin, sendInvitation);

/**
 * @swagger
 * /api/invitations:
 *   get:
 *     summary: Get all invitations for the company (Admin only)
 *     tags: [Invitations]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: List of invitations
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Admin role required
 *       500:
 *         description: Internal server error
 */
router.get("/", protect, requireAdmin, getInvitations);

/**
 * @swagger
 * /api/invitations/verify/{token}:
 *   get:
 *     summary: Verify an invitation token (public)
 *     tags: [Invitations]
 *     security: []
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Valid invitation details
 *       404:
 *         description: Invalid or expired invitation
 *       500:
 *         description: Internal server error
 */
router.get("/verify/:token", verifyInvitation);

/**
 * @swagger
 * /api/invitations/resend/{id}:
 *   post:
 *     summary: Resend an invitation (Admin only)
 *     tags: [Invitations]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Invitation resent successfully
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Access denied
 *       404:
 *         description: Invitation not found
 *       500:
 *         description: Internal server error
 */
router.post("/resend/:id", protect, requireAdmin, resendInvitation);

/**
 * @swagger
 * /api/invitations/revoke/{id}:
 *   post:
 *     summary: Revoke an invitation (Admin only)
 *     tags: [Invitations]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Invitation revoked successfully
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Access denied
 *       404:
 *         description: Invitation not found
 *       500:
 *         description: Internal server error
 */
router.post("/revoke/:id", protect, requireAdmin, revokeInvitation);

/**
 * @swagger
 * /api/invitations/managers/{managerId}:
 *   delete:
 *     summary: Remove a manager from the company (Admin only)
 *     tags: [Invitations]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: managerId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Manager removed successfully
 *       400:
 *         description: Target user is not a manager
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Access denied
 *       404:
 *         description: Manager not found
 *       500:
 *         description: Internal server error
 */
router.delete("/managers/:managerId", protect, requireAdmin, removeManager);

export default router;
