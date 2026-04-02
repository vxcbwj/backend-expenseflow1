// backend/src/routes/budgets.js
import express from "express";
import protect from "../middleware/authMiddleware.js";
import { requirePermission, PERMISSIONS } from "../utils/roles.js";
import {
  getBudgets,
  getBudget,
  createBudget,
  updateBudget,
  deleteBudget,
  getBudgetsByCategory,
  getBudgetSummary,
} from "../controllers/budgetController.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Budgets
 *   description: Budget management
 */

/**
 * @swagger
 * /api/budgets:
 *   get:
 *     summary: Get all budgets for the user's company
 *     tags: [Budgets]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: activeOnly
 *         schema: { type: boolean }
 *         description: Filter to active budgets only
 *     responses:
 *       200:
 *         description: List of budgets
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Insufficient permissions
 *       500:
 *         description: Internal server error
 */
router.get("/", protect, requirePermission(PERMISSIONS.VIEW_BUDGETS), getBudgets);

/**
 * @swagger
 * /api/budgets/summary/overview:
 *   get:
 *     summary: Get budget summary overview
 *     tags: [Budgets]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Budget summary with totals and by-category breakdown
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Insufficient permissions
 *       500:
 *         description: Internal server error
 */
router.get("/summary/overview", protect, requirePermission(PERMISSIONS.VIEW_BUDGETS), getBudgetSummary);

/**
 * @swagger
 * /api/budgets/category/{category}:
 *   get:
 *     summary: Get budgets by category
 *     tags: [Budgets]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: category
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Budgets for the given category
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Insufficient permissions
 *       500:
 *         description: Internal server error
 */
router.get("/category/:category", protect, requirePermission(PERMISSIONS.VIEW_BUDGETS), getBudgetsByCategory);

/**
 * @swagger
 * /api/budgets/{id}:
 *   get:
 *     summary: Get a single budget by ID
 *     tags: [Budgets]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Budget object
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Access denied
 *       404:
 *         description: Budget not found
 *       500:
 *         description: Internal server error
 */
router.get("/:id", protect, requirePermission(PERMISSIONS.VIEW_BUDGETS), getBudget);

/**
 * @swagger
 * /api/budgets:
 *   post:
 *     summary: Create a new budget
 *     tags: [Budgets]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [category, amount]
 *             properties:
 *               category: { type: string }
 *               amount: { type: number }
 *               period: { type: string, enum: [monthly, quarterly, yearly] }
 *               startDate: { type: string, format: date }
 *               endDate: { type: string, format: date }
 *               name: { type: string }
 *               description: { type: string }
 *               warningThreshold: { type: number }
 *     responses:
 *       201:
 *         description: Budget created successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Insufficient permissions
 *       500:
 *         description: Internal server error
 */
router.post("/", protect, requirePermission(PERMISSIONS.SET_BUDGETS), createBudget);

/**
 * @swagger
 * /api/budgets/{id}:
 *   put:
 *     summary: Update a budget
 *     tags: [Budgets]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               category: { type: string }
 *               amount: { type: number }
 *               isActive: { type: boolean }
 *               warningThreshold: { type: number }
 *     responses:
 *       200:
 *         description: Budget updated successfully
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Access denied
 *       404:
 *         description: Budget not found
 *       500:
 *         description: Internal server error
 */
router.put("/:id", protect, requirePermission(PERMISSIONS.SET_BUDGETS), updateBudget);

/**
 * @swagger
 * /api/budgets/{id}:
 *   delete:
 *     summary: Delete a budget
 *     tags: [Budgets]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Budget deleted successfully
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Access denied
 *       404:
 *         description: Budget not found
 *       500:
 *         description: Internal server error
 */
router.delete("/:id", protect, requirePermission(PERMISSIONS.SET_BUDGETS), deleteBudget);

export default router;
