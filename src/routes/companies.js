// backend/src/routes/companies.js
import express from "express";
import protect from "../middleware/authMiddleware.js";
import { requireAdmin } from "../utils/roles.js";
import {
  getMyCompany,
  getCompany,
  createCompany,
  updateCompany,
  deleteCompany,
  getManagers,
  getCompanyUsers,
} from "../controllers/companyController.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Companies
 *   description: Company management
 */

/**
 * @swagger
 * /api/companies:
 *   get:
 *     summary: Get the authenticated user's company
 *     tags: [Companies]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Company object or null if not assigned
 *       401:
 *         description: Not authenticated
 *       404:
 *         description: Company not found
 *       500:
 *         description: Internal server error
 */
router.get("/", protect, getMyCompany);

/**
 * @swagger
 * /api/companies:
 *   post:
 *     summary: Create a new company (Admin only)
 *     tags: [Companies]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, industry]
 *             properties:
 *               name: { type: string }
 *               industry: { type: string }
 *               currency: { type: string }
 *               description: { type: string }
 *               email: { type: string }
 *               phone: { type: string }
 *               website: { type: string }
 *     responses:
 *       201:
 *         description: Company created successfully
 *       400:
 *         description: Validation error or company already exists
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Admin role required
 *       500:
 *         description: Internal server error
 */
router.post("/", protect, requireAdmin, createCompany);

/**
 * @swagger
 * /api/companies/{id}:
 *   get:
 *     summary: Get a specific company by ID
 *     tags: [Companies]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Company object
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Access denied
 *       404:
 *         description: Company not found
 *       500:
 *         description: Internal server error
 */
router.get("/:id", protect, getCompany);

/**
 * @swagger
 * /api/companies/{id}:
 *   put:
 *     summary: Update a company (Admin only)
 *     tags: [Companies]
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
 *               name: { type: string }
 *               industry: { type: string }
 *               currency: { type: string }
 *               settings: { type: object }
 *               isActive: { type: boolean }
 *     responses:
 *       200:
 *         description: Company updated successfully
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Access denied or Admin role required
 *       404:
 *         description: Company not found
 *       500:
 *         description: Internal server error
 */
router.put("/:id", protect, requireAdmin, updateCompany);

/**
 * @swagger
 * /api/companies/{id}:
 *   delete:
 *     summary: Delete a company (Admin only)
 *     tags: [Companies]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Company deleted successfully
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Access denied
 *       404:
 *         description: Company not found
 *       500:
 *         description: Internal server error
 */
router.delete("/:id", protect, requireAdmin, deleteCompany);

/**
 * @swagger
 * /api/companies/{id}/managers:
 *   get:
 *     summary: Get all managers of a company
 *     tags: [Companies]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: List of managers
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Access denied
 *       500:
 *         description: Internal server error
 */
router.get("/:id/managers", protect, getManagers);

/**
 * @swagger
 * /api/companies/{id}/users:
 *   get:
 *     summary: Get all users of a company
 *     tags: [Companies]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: List of users
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Access denied
 *       500:
 *         description: Internal server error
 */
router.get("/:id/users", protect, getCompanyUsers);

export default router;
