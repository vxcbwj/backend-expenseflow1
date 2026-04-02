// backend/src/routes/expenses.js
import express from "express";
import protect from "../middleware/authMiddleware.js";
import { requirePermission, PERMISSIONS } from "../utils/roles.js";
import uploadMiddleware from "../middleware/upload.js";
import {
  createExpense,
  getExpenseMeta,
  getExpenseTotals,
  getCategoryTotals,
  getMonthlyTotals,
  getDepartmentTotals,
  getExpenses,
  getExpense,
  updateExpense,
  deleteExpense,
  approveExpense,
  rejectExpense,
  uploadReceipts,
  deleteReceipt,
  getReceipt,
} from "../controllers/expenseController.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Expenses
 *   description: Expense management
 */

/**
 * @swagger
 * /api/expenses:
 *   post:
 *     summary: Create a new expense
 *     tags: [Expenses]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [amount, category, description, department]
 *             properties:
 *               amount: { type: number }
 *               category: { type: string }
 *               department: { type: string }
 *               description: { type: string }
 *               date: { type: string, format: date }
 *               vendor: { type: string }
 *               paymentMethod: { type: string }
 *               notes: { type: string }
 *     responses:
 *       201:
 *         description: Expense created successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Insufficient permissions
 *       500:
 *         description: Internal server error
 */
router.post("/", protect, requirePermission(PERMISSIONS.SUBMIT_EXPENSES), createExpense);

/**
 * @swagger
 * /api/expenses/meta:
 *   get:
 *     summary: Get expense metadata (categories, statuses, departments)
 *     tags: [Expenses]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Metadata arrays
 *       401:
 *         description: Not authenticated
 *       500:
 *         description: Internal server error
 */
router.get("/meta", protect, getExpenseMeta);

/**
 * @swagger
 * /api/expenses/summary/totals:
 *   get:
 *     summary: Get total expense amount for the company
 *     tags: [Expenses]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: endDate
 *         schema: { type: string, format: date }
 *     responses:
 *       200:
 *         description: Total amount and count
 *       401:
 *         description: Not authenticated
 *       500:
 *         description: Internal server error
 */
router.get("/summary/totals", protect, getExpenseTotals);

/**
 * @swagger
 * /api/expenses/summary/categories:
 *   get:
 *     summary: Get expense totals grouped by category
 *     tags: [Expenses]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: endDate
 *         schema: { type: string, format: date }
 *     responses:
 *       200:
 *         description: Category totals
 *       401:
 *         description: Not authenticated
 *       500:
 *         description: Internal server error
 */
router.get("/summary/categories", protect, getCategoryTotals);

/**
 * @swagger
 * /api/expenses/summary/monthly:
 *   get:
 *     summary: Get monthly expense totals for a given year
 *     tags: [Expenses]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: year
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Monthly totals
 *       401:
 *         description: Not authenticated
 *       500:
 *         description: Internal server error
 */
router.get("/summary/monthly", protect, getMonthlyTotals);

/**
 * @swagger
 * /api/expenses/summary/departments:
 *   get:
 *     summary: Get expense totals grouped by department
 *     tags: [Expenses]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: endDate
 *         schema: { type: string, format: date }
 *     responses:
 *       200:
 *         description: Department totals
 *       401:
 *         description: Not authenticated
 *       500:
 *         description: Internal server error
 */
router.get("/summary/departments", protect, getDepartmentTotals);

/**
 * @swagger
 * /api/expenses:
 *   get:
 *     summary: Get paginated expenses for the company
 *     tags: [Expenses]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: category
 *         schema: { type: string }
 *       - in: query
 *         name: department
 *         schema: { type: string }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [pending, approved, rejected, paid] }
 *       - in: query
 *         name: startDate
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: endDate
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 50, maximum: 500 }
 *     responses:
 *       200:
 *         description: Paginated expenses list
 *       400:
 *         description: Invalid filter parameter
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Insufficient permissions
 *       500:
 *         description: Internal server error
 */
