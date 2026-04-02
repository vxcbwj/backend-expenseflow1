// backend/src/controllers/analyticsController.js
import Expense from "../models/expense.js";
import Budget from "../models/budget.js";
import catchAsync from "../utils/catchAsync.js";

// ✅ M8 FIX: Dynamic category validation from schema (single source of truth)
function getValidCategories() {
  try {
    const budgetSchema = Budget.schema;
    const categoryPath = budgetSchema.path("category");
    if (categoryPath && categoryPath.enumValues) {
      return categoryPath.enumValues;
    }
    return [
      "Office Supplies","Software","Hardware","Travel","Meals & Entertainment",
      "Marketing","Utilities","Rent","Salaries","Consulting","Insurance",
      "Training","Maintenance","Shipping","Advertising","Legal","Taxes","Other",
    ];
  } catch (error) {
    console.warn("⚠️ Could not fetch category enum from schema:", error.message);
    return [
      "Office Supplies","Software","Hardware","Travel","Meals & Entertainment",
      "Marketing","Utilities","Rent","Salaries","Consulting","Insurance",
      "Training","Maintenance","Shipping","Advertising","Legal","Taxes","Other",
    ];
  }
}

// GET /api/analytics/overview
export const getOverview = catchAsync(async (req, res) => {
  const { months = 3 } = req.query;

  if (!req.user.companyId) {
    return res.json({ success: true, data: { totalSpent: 0, totalExpenses: 0, monthlyAverage: 0, totalBudget: 0 } });
  }

  const endDate = new Date();
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - parseInt(months));

  const expenses = await Expense.findByCompany(req.user.companyId, { startDate, endDate });

  const totalSpent = expenses.reduce((sum, e) => sum + e.amount, 0);
  const totalExpenses = expenses.length;
  const monthlyAverage = totalSpent / parseInt(months);

  const categoryTotals = expenses.reduce((acc, expense) => {
    acc[expense.category] = (acc[expense.category] || 0) + expense.amount;
    return acc;
  }, {});

  const topCategory = Object.entries(categoryTotals).reduce(
    (max, [category, amount]) => (amount > max.amount ? { category, amount } : max),
    { category: "", amount: 0 }
  );

  const budgets = await Budget.findByCompany(req.user.companyId, true);
  const totalBudget = budgets.reduce((sum, b) => sum + b.amount, 0);

  res.json({
    success: true,
    data: {
      totalSpent: Math.round(totalSpent * 100) / 100,
      totalExpenses,
      monthlyAverage: Math.round(monthlyAverage * 100) / 100,
      topCategory: topCategory.category || "N/A",
      topCategoryAmount: Math.round(topCategory.amount * 100) / 100,
      totalBudget: Math.round(totalBudget * 100) / 100,
      budgetUtilization: totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 10000) / 100 : 0,
      dateRange: {
        start: startDate.toISOString().split("T")[0],
        end: endDate.toISOString().split("T")[0],
      },
    },
  });
});

// GET /api/analytics/categories
export const getCategoryBreakdown = catchAsync(async (req, res) => {
  const { months = 3 } = req.query;

  if (!req.user.companyId) {
    return res.json({ success: true, data: [], totalSpent: 0 });
  }

  const endDate = new Date();
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - parseInt(months));

  const expenses = await Expense.findByCompany(req.user.companyId, { startDate, endDate });

  const categoryData = expenses.reduce((acc, expense) => {
    if (!acc[expense.category]) acc[expense.category] = { amount: 0, count: 0 };
    acc[expense.category].amount += expense.amount;
    acc[expense.category].count += 1;
    return acc;
  }, {});

  const totalSpent = expenses.reduce((sum, e) => sum + e.amount, 0);

  const result = Object.entries(categoryData)
    .map(([category, data]) => ({
      category,
      amount: Math.round(data.amount * 100) / 100,
      count: data.count,
      percentage: totalSpent > 0 ? Math.round((data.amount / totalSpent) * 10000) / 100 : 0,
      average: Math.round((data.amount / data.count) * 100) / 100,
    }))
    .sort((a, b) => b.amount - a.amount);

  res.json({ success: true, data: result, totalSpent: Math.round(totalSpent * 100) / 100 });
});

