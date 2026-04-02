// backend/src/controllers/expenseController.js
import Expense from "../models/expense.js";
import { auditLogger } from "../utils/auditLogger.js";
import { sanitizeText } from "../utils/sanitize.js";
import { uploadReceiptToCloudinary, deleteReceiptFromCloudinary } from "../utils/cloudinary.js";
import { sendExpenseApprovedEmail, sendExpenseRejectedEmail } from "../utils/emailService.js";
import catchAsync from "../utils/catchAsync.js";
import AppError from "../utils/AppError.js";

// ─── Local Helpers ────────────────────────────────────────────────────────────

const getValidDepartments = () => {
  try {
    return Expense.schema.path("department").enumValues || [];
  } catch (error) {
    console.error("Error getting departments:", error);
    return ["Sales & Marketing","Operations","Technology","Finance","Human Resources","Administration","Other"];
  }
};

const validateDepartment = (dept) => {
  if (!dept) return false;
  return getValidDepartments().includes(dept);
};

// ─── Handlers ─────────────────────────────────────────────────────────────────

// POST /api/expenses
export const createExpense = catchAsync(async (req, res, next) => {
  const { amount, category, department, description, date, vendor, paymentMethod, receiptUrl, notes } = req.body;

  if (!amount || !category || !description || !department) {
    return next(new AppError("Amount, category, description, and department are required", 400));
  }

  const parsedAmount = parseFloat(amount);
  if (isNaN(parsedAmount) || parsedAmount <= 0) {
    return next(new AppError("Amount must be a positive number", 400));
  }

  if (!validateDepartment(department)) {
    return next(new AppError(`Invalid department value. Allowed: ${getValidDepartments().join(", ")}`, 400));
  }

  if (!req.user.companyId) {
    return next(new AppError("You must be assigned to a company", 400));
  }

  const expense = await Expense.create({
    amount: parsedAmount,
    category,
    department,
    description: sanitizeText(description),
    date: date || new Date(),
    vendor: sanitizeText(vendor),
    paymentMethod,
    receiptUrl,
    notes: sanitizeText(notes),
    companyId: req.user.companyId,
    userId: req.user._id,
    createdBy: req.user.fullName,
  });

  await auditLogger.expenseCreated(
    expense._id,
    req.user._id,
    { amount: expense.amount, category: expense.category, department: expense.department, description: expense.description, vendor: expense.vendor },
    req.user.companyId
  );

  console.log("✅ Expense created:", { id: expense._id, amount: expense.amount, category: expense.category, department: expense.department });

  res.status(201).json({ success: true, message: "Expense created successfully", expense });
});

// GET /api/expenses/meta
export const getExpenseMeta = catchAsync(async (req, res) => {
  const categories = Expense.schema.path("category")?.enumValues || [];
  const paymentMethods = Expense.schema.path("paymentMethod")?.enumValues.filter((m) => m !== null) || [];
  const statuses = Expense.schema.path("status")?.enumValues || [];
  const departments = getValidDepartments();

  res.json({ success: true, categories, paymentMethods, statuses, departments });
});

// GET /api/expenses/summary/totals
export const getExpenseTotals = catchAsync(async (req, res) => {
  const { startDate, endDate } = req.query;

  if (!req.user.companyId) {
    return res.json({ success: true, summary: { totalAmount: 0, count: 0 } });
  }

  const summary = await Expense.getCompanyTotal(req.user.companyId, startDate, endDate);

  res.json({ success: true, summary });
});

// GET /api/expenses/summary/categories
export const getCategoryTotals = catchAsync(async (req, res) => {
  const { startDate, endDate } = req.query;

  if (!req.user.companyId) {
    return res.json({ success: true, categories: [] });
  }

  const categories = await Expense.getCategoryTotals(req.user.companyId, startDate, endDate);

  res.json({ success: true, categories });
});

