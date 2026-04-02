// backend/src/routes/analytics.js
import express from "express";
import protect from "../middleware/authMiddleware.js";
import { requirePermission, PERMISSIONS } from "../utils/roles.js";
import {
  getOverview,
  getCategoryBreakdown,
  getTrends,
  getBudgetVsActual,
  getUserPerformance,
  getAnalyticsMeta,
} from "../controllers/analyticsController.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Analytics
 *   description: Expense analytics and reporting
 */

/**
 * @swagger
 * /api/analytics/overview:
 *   get:
 *     summary: Get analytics overview for the company
 *     tags: [Analytics]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: months
 *         schema: { type: integer, default: 3 }
 *         description: Number of months to look back
 *     responses:
 *       200:
 *         description: Overview analytics data
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Insufficient permissions
 *       500:
 *         description: Internal server error
 */
router.get("/overview", protect, requirePermission(PERMISSIONS.VIEW_ANALYTICS), getOverview);

/**
 * @swagger
 * /api/analytics/categories:
 *   get:
 *     summary: Get spending breakdown by category
 *     tags: [Analytics]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: months
 *         schema: { type: integer, default: 3 }
 *     responses:
 *       200:
 *         description: Category breakdown data
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Insufficient permissions
 *       500:
 *         description: Internal server error
 */
router.get("/categories", protect, requirePermission(PERMISSIONS.VIEW_ANALYTICS), getCategoryBreakdown);

/**
 * @swagger
 * /api/analytics/trends:
 *   get:
 *     summary: Get expense trends over time
 *     tags: [Analytics]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: months
 *         schema: { type: integer, default: 6 }
 *     responses:
 *       200:
 *         description: Monthly trend data
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Insufficient permissions
 *       500:
 *         description: Internal server error
 */
router.get("/trends", protect, requirePermission(PERMISSIONS.VIEW_ANALYTICS), getTrends);

/**
 * @swagger
 * /api/analytics/budget-vs-actual:
 *   get:
 *     summary: Compare budget vs actual spending per category
 *     tags: [Analytics]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: months
 *         schema: { type: integer, default: 1 }
 *     responses:
 *       200:
 *         description: Budget vs actual comparison data
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Insufficient permissions
 *       500:
 *         description: Internal server error
 */
router.get("/budget-vs-actual", protect, requirePermission(PERMISSIONS.VIEW_ANALYTICS), getBudgetVsActual);

/**
 * @swagger
 * /api/analytics/user-performance:
 *   get:
 *     summary: Get per-user spending performance
 *     tags: [Analytics]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: months
 *         schema: { type: integer, default: 3 }
 *     responses:
 *       200:
 *         description: User performance data
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Insufficient permissions
 *       500:
 *         description: Internal server error
 */
router.get("/user-performance", protect, requirePermission(PERMISSIONS.VIEW_ANALYTICS), getUserPerformance);

/**
 * @swagger
 * /api/analytics/meta:
 *   get:
 *     summary: Get valid categories for analytics filters
 *     tags: [Analytics]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Valid category list sourced from schema
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Insufficient permissions
 *       500:
 *         description: Internal server error
 */
router.get("/meta", protect, requirePermission(PERMISSIONS.VIEW_ANALYTICS), getAnalyticsMeta);

export default router;