router.get("/", protect, requirePermission(PERMISSIONS.VIEW_ALL_EXPENSES), getExpenses);

/**
 * @swagger
 * /api/expenses/{id}:
 *   get:
 *     summary: Get a single expense by ID
 *     tags: [Expenses]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Expense object
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Access denied
 *       404:
 *         description: Expense not found
 *       500:
 *         description: Internal server error
 */
router.get("/:id", protect, getExpense);

/**
 * @swagger
 * /api/expenses/{id}:
 *   put:
 *     summary: Update an expense (does not allow status changes)
 *     tags: [Expenses]
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
 *               amount: { type: number }
 *               category: { type: string }
 *               department: { type: string }
 *               description: { type: string }
 *               vendor: { type: string }
 *               notes: { type: string }
 *     responses:
 *       200:
 *         description: Expense updated successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Access denied or status change attempted
 *       404:
 *         description: Expense not found
 *       500:
 *         description: Internal server error
 */
router.put("/:id", protect, requirePermission(PERMISSIONS.EDIT_EXPENSES), updateExpense);

/**
 * @swagger
 * /api/expenses/{id}:
 *   delete:
 *     summary: Delete an expense and its Cloudinary receipts
 *     tags: [Expenses]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Expense deleted successfully
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Access denied
 *       404:
 *         description: Expense not found
 *       500:
 *         description: Internal server error
 */
router.delete("/:id", protect, requirePermission(PERMISSIONS.DELETE_EXPENSES), deleteExpense);

/**
 * @swagger
 * /api/expenses/{id}/approve:
 *   post:
 *     summary: Approve a pending expense
 *     tags: [Expenses]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Expense approved successfully
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Access denied
 *       404:
 *         description: Expense not found
 *       500:
 *         description: Internal server error
 */
router.post("/:id/approve", protect, requirePermission(PERMISSIONS.EDIT_EXPENSES), approveExpense);

/**
 * @swagger
 * /api/expenses/{id}/reject:
 *   post:
 *     summary: Reject a pending expense
 *     tags: [Expenses]
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
 *               reason: { type: string }
 *     responses:
 *       200:
 *         description: Expense rejected successfully
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Access denied
 *       404:
 *         description: Expense not found
 *       500:
 *         description: Internal server error
 */
router.post("/:id/reject", protect, requirePermission(PERMISSIONS.EDIT_EXPENSES), rejectExpense);

/**
 * @swagger
 * /api/expenses/{id}/receipts:
 *   post:
 *     summary: Upload receipts for an expense (max 5 total)
 *     tags: [Expenses]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               files:
 *                 type: array
 *                 items: { type: string, format: binary }
 *     responses:
 *       200:
 *         description: Receipts uploaded successfully
 *       400:
 *         description: No files provided or receipt limit exceeded
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Access denied
 *       404:
 *         description: Expense not found
 *       500:
 *         description: Upload failed
 */
router.post("/:id/receipts", protect, uploadMiddleware, uploadReceipts);

/**
 * @swagger
 * /api/expenses/{id}/receipts/{receiptId}:
 *   delete:
 *     summary: Delete a specific receipt from an expense
 *     tags: [Expenses]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: receiptId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Receipt deleted successfully
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Access denied
 *       404:
 *         description: Expense or receipt not found
 *       500:
 *         description: Internal server error
 */
router.delete("/:id/receipts/:receiptId", protect, deleteReceipt);

/**
 * @swagger
 * /api/expenses/{id}/receipts/{receiptId}:
 *   get:
 *     summary: Get a specific receipt URL
 *     tags: [Expenses]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: receiptId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Receipt URL and metadata
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Access denied
 *       404:
 *         description: Expense or receipt not found
 *       500:
 *         description: Internal server error
 */
router.get("/:id/receipts/:receiptId", protect, getReceipt);

export default router;