// GET /api/expenses/summary/monthly
export const getMonthlyTotals = catchAsync(async (req, res) => {
  const { year = new Date().getFullYear() } = req.query;

  if (!req.user.companyId) {
    return res.json({ success: true, monthly: [] });
  }

  const monthly = await Expense.getMonthlyTotals(req.user.companyId, parseInt(year));

  res.json({ success: true, monthly });
});

// GET /api/expenses/summary/departments
export const getDepartmentTotals = catchAsync(async (req, res) => {
  const { startDate, endDate } = req.query;

  if (!req.user.companyId) {
    return res.json({ success: true, departments: [] });
  }

  const matchStage = { companyId: req.user.companyId };

  if (startDate || endDate) {
    matchStage.date = {};
    if (startDate) matchStage.date.$gte = new Date(startDate);
    if (endDate) matchStage.date.$lte = new Date(endDate);
  }

  const departments = await Expense.aggregate([
    { $match: matchStage },
    { $group: { _id: "$department", totalAmount: { $sum: "$amount" }, count: { $sum: 1 }, averageAmount: { $avg: "$amount" } } },
    { $sort: { totalAmount: -1 } },
  ]);

  res.json({ success: true, departments });
});

// GET /api/expenses
export const getExpenses = catchAsync(async (req, res, next) => {
  const { category, department, startDate, endDate, status, page = 1, limit = 50 } = req.query;

  if (!req.user.companyId) {
    return res.json({ success: true, expenses: [], count: 0, total: 0 });
  }

  if (department && !validateDepartment(department)) {
    return next(new AppError(`Invalid department value. Allowed: ${getValidDepartments().join(", ")}`, 400));
  }

  const MAX_PAGE_SIZE = 500;
  const safePage = Math.max(1, parseInt(page) || 1);
  const safeLimit = Math.min(parseInt(limit) || 50, MAX_PAGE_SIZE);

  const options = {
    ...(startDate && { startDate }),
    ...(endDate && { endDate }),
    ...(category && { category }),
    ...(department && { department }),
    ...(status && { status }),
  };

  const query = Expense.findByCompany(req.user.companyId, options);
  const skip = (safePage - 1) * safeLimit;

  const [expenses, total] = await Promise.all([
    query.skip(skip).limit(safeLimit),
    Expense.countDocuments(query.getQuery()),
  ]);

  res.json({ success: true, expenses, count: expenses.length, total, page: safePage, limit: safeLimit, totalPages: Math.ceil(total / safeLimit) });
});

// GET /api/expenses/:id
export const getExpense = catchAsync(async (req, res, next) => {
  const expense = await Expense.findById(req.params.id)
    .populate("userId", "firstName lastName email avatar")
    .populate("approvedBy", "firstName lastName email");

  if (!expense) return next(new AppError("Expense not found", 404));

  if (!req.user.canAccessCompany(expense.companyId)) {
    return next(new AppError("Access denied to this expense", 403));
  }

  res.json({ success: true, expense });
});

