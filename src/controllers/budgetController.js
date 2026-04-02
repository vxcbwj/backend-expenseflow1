// backend/src/controllers/budgetController.js
import Budget from "../models/budget.js";
import User from "../models/user.js";
import { auditLogger } from "../utils/auditLogger.js";
import { sendBudgetAlertEmail } from "../utils/emailService.js";
import catchAsync from "../utils/catchAsync.js";
import AppError from "../utils/AppError.js";

// Helper: check spending thresholds and send alerts
async function checkAndSendBudgetAlerts(budget) {
  try {
    const percentage = (budget.currentSpending / budget.amount) * 100;
    const type = percentage >= 100 ? "exceeded" : percentage >= 80 ? "warning" : null;
    if (!type) return;
    const recipients = await User.find({
      companyId: budget.companyId,
      globalRole: { $in: ["admin", "manager"] },
      isActive: true,
    });
    if (recipients.length > 0) {
      await sendBudgetAlertEmail(budget, recipients, type);
    }
  } catch (error) {
    console.error("Budget alert check failed (non-blocking):", error);
  }
}

// GET /api/budgets
export const getBudgets = catchAsync(async (req, res) => {
  const { activeOnly } = req.query;

  if (!req.user.companyId) {
    return res.json({ success: true, budgets: [], count: 0 });
  }

  const budgets = await Budget.findByCompany(req.user.companyId, activeOnly === "true");

  res.json({ success: true, budgets, count: budgets.length });
});

// GET /api/budgets/:id
export const getBudget = catchAsync(async (req, res, next) => {
  const budget = await Budget.findById(req.params.id).populate("createdBy", "firstName lastName email");

  if (!budget) return next(new AppError("Budget not found", 404));

  if (!req.user.canAccessCompany(budget.companyId)) {
    return next(new AppError("Access denied to this budget", 403));
  }

  res.json({ success: true, budget });
});

// POST /api/budgets
export const createBudget = catchAsync(async (req, res, next) => {
  const { category, amount, period, startDate, endDate, name, description, warningThreshold } = req.body;

  if (!category || !amount) return next(new AppError("Category and amount are required", 400));
  if (!req.user.companyId) return next(new AppError("You must be assigned to a company", 400));
  if (amount <= 0) return next(new AppError("Budget amount must be positive", 400));

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

  await auditLogger.budgetCreated(
    budget._id,
    req.user._id,
    { category: budget.category, amount: budget.amount, period: budget.period, name: budget.name },
    req.user.companyId
  );

  console.log("✅ Budget created:", { id: budget._id, category: budget.category, amount: budget.amount });

  res.status(201).json({ success: true, message: "Budget created successfully", budget });
});

// PUT /api/budgets/:id
export const updateBudget = catchAsync(async (req, res, next) => {
  const budget = await Budget.findById(req.params.id);

  if (!budget) return next(new AppError("Budget not found", 404));
  if (!req.user.canAccessCompany(budget.companyId)) return next(new AppError("Access denied to this budget", 403));

  const { category, amount, period, startDate, endDate, name, description, isActive, warningThreshold } = req.body;

  const changes = {};
  if (category && category !== budget.category) { changes.category = { from: budget.category, to: category }; budget.category = category; }
  if (amount !== undefined && amount !== budget.amount) { changes.amount = { from: budget.amount, to: amount }; budget.amount = amount; }
  if (period && period !== budget.period) { changes.period = { from: budget.period, to: period }; budget.period = period; }
  if (startDate && startDate !== budget.startDate) { changes.startDate = { from: budget.startDate, to: startDate }; budget.startDate = startDate; }
  if (endDate !== undefined && endDate !== budget.endDate) { changes.endDate = { from: budget.endDate, to: endDate }; budget.endDate = endDate; }
  if (name !== undefined && name !== budget.name) { changes.name = { from: budget.name, to: name }; budget.name = name; }
  if (description !== undefined && description !== budget.description) { changes.description = { from: budget.description, to: description }; budget.description = description; }
  if (isActive !== undefined && isActive !== budget.isActive) { changes.isActive = { from: budget.isActive, to: isActive }; budget.isActive = isActive; }
  if (warningThreshold !== undefined && warningThreshold !== budget.warningThreshold) {
    changes.warningThreshold = { from: budget.warningThreshold, to: warningThreshold };
    budget.warningThreshold = warningThreshold;
  }

  await budget.save();
  await checkAndSendBudgetAlerts(budget);

  if (Object.keys(changes).length > 0) {
    await auditLogger.budgetUpdated(budget._id, req.user._id, changes, req.user.companyId);
  }

  res.json({ success: true, message: "Budget updated successfully", budget });
});

// DELETE /api/budgets/:id
export const deleteBudget = catchAsync(async (req, res, next) => {
  const budget = await Budget.findById(req.params.id);

  if (!budget) return next(new AppError("Budget not found", 404));
  if (!req.user.canAccessCompany(budget.companyId)) return next(new AppError("Access denied to this budget", 403));

  await auditLogger.budgetDeleted(budget._id, req.user._id, req.user.companyId);
  await budget.deleteOne();

  res.json({ success: true, message: "Budget deleted successfully" });
});

// GET /api/budgets/category/:category
export const getBudgetsByCategory = catchAsync(async (req, res) => {
  const { category } = req.params;

  if (!req.user.companyId) {
    return res.json({ success: true, budgets: [] });
  }

  const budgets = await Budget.findByCategory(req.user.companyId, category);

  res.json({ success: true, budgets, count: budgets.length });
});

// GET /api/budgets/summary/overview
export const getBudgetSummary = catchAsync(async (req, res) => {
  if (!req.user.companyId) {
    return res.json({ success: true, summary: { totalBudget: 0, totalSpending: 0, budgetCount: 0 } });
  }

  const budgets = await Budget.findByCompany(req.user.companyId, true);

  const totalBudget = budgets.reduce((sum, b) => sum + b.amount, 0);
  const totalSpending = budgets.reduce((sum, b) => sum + b.currentSpending, 0);

  const byCategory = budgets.reduce((acc, budget) => {
    if (!acc[budget.category]) {
      acc[budget.category] = { allocated: 0, spent: 0, budgets: [] };
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
      utilization: totalBudget > 0 ? Math.round((totalSpending / totalBudget) * 10000) / 100 : 0,
      byCategory,
    },
  });
});
