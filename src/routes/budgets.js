// backend/src/routes/budgets.js
import express from "express";
import Budget from "../models/budget.js";
import User from "../models/user.js";
import protect from "../middleware/authMiddleware.js";
import { requirePermission, PERMISSIONS } from "../utils/roles.js";
import { auditLogger } from "../utils/auditLogger.js";
import { sendBudgetAlertEmail } from "../utils/emailService.js";

const router = express.Router();

// Helper function to check and send budget alerts
async function checkAndSendBudgetAlerts(budget) {
  try {
    // Calculate percentage used
    const percentageUsed = (budget.currentSpending / budget.amount) * 100;

    // Check if warning threshold reached (80%)
    if (percentageUsed >= 80 && percentageUsed < 100) {
      // Only send if not already in warning state
      if (!budget.status || budget.status !== 'warning') {
        budget.status = 'warning';
        await budget.save();

        // Get all admins and managers in company
        const recipients = await User.find({
          companyId: budget.companyId,
          globalRole: { $in: ['admin', 'manager'] },
          isActive: true
        });

        if (recipients.length > 0) {
          await sendBudgetAlertEmail(budget, recipients, 'warning');
        }
      }
    }

    // Check if budget exceeded (100%)
    if (percentageUsed >= 100) {
      // Only send if not already in exceeded state
      if (!budget.status || budget.status !== 'exceeded') {
        budget.status = 'exceeded';
        await budget.save();

        // Get all admins and managers in company
        const recipients = await User.find({
          companyId: budget.companyId,
          globalRole: { $in: ['admin', 'manager'] },
          isActive: true
        });

        if (recipients.length > 0) {
          await sendBudgetAlertEmail(budget, recipients, 'exceeded');
        }
      }
    }

    // Reset to on_track if back under 80%
    if (percentageUsed < 80 && budget.status !== 'on_track') {
      budget.status = 'on_track';
      await budget.save();
    }
  } catch (error) {
    console.error('Budget alert check failed (non-blocking):', error);
  }
}

// GET /api/budgets - Get all budgets
router.get(
  "/",
  protect,
  requirePermission(PERMISSIONS.VIEW_BUDGETS),
  async (req, res) => {
    try {
      const { activeOnly } = req.query;

      if (!req.user.companyId) {
        return res.json({
          success: true,
          budgets: [],
          count: 0,
        });
      }

      const budgets = await Budget.findByCompany(
        req.user.companyId,
        activeOnly === "true"
      );

      res.json({
        success: true,
        budgets,
        count: budgets.length,
      });
    } catch (error) {
      console.error("Get budgets error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch budgets",
      });
    }
  }
);

// GET /api/budgets/:id - Get single budget
router.get(
  "/:id",
  protect,
  requirePermission(PERMISSIONS.VIEW_BUDGETS),
  async (req, res) => {
    try {
      const budget = await Budget.findById(req.params.id).populate(
        "createdBy",
        "firstName lastName email"
      );

      if (!budget) {
        return res.status(404).json({
          success: false,
          error: "Budget not found",
        });
      }

      if (!req.user.canAccessCompany(budget.companyId)) {
        return res.status(403).json({
          success: false,
          error: "Access denied to this budget",
        });
      }

      res.json({
        success: true,
        budget,
      });
    } catch (error) {
      console.error("Get budget error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch budget",
      });
    }
  }
);

// POST /api/budgets - Create budget
router.post(
  "/",
  protect,
  requirePermission(PERMISSIONS.SET_BUDGETS),
  async (req, res) => {
    try {
      const {
        category,
        amount,
        period,
        startDate,
        endDate,
        name,
        description,
        warningThreshold,
      } = req.body;

      if (!category || !amount) {
        return res.status(400).json({
          success: false,
          error: "Category and amount are required",
        });
      }

      if (!req.user.companyId) {
        return res.status(400).json({
          success: false,
          error: "You must be assigned to a company",
        });
      }

      if (amount <= 0) {
        return res.status(400).json({
          success: false,
          error: "Budget amount must be positive",
        });
      }

      const budget = await Budget.create({
        companyId: req.user.companyId,
        createdBy: req.user._id,
        category,
        amount,
        period: period || "monthly",
        startDate: startDate || new Date(),
        endDate,
        name,
        description,
        warningThreshold: warningThreshold || 80,
      });

      // Audit log
      await auditLogger.budgetCreated(
        budget._id,
        req.user._id,
        {
          category: budget.category,
          amount: budget.amount,
          period: budget.period,
          name: budget.name,
        },
        req.user.companyId
      );

      console.log("✅ Budget created:", {
        id: budget._id,
        category: budget.category,
        amount: budget.amount,
      });

      res.status(201).json({
        success: true,
        message: "Budget created successfully",
        budget,
      });
    } catch (error) {
      console.error("Create budget error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to create budget",
      });
    }
  }
);