// PUT /api/expenses/:id
export const updateExpense = catchAsync(async (req, res, next) => {
  const expense = await Expense.findById(req.params.id);

  if (!expense) return next(new AppError("Expense not found", 404));
  if (!req.user.canAccessCompany(expense.companyId)) return next(new AppError("Access denied to this expense", 403));

  const { amount, category, department, description, date, vendor, paymentMethod, receiptUrl, notes, status } = req.body;

  if (status !== undefined && status !== null) {
    return next(new AppError("Status changes require approval/rejection endpoints", 403));
  }

  if (department && !validateDepartment(department)) {
    return next(new AppError(`Invalid department value. Allowed: ${getValidDepartments().join(", ")}`, 400));
  }

  if (amount !== undefined) {
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return next(new AppError("Amount must be a positive number", 400));
    }
  }

  const changes = {};
  if (amount !== undefined && parseFloat(amount) !== expense.amount) { const p = parseFloat(amount); changes.amount = { from: expense.amount, to: p }; expense.amount = p; }
  if (category && category !== expense.category) { changes.category = { from: expense.category, to: category }; expense.category = category; }
  if (department && department !== expense.department) { changes.department = { from: expense.department, to: department }; expense.department = department; }
  if (description && description !== expense.description) { changes.description = { from: expense.description, to: sanitizeText(description) }; expense.description = sanitizeText(description); }
  if (date && date !== expense.date) { changes.date = { from: expense.date, to: date }; expense.date = date; }
  if (vendor !== undefined && vendor !== expense.vendor) { changes.vendor = { from: expense.vendor, to: sanitizeText(vendor) }; expense.vendor = sanitizeText(vendor); }
  if (paymentMethod !== undefined && paymentMethod !== expense.paymentMethod) { changes.paymentMethod = { from: expense.paymentMethod, to: paymentMethod }; expense.paymentMethod = paymentMethod; }
  if (receiptUrl !== undefined && receiptUrl !== expense.receiptUrl) { changes.receiptUrl = { from: expense.receiptUrl, to: receiptUrl }; expense.receiptUrl = receiptUrl; }
  if (notes !== undefined && notes !== expense.notes) { changes.notes = { from: expense.notes, to: sanitizeText(notes) }; expense.notes = sanitizeText(notes); }

  await expense.save();

  if (Object.keys(changes).length > 0) {
    await auditLogger.expenseUpdated(expense._id, req.user._id, changes, req.user.companyId);
  }

  res.json({ success: true, message: "Expense updated successfully", expense });
});

// DELETE /api/expenses/:id
export const deleteExpense = catchAsync(async (req, res, next) => {
  const expenseToDelete = await Expense.findById(req.params.id);

  if (!expenseToDelete) return next(new AppError("Expense not found", 404));
  if (!req.user.canAccessCompany(expenseToDelete.companyId)) return next(new AppError("Access denied to this expense", 403));

  await auditLogger.expenseDeleted(expenseToDelete._id, req.user._id, req.user.companyId);
  await expenseToDelete.deleteOne();

  res.json({ success: true, message: "Expense deleted successfully" });
});

// POST /api/expenses/:id/approve
export const approveExpense = catchAsync(async (req, res, next) => {
  const expense = await Expense.findById(req.params.id);

  if (!expense) return next(new AppError("Expense not found", 404));
  if (!req.user.canAccessCompany(expense.companyId)) return next(new AppError("Access denied", 403));

  await expense.approve(req.user._id);

  await auditLogger.expenseApproved(
    expense._id,
    req.user._id,
    { amount: expense.amount, category: expense.category, department: expense.department, description: expense.description },
    req.user.companyId
  );

  try {
    await expense.populate("userId", "firstName lastName email");
    await sendExpenseApprovedEmail(
      expense,
      { firstName: req.user.firstName, lastName: req.user.lastName, email: req.user.email },
      expense.userId
    );
  } catch (emailError) {
    console.error("Email send failed (non-blocking):", emailError);
  }

  res.json({ success: true, message: "Expense approved successfully", expense });
});

// POST /api/expenses/:id/reject
export const rejectExpense = catchAsync(async (req, res, next) => {
  const { reason } = req.body;
  const expense = await Expense.findById(req.params.id);

  if (!expense) return next(new AppError("Expense not found", 404));
  if (!req.user.canAccessCompany(expense.companyId)) return next(new AppError("Access denied", 403));

  await expense.reject();

  await auditLogger.expenseRejected(
    expense._id,
    req.user._id,
    { amount: expense.amount, category: expense.category, department: expense.department, description: expense.description },
    req.user.companyId
  );

  try {
    await expense.populate("userId", "firstName lastName email");
    await sendExpenseRejectedEmail(expense, expense.userId, reason);
  } catch (emailError) {
    console.error("Email send failed (non-blocking):", emailError);
  }

  res.json({ success: true, message: "Expense rejected successfully", expense });
});

