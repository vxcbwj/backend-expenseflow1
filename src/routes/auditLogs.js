// backend/src/routes/auditLogs.js
import express from "express";
import protect from "../middleware/authMiddleware.js";
import { requireAdmin } from "../utils/roles.js";
import {
  getAuditLogs,
  getEntityLogs,
  getUserLogs,
  getRecentLogs,
  getAuditStats,
  getActions,
  getEntities,
} from "../controllers/auditLogController.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Audit Logs
 *   description: Audit trail for all company actions (Admin only)
 */

/**
 * @swagger
 * /api/audit-logs:
 *   get:
 *     summary: Get paginated audit logs for the company
 *     tags: [Audit Logs]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 100 }
 *       - in: query
 *         name: action
 *         schema: { type: string }
 *       - in: query
 *         name: entity
 *         schema: { type: string }
 *       - in: query
 *         name: startDate
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: endDate
 *         schema: { type: string, format: date }
 *     responses:
 *       200:
 *         description: Paginated audit logs
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Admin role required
 *       500:
 *         description: Internal server error
 */
router.get("/", protect, requireAdmin, getAuditLogs);

/**
 * @swagger
 * /api/audit-logs/recent:
 *   get:
 *     summary: Get recent audit activity
 *     tags: [Audit Logs]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: Recent audit logs
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Admin role required
 *       500:
 *         description: Internal server error
 */
router.get("/recent", protect, requireAdmin, getRecentLogs);

/**
 * @swagger
 * /api/audit-logs/stats:
 *   get:
 *     summary: Get audit statistics for a time period
 *     tags: [Audit Logs]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: days
 *         schema: { type: integer, default: 30 }
 *     responses:
 *       200:
 *         description: Audit statistics by action and entity
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Admin role required
 *       500:
 *         description: Internal server error
 */
router.get("/stats", protect, requireAdmin, getAuditStats);

/**
 * @swagger
 * /api/audit-logs/actions:
 *   get:
 *     summary: Get available audit log action types
 *     tags: [Audit Logs]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: List of action types
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Admin role required
 *       500:
 *         description: Internal server error
 */
router.get("/actions", protect, requireAdmin, getActions);

/**
 * @swagger
 * /api/audit-logs/entities:
 *   get:
 *     summary: Get available audit log entity types
 *     tags: [Audit Logs]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: List of entity types
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Admin role required
 *       500:
 *         description: Internal server error
 */
router.get("/entities", protect, requireAdmin, getEntities);

/**
 * @swagger
 * /api/audit-logs/entity/{entity}/{entityId}:
 *   get:
 *     summary: Get audit logs for a specific entity
 *     tags: [Audit Logs]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: entity
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: entityId
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 50 }
 *     responses:
 *       200:
 *         description: Audit logs for the entity
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Admin role required
 *       500:
 *         description: Internal server error
 */
router.get("/entity/:entity/:entityId", protect, requireAdmin, getEntityLogs);

/**
 * @swagger
 * /api/audit-logs/user/{userId}:
 *   get:
 *     summary: Get audit logs for a specific user
 *     tags: [Audit Logs]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 50 }
 *     responses:
 *       200:
 *         description: Audit logs for the user
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Admin role required
 *       500:
 *         description: Internal server error
 */
router.get("/user/:userId", protect, requireAdmin, getUserLogs);

export default router;