// PUT /api/budgets/:id - Update budget
router.put(
  "/:id",
  protect,
  requirePermission(PERMISSIONS.SET_BUDGETS),
  async (req, res) => {
    try {
      const budget = await Budget.findById(req.params.id);

      if (!budget) {
        return res.status(404).json({
          success: false,
          error: "Budget not found",
        });
      }

      if (!req.user.canAccessCompany(budget.companyId)) {
        return res.status(403).json({
          success: false,
          error: "Access denied to this budget",
        });
      }

      const {
        category,
        amount,
        period,
        startDate,
        endDate,
        name,
        description,
        isActive,
        warningThreshold,
      } = req.body;

      // Track changes for audit
      const changes = {};
      if (category && category !== budget.category) {
        changes.category = { from: budget.category, to: category };
        budget.category = category;
      }
      if (amount !== undefined && amount !== budget.amount) {
        changes.amount = { from: budget.amount, to: amount };
        budget.amount = amount;
      }
      if (period && period !== budget.period) {
        changes.period = { from: budget.period, to: period };
        budget.period = period;
      }
      if (startDate && startDate !== budget.startDate) {
        changes.startDate = { from: budget.startDate, to: startDate };
        budget.startDate = startDate;
      }
      if (endDate !== undefined && endDate !== budget.endDate) {
        changes.endDate = { from: budget.endDate, to: endDate };
        budget.endDate = endDate;
      }
      if (name !== undefined && name !== budget.name) {
        changes.name = { from: budget.name, to: name };
        budget.name = name;
      }
      if (description !== undefined && description !== budget.description) {
        changes.description = { from: budget.description, to: description };
        budget.description = description;
      }
      if (isActive !== undefined && isActive !== budget.isActive) {
        changes.isActive = { from: budget.isActive, to: isActive };
        budget.isActive = isActive;
      }
      if (
        warningThreshold !== undefined &&
        warningThreshold !== budget.warningThreshold
      ) {
        changes.warningThreshold = {
          from: budget.warningThreshold,
          to: warningThreshold,
        };
        budget.warningThreshold = warningThreshold;
      }

      await budget.save();

      // Check and send budget alerts (non-blocking)
      await checkAndSendBudgetAlerts(budget);

      // Audit log
      if (Object.keys(changes).length > 0) {
        await auditLogger.budgetUpdated(
          budget._id,
          req.user._id,
          changes,
          req.user.companyId
        );
      }

      res.json({
        success: true,
        message: "Budget updated successfully",
        budget,
      });
    } catch (error) {
      console.error("Update budget error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to update budget",
      });
    }
  }
);

// DELETE /api/budgets/:id - Delete budget
router.delete(
  "/:id",
  protect,
  requirePermission(PERMISSIONS.SET_BUDGETS),
  async (req, res) => {
    try {
      const budget = await Budget.findById(req.params.id);

      if (!budget) {
        return res.status(404).json({
          success: false,
          error: "Budget not found",
        });
      }

      if (!req.user.canAccessCompany(budget.companyId)) {
        return res.status(403).json({
          success: false,
          error: "Access denied to this budget",
        });
      }

      // Audit log before deletion
      await auditLogger.budgetDeleted(
        budget._id,
        req.user._id,
        req.user.companyId
      );

      await Budget.findByIdAndDelete(req.params.id);

      res.json({
        success: true,
        message: "Budget deleted successfully",
      });
    } catch (error) {
      console.error("Delete budget error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to delete budget",
      });
    }
  }
);

// GET /api/budgets/category/:category - Get budgets by category
router.get(
  "/category/:category",
  protect,
  requirePermission(PERMISSIONS.VIEW_BUDGETS),
  async (req, res) => {
    try {
      const { category } = req.params;

      if (!req.user.companyId) {
        return res.json({
          success: true,
          budgets: [],
        });
      }

      const budgets = await Budget.findByCategory(req.user.companyId, category);

      res.json({
        success: true,
        budgets,
        count: budgets.length,
      });
    } catch (error) {
      console.error("Get budgets by category error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch budgets",
      });
    }
  }
);

// GET /api/budgets/summary/overview - Get budget summary
router.get(
  "/summary/overview",
  protect,
  requirePermission(PERMISSIONS.VIEW_BUDGETS),
  async (req, res) => {
    try {
      if (!req.user.companyId) {
        return res.json({
          success: true,
          summary: {
            totalBudget: 0,
            totalSpending: 0,
            budgetCount: 0,
          },
        });
      }

      const budgets = await Budget.findByCompany(req.user.companyId, true);

      const totalBudget = budgets.reduce((sum, b) => sum + b.amount, 0);
      const totalSpending = budgets.reduce(
        (sum, b) => sum + b.currentSpending,
        0
      );

      const byCategory = budgets.reduce((acc, budget) => {
        if (!acc[budget.category]) {
          acc[budget.category] = {
            allocated: 0,
            spent: 0,
            budgets: [],
          };
        }
        acc[budget.category].allocated += budget.amount;
        acc[budget.category].spent += budget.currentSpending;
        acc[budget.category].budgets.push({
          id: budget._id,
          name: budget.name,
          amount: budget.amount,
          spent: budget.currentSpending,
          status: budget.status,
        });
        return acc;
      }, {});

      res.json({
        success: true,
        summary: {
          totalBudget: Math.round(totalBudget * 100) / 100,
          totalSpending: Math.round(totalSpending * 100) / 100,
          budgetCount: budgets.length,
          utilization:
            totalBudget > 0
              ? Math.round((totalSpending / totalBudget) * 10000) / 100
              : 0,
          byCategory,
        },
      });
    } catch (error) {
      console.error("Budget summary error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch budget summary",
      });
    }
  }
);

export default router;