// POST /api/expenses/:id/receipts
export const uploadReceipts = catchAsync(async (req, res, next) => {
  const expense = await Expense.findById(req.params.id);

  if (!expense) return next(new AppError("Expense not found", 404));
  if (!req.user.canAccessCompany(expense.companyId)) return next(new AppError("Not authorized to upload receipts for this expense", 403));

  if (!req.files || req.files.length === 0) return next(new AppError("No files uploaded", 400));

  const totalReceipts = expense.receipts.length + req.files.length;
  if (totalReceipts > 5) {
    return next(new AppError(
      `Total receipts would exceed limit of 5. Current: ${expense.receipts.length}, Uploading: ${req.files.length}`,
      400
    ));
  }

  const uploadedReceipts = [];
  const uploadErrors = [];

  for (const file of req.files) {
    try {
      const uploadResult = await uploadReceiptToCloudinary(file.buffer, file.originalname, expense.companyId, expense._id);

      uploadedReceipts.push({
        fileName: file.originalname,
        fileUrl: uploadResult.url,
        fileType: file.mimetype.startsWith("image/") ? "image" : "pdf",
        cloudinaryId: uploadResult.publicId,
        thumbnailUrl: uploadResult.thumbnailUrl,
        size: file.size,
        uploadedBy: req.user._id,
      });
    } catch (error) {
      uploadErrors.push({ fileName: file.originalname, error: error.message });
    }
  }

  if (uploadErrors.length > 0 && uploadErrors.length === req.files.length) {
    return res.status(500).json({ success: false, error: "Failed to upload receipts", details: uploadErrors });
  }

  await expense.addReceipts(uploadedReceipts);
  const updatedExpense = await Expense.findById(expense._id);

  await auditLogger.expenseUpdated(
    expense._id,
    req.user._id,
    { receiptsAdded: uploadedReceipts.length, totalReceipts: updatedExpense.receipts.length },
    req.user.companyId
  );

  res.status(200).json({
    success: true,
    message: `${uploadedReceipts.length} receipt(s) uploaded successfully`,
    receipts: uploadedReceipts,
    expense: updatedExpense,
    totalReceipts: updatedExpense.receipts.length,
    remainingSlots: 5 - updatedExpense.receipts.length,
    errors: uploadErrors.length > 0 ? uploadErrors : undefined,
  });
});

// DELETE /api/expenses/:id/receipts/:receiptId
export const deleteReceipt = catchAsync(async (req, res, next) => {
  const expense = await Expense.findById(req.params.id);

  if (!expense) return next(new AppError("Expense not found", 404));
  if (!req.user.canAccessCompany(expense.companyId)) return next(new AppError("Not authorized to delete receipts for this expense", 403));

  const receipt = expense.receipts.find((r) => r._id.toString() === req.params.receiptId);

  if (!receipt) return next(new AppError("Receipt not found", 404));

  await deleteReceiptFromCloudinary(receipt.cloudinaryId);
  await expense.removeReceipt(req.params.receiptId);

  const updatedExpense = await Expense.findById(expense._id);

  await auditLogger.expenseUpdated(
    expense._id,
    req.user._id,
    { action: "receipt_deleted", receiptId: req.params.receiptId },
    req.user.companyId
  );

  res.status(200).json({
    success: true,
    message: "Receipt deleted successfully",
    expense: updatedExpense,
    totalReceipts: updatedExpense.receipts.length,
    remainingSlots: 5 - updatedExpense.receipts.length,
  });
});

// GET /api/expenses/:id/receipts/:receiptId
export const getReceipt = catchAsync(async (req, res, next) => {
  const expense = await Expense.findById(req.params.id);

  if (!expense) return next(new AppError("Expense not found", 404));
  if (!req.user.canAccessCompany(expense.companyId)) return next(new AppError("Not authorized to view receipts for this expense", 403));

  const receipt = expense.receipts.find((r) => r._id.toString() === req.params.receiptId);

  if (!receipt) return next(new AppError("Receipt not found", 404));

  res.status(200).json({ success: true, url: receipt.fileUrl, receipt });
});