// GET /api/analytics/trends
export const getTrends = catchAsync(async (req, res) => {
  const { months = 6 } = req.query;

  if (!req.user.companyId) {
    return res.json({ success: true, data: [] });
  }

  const endDate = new Date();
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - parseInt(months));

  const expenses = await Expense.findByCompany(req.user.companyId, { startDate, endDate });

  const monthlyData = {};

  expenses.forEach((expense) => {
    const date = new Date(expense.date);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const monthName = date.toLocaleDateString("en-US", { month: "short", year: "numeric" });

    if (!monthlyData[monthKey]) {
      monthlyData[monthKey] = { month: monthName, amount: 0, count: 0, monthKey };
    }

    monthlyData[monthKey].amount += expense.amount;
    monthlyData[monthKey].count += 1;
  });

  const result = Object.values(monthlyData)
    .sort((a, b) => a.monthKey.localeCompare(b.monthKey))
    .map((item) => ({ ...item, amount: Math.round(item.amount * 100) / 100 }));

  res.json({ success: true, data: result, months: parseInt(months) });
});

// GET /api/analytics/budget-vs-actual
export const getBudgetVsActual = catchAsync(async (req, res) => {
  const { months = 1 } = req.query;

  if (!req.user.companyId) {
    return res.json({ success: true, data: [] });
  }

  const endDate = new Date();
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - parseInt(months));

  const [budgets, expenses] = await Promise.all([
    Budget.findByCompany(req.user.companyId, true),
    Expense.findByCompany(req.user.companyId, { startDate, endDate }),
  ]);

  const categorySpending = expenses.reduce((acc, expense) => {
    acc[expense.category] = (acc[expense.category] || 0) + expense.amount;
    return acc;
  }, {});

  const comparison = budgets.map((budget) => {
    const actualSpending = categorySpending[budget.category] || 0;
    const variance = budget.amount - actualSpending;
    const percentageUsed = budget.amount > 0 ? (actualSpending / budget.amount) * 100 : 0;

    return {
      category: budget.category,
      budgetName: budget.name,
      budgetAmount: Math.round(budget.amount * 100) / 100,
      actualSpending: Math.round(actualSpending * 100) / 100,
      variance: Math.round(variance * 100) / 100,
      percentageUsed: Math.round(percentageUsed * 100) / 100,
      status: budget.status,
      isOverBudget: actualSpending > budget.amount,
    };
  });

  res.json({ success: true, data: comparison });
});

// GET /api/analytics/user-performance
export const getUserPerformance = catchAsync(async (req, res) => {
  const { months = 3 } = req.query;

  if (!req.user.companyId) {
    return res.json({ success: true, data: [] });
  }

  const endDate = new Date();
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - parseInt(months));

  const expenses = await Expense.findByCompany(req.user.companyId, { startDate, endDate })
    .populate("userId", "firstName lastName email avatar");

  const userPerformance = {};

  expenses.forEach((expense) => {
    const userId = expense.userId?._id?.toString();
    if (!userId) return;

    if (!userPerformance[userId]) {
      userPerformance[userId] = {
        user: {
          id: expense.userId._id,
          name: `${expense.userId.firstName} ${expense.userId.lastName}`,
          email: expense.userId.email,
          avatar: expense.userId.avatar,
        },
        totalSpent: 0,
        expenseCount: 0,
        categories: {},
      };
    }

    userPerformance[userId].totalSpent += expense.amount;
    userPerformance[userId].expenseCount += 1;

    if (!userPerformance[userId].categories[expense.category]) {
      userPerformance[userId].categories[expense.category] = 0;
    }
    userPerformance[userId].categories[expense.category] += expense.amount;
  });

  const result = Object.values(userPerformance)
    .map((data) => {
      const categories = Object.entries(data.categories)
        .map(([category, amount]) => ({ category, amount }))
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 3);

      return {
        ...data,
        totalSpent: Math.round(data.totalSpent * 100) / 100,
        averageExpense: data.expenseCount > 0 ? Math.round((data.totalSpent / data.expenseCount) * 100) / 100 : 0,
        topCategories: categories.map((c) => ({ ...c, amount: Math.round(c.amount * 100) / 100 })),
      };
    })
    .sort((a, b) => b.totalSpent - a.totalSpent);

  res.json({ success: true, data: result });
});

// GET /api/analytics/meta
export const getAnalyticsMeta = catchAsync(async (req, res) => {
  const validCategories = getValidCategories();

  res.json({
    success: true,
    categories: validCategories,
    total: validCategories.length,
    lastUpdated: new Date(),
    note: "Categories are sourced from Budget schema enum (single source of truth)",
  });
});
