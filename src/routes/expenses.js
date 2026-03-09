// backend/src/routes/expenses.js - WITH ALL CRITICAL FIXES
import express from "express";
import Expense from "../models/expense.js";
import protect from "../middleware/authMiddleware.js";
import { requirePermission, PERMISSIONS } from "../utils/roles.js";
import { auditLogger } from "../utils/auditLogger.js";
import uploadMiddleware from "../middleware/upload.js";
import { sanitizeText } from "../utils/sanitize.js";
import {
  uploadReceiptToCloudinary,
  deleteReceiptFromCloudinary,
} from "../utils/cloudinary.js";
import {
  sendExpenseApprovedEmail,
  sendExpenseRejectedEmail,
} from "../utils/emailService.js";

const router = express.Router();

// ✅ FIXED C3: Get valid departments from schema for validation
const getValidDepartments = () => {
  try {
    return Expense.schema.path("department").enumValues || [];
  } catch (error) {
    console.error("Error getting departments:", error);
    return [
      "Sales & Marketing",
      "Operations",
      "Technology",
      "Finance",
      "Human Resources",
      "Administration",
      "Other",
    ];
  }
};

// ✅ FIXED C3: Department validation helper
const validateDepartment = (dept) => {
  if (!dept) return false;
  return getValidDepartments().includes(dept);
};

// POST /api/expenses - Create expense
router.post(
  "/",
  protect,
  requirePermission(PERMISSIONS.SUBMIT_EXPENSES),
  async (req, res) => {
    try {
      const {
        amount,
        category,
        department,
        description,
        date,
        vendor,
        paymentMethod,
        receiptUrl,
        notes,
      } = req.body;

      if (!amount || !category || !description || !department) {
        return res.status(400).json({
          success: false,
          error: "Amount, category, description, and department are required",
        });
      }

      // ✅ FIXED C3: Validate department before creating
      if (!validateDepartment(department)) {
        return res.status(400).json({
          success: false,
          error: `Invalid department value. Allowed: ${getValidDepartments().join(", ")}`,
        });
      }

      if (!req.user.companyId) {
        return res.status(400).json({
          success: false,
          error: "You must be assigned to a company",
        });
      }

      // ✅ FIXED M5: Sanitize text fields
      const expense = await Expense.create({
        amount,
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

      // Audit log
      await auditLogger.expenseCreated(
        expense._id,
        req.user._id,
        {
          amount: expense.amount,
          category: expense.category,
          department: expense.department,
          description: expense.description,
          vendor: expense.vendor,
        },
        req.user.companyId,
      );

      console.log("✅ Expense created:", {
        id: expense._id,
        amount: expense.amount,
        category: expense.category,
        department: expense.department,
      });

      res.status(201).json({
        success: true,
        message: "Expense created successfully",
        expense,
      });
    } catch (error) {
      console.error("Create expense error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to create expense",
      });
    }
  },
);

// GET /api/expenses - Get expenses
router.get(
  "/",
  protect,
  requirePermission(PERMISSIONS.VIEW_ALL_EXPENSES),
  async (req, res) => {
    try {
      const {
        category,
        department,
        startDate,
        endDate,
        status,
        page = 1,
        limit = 50,
      } = req.query;

      if (!req.user.companyId) {
        return res.json({
          success: true,
          expenses: [],
          count: 0,
          total: 0,
        });
      }

      // ✅ FIXED C3: Validate department filter before using
      if (department && !validateDepartment(department)) {
        return res.status(400).json({
          success: false,
          error: `Invalid department value. Allowed: ${getValidDepartments().join(", ")}`,
        });
      }

      // ✅ FIXED M6: Enforce max pagination limit of 500
      const MAX_PAGE_SIZE = 500;
      const safePage = Math.max(1, parseInt(page) || 1);
      const safeLimit = Math.min(parseInt(limit) || 50, MAX_PAGE_SIZE);

      const options = {
        startDate: startDate || new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
        endDate: endDate || new Date(),
        category,
        department,
        status,
      };

      const query = Expense.findByCompany(req.user.companyId, options);

      const skip = (safePage - 1) * safeLimit;
      const [expenses, total] = await Promise.all([
        query.skip(skip).limit(safeLimit),
        Expense.countDocuments(query.getQuery()),
      ]);

      res.json({
        success: true,
        expenses,
        count: expenses.length,
        total,
        page: safePage,
        limit: safeLimit,
        totalPages: Math.ceil(total / safeLimit),
      });
    } catch (error) {
      console.error("Get expenses error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch expenses",
      });
    }
  },
);

// GET /api/expenses/meta - Get expense metadata
router.get("/meta", protect, async (req, res) => {
  try {
    const categories = Expense.schema.path("category")?.enumValues || [];
    const paymentMethods =
      Expense.schema
        .path("paymentMethod")
        ?.enumValues.filter((m) => m !== null) || [];
    const statuses = Expense.schema.path("status")?.enumValues || [];
    const departments = getValidDepartments();

    res.json({
      success: true,
      categories,
      paymentMethods,
      statuses,
      departments,
    });
  } catch (error) {
    console.error("Get meta error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch metadata",
    });
  }
});

// GET /api/expenses/:id - Get single expense
router.get("/:id", protect, async (req, res) => {
  try {
    const expense = await Expense.findById(req.params.id)
      .populate("userId", "firstName lastName email avatar")
      .populate("approvedBy", "firstName lastName email");

    if (!expense) {
      return res.status(404).json({
        success: false,
        error: "Expense not found",
      });
    }

    if (!req.user.canAccessCompany(expense.companyId)) {
      return res.status(403).json({
        success: false,
        error: "Access denied to this expense",
      });
    }

    res.json({
      success: true,
      expense,
    });
  } catch (error) {
    console.error("Get expense error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch expense",
    });
  }
});

// PUT /api/expenses/:id - Update expense
router.put(
  "/:id",
  protect,
  requirePermission(PERMISSIONS.EDIT_EXPENSES),
  async (req, res) => {
    try {
      const expense = await Expense.findById(req.params.id);

      if (!expense) {
        return res.status(404).json({
          success: false,
          error: "Expense not found",
        });
      }

      if (!req.user.canAccessCompany(expense.companyId)) {
        return res.status(403).json({
          success: false,
          error: "Access denied to this expense",
        });
      }

      const {
        amount,
        category,
        department,
        description,
        date,
        vendor,
        paymentMethod,
        receiptUrl,
        notes,
        status,
      } = req.body;

      // ✅ FIXED C7: Block status changes via PUT - require approval/rejection endpoints
      if (status !== undefined && status !== null) {
        return res.status(403).json({
          success: false,
          error: "Status changes require approval/rejection endpoints",
          code: "STATUS_CHANGE_NOT_ALLOWED",
        });
      }

      // ✅ FIXED C3: Validate department if provided
      if (department && !validateDepartment(department)) {
        return res.status(400).json({
          success: false,
          error: `Invalid department value. Allowed: ${getValidDepartments().join(", ")}`,
        });
      }

      // Track changes for audit
      const changes = {};
      if (amount !== undefined && amount !== expense.amount) {
        changes.amount = { from: expense.amount, to: amount };
        expense.amount = amount;
      }
      if (category && category !== expense.category) {
        changes.category = { from: expense.category, to: category };
        expense.category = category;
      }
      if (department && department !== expense.department) {
        changes.department = { from: expense.department, to: department };
        expense.department = department;
      }
      if (description && description !== expense.description) {
        changes.description = {
          from: expense.description,
          to: sanitizeText(description),
        };
        expense.description = sanitizeText(description);
      }
      if (date && date !== expense.date) {
        changes.date = { from: expense.date, to: date };
        expense.date = date;
      }
      if (vendor !== undefined && vendor !== expense.vendor) {
        changes.vendor = { from: expense.vendor, to: sanitizeText(vendor) };
        expense.vendor = sanitizeText(vendor);
      }
      if (
        paymentMethod !== undefined &&
        paymentMethod !== expense.paymentMethod
      ) {
        changes.paymentMethod = {
          from: expense.paymentMethod,
          to: paymentMethod,
        };
        expense.paymentMethod = paymentMethod;
      }
      if (receiptUrl !== undefined && receiptUrl !== expense.receiptUrl) {
        changes.receiptUrl = { from: expense.receiptUrl, to: receiptUrl };
        expense.receiptUrl = receiptUrl;
      }
      if (notes !== undefined && notes !== expense.notes) {
        changes.notes = { from: expense.notes, to: sanitizeText(notes) };
        expense.notes = sanitizeText(notes);
      }

      await expense.save();

      // Audit log if changes were made
      if (Object.keys(changes).length > 0) {
        await auditLogger.expenseUpdated(
          expense._id,
          req.user._id,
          changes,
          req.user.companyId,
        );
      }

      res.json({
        success: true,
        message: "Expense updated successfully",
        expense,
      });
    } catch (error) {
      console.error("Update expense error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to update expense",
      });
    }
  },
);

// DELETE /api/expenses/:id - Delete expense
router.delete(
  "/:id",
  protect,
  requirePermission(PERMISSIONS.DELETE_EXPENSES),
  async (req, res) => {
    try {
      const expense = await Expense.findById(req.params.id);

      if (!expense) {
        return res.status(404).json({
          success: false,
          error: "Expense not found",
        });
      }

      if (!req.user.canAccessCompany(expense.companyId)) {
        return res.status(403).json({
          success: false,
          error: "Access denied to this expense",
        });
      }

      // Audit log before deletion
      await auditLogger.expenseDeleted(
        expense._id,
        req.user._id,
        req.user.companyId,
      );

      await Expense.findByIdAndDelete(req.params.id);

      res.json({
        success: true,
        message: "Expense deleted successfully",
      });
    } catch (error) {
      console.error("Delete expense error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to delete expense",
      });
    }
  },
);

// POST /api/expenses/:id/approve - Approve expense
router.post(
  "/:id/approve",
  protect,
  requirePermission(PERMISSIONS.EDIT_EXPENSES),
  async (req, res) => {
    try {
      const expense = await Expense.findById(req.params.id);

      if (!expense) {
        return res.status(404).json({
          success: false,
          error: "Expense not found",
        });
      }

      if (!req.user.canAccessCompany(expense.companyId)) {
        return res.status(403).json({
          success: false,
          error: "Access denied",
        });
      }

      await expense.approve(req.user._id);

      // Audit log
      await auditLogger.expenseApproved(
        expense._id,
        req.user._id,
        {
          amount: expense.amount,
          category: expense.category,
          department: expense.department,
          description: expense.description,
        },
        req.user.companyId,
      );

      // Send approval email (non-blocking)
      try {
        await expense.populate("userId", "firstName lastName email");
        await sendExpenseApprovedEmail(
          expense,
          {
            firstName: req.user.firstName,
            lastName: req.user.lastName,
            email: req.user.email,
          },
          expense.userId,
        );
      } catch (emailError) {
        console.error("Email send failed (non-blocking):", emailError);
      }

      res.json({
        success: true,
        message: "Expense approved successfully",
        expense,
      });
    } catch (error) {
      console.error("Approve expense error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to approve expense",
      });
    }
  },
);

// POST /api/expenses/:id/reject - Reject expense
router.post(
  "/:id/reject",
  protect,
  requirePermission(PERMISSIONS.EDIT_EXPENSES),
  async (req, res) => {
    try {
      const { reason } = req.body;
      const expense = await Expense.findById(req.params.id);

      if (!expense) {
        return res.status(404).json({
          success: false,
          error: "Expense not found",
        });
      }

      if (!req.user.canAccessCompany(expense.companyId)) {
        return res.status(403).json({
          success: false,
          error: "Access denied",
        });
      }

      await expense.reject();

      // Audit log
      await auditLogger.expenseRejected(
        expense._id,
        req.user._id,
        {
          amount: expense.amount,
          category: expense.category,
          department: expense.department,
          description: expense.description,
        },
        req.user.companyId,
      );

      // Send rejection email (non-blocking)
      try {
        await expense.populate("userId", "firstName lastName email");
        await sendExpenseRejectedEmail(expense, expense.userId, reason);
      } catch (emailError) {
        console.error("Email send failed (non-blocking):", emailError);
      }

      res.json({
        success: true,
        message: "Expense rejected successfully",
        expense,
      });
    } catch (error) {
      console.error("Reject expense error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to reject expense",
      });
    }
  },
);

// GET /api/expenses/summary/totals - Get expense summary
router.get("/summary/totals", protect, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    if (!req.user.companyId) {
      return res.json({
        success: true,
        summary: { totalAmount: 0, count: 0 },
      });
    }

    const summary = await Expense.getCompanyTotal(
      req.user.companyId,
      startDate,
      endDate,
    );

    res.json({
      success: true,
      summary,
    });
  } catch (error) {
    console.error("Get expense summary error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch expense summary",
    });
  }
});

// GET /api/expenses/summary/categories - Get category breakdown
router.get("/summary/categories", protect, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    if (!req.user.companyId) {
      return res.json({
        success: true,
        categories: [],
      });
    }

    const categories = await Expense.getCategoryTotals(
      req.user.companyId,
      startDate,
      endDate,
    );

    res.json({
      success: true,
      categories,
    });
  } catch (error) {
    console.error("Get category totals error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch category totals",
    });
  }
});

// GET /api/expenses/summary/monthly - Get monthly totals
router.get("/summary/monthly", protect, async (req, res) => {
  try {
    const { year = new Date().getFullYear() } = req.query;

    if (!req.user.companyId) {
      return res.json({
        success: true,
        monthly: [],
      });
    }

    const monthly = await Expense.getMonthlyTotals(
      req.user.companyId,
      parseInt(year),
    );

    res.json({
      success: true,
      monthly,
    });
  } catch (error) {
    console.error("Get monthly totals error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch monthly totals",
    });
  }
});

// GET /api/expenses/summary/departments - Get department breakdown
router.get("/summary/departments", protect, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    if (!req.user.companyId) {
      return res.json({
        success: true,
        departments: [],
      });
    }

    const matchStage = { companyId: req.user.companyId };

    if (startDate || endDate) {
      matchStage.date = {};
      if (startDate) matchStage.date.$gte = new Date(startDate);
      if (endDate) matchStage.date.$lte = new Date(endDate);
    }

    const departments = await Expense.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: "$department",
          totalAmount: { $sum: "$amount" },
          count: { $sum: 1 },
          averageAmount: { $avg: "$amount" },
        },
      },
      { $sort: { totalAmount: -1 } },
    ]);

    res.json({
      success: true,
      departments,
    });
  } catch (error) {
    console.error("Get department totals error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch department totals",
    });
  }
});

// POST /api/expenses/:id/receipts - Upload receipts
router.post("/:id/receipts", protect, uploadMiddleware, async (req, res) => {
  try {
    // 1. Find expense
    const expense = await Expense.findById(req.params.id);

    if (!expense) {
      return res.status(404).json({
        success: false,
        error: "Expense not found",
      });
    }

    // ✅ FIXED C1: Use canAccessCompany() consistently
    if (!req.user.canAccessCompany(expense.companyId)) {
      return res.status(403).json({
        success: false,
        error: "Not authorized to upload receipts for this expense",
      });
    }

    // 3. Check if files were uploaded
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        error: "No files uploaded",
      });
    }

    // 4. Check total receipts won't exceed limit
    const totalReceipts = expense.receipts.length + req.files.length;
    if (totalReceipts > 5) {
      return res.status(400).json({
        success: false,
        error: `Total receipts would exceed limit of 5. Current: ${expense.receipts.length}, Uploading: ${req.files.length}`,
      });
    }

    // 5. Upload files to Cloudinary
    const uploadedReceipts = [];
    const uploadErrors = [];

    for (const file of req.files) {
      try {
        const uploadResult = await uploadReceiptToCloudinary(
          file.buffer,
          file.originalname,
          expense.companyId,
          expense._id,
        );

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
        uploadErrors.push({
          fileName: file.originalname,
          error: error.message,
        });
      }
    }

    // 6. If all uploads failed, return error
    if (uploadErrors.length > 0 && uploadErrors.length === req.files.length) {
      return res.status(500).json({
        success: false,
        error: "Failed to upload receipts",
        details: uploadErrors,
      });
    }

    // 7. Add receipts to expense
    await expense.addReceipts(uploadedReceipts);

    // 8. Audit log
    await auditLogger.expenseUpdated(
      expense._id,
      req.user._id,
      { receipts: uploadedReceipts.length },
      req.user.companyId,
    );

    // 9. Return response
    res.status(200).json({
      success: true,
      message: `${uploadedReceipts.length} receipt(s) uploaded successfully`,
      receipts: uploadedReceipts,
      expense: expense,
      errors: uploadErrors.length > 0 ? uploadErrors : undefined,
    });
  } catch (error) {
    console.error("❌ Upload receipts error:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to upload receipts",
    });
  }
});

// DELETE /api/expenses/:id/receipts/:receiptId - Delete receipt
router.delete("/:id/receipts/:receiptId", protect, async (req, res) => {
  try {
    // 1. Find expense
    const expense = await Expense.findById(req.params.id);

    if (!expense) {
      return res.status(404).json({
        success: false,
        error: "Expense not found",
      });
    }

    // ✅ FIXED C1: Use canAccessCompany() consistently
    if (!req.user.canAccessCompany(expense.companyId)) {
      return res.status(403).json({
        success: false,
        error: "Not authorized to delete receipts for this expense",
      });
    }

    // 3. Find receipt in array
    const receipt = expense.receipts.find(
      (r) => r._id.toString() === req.params.receiptId,
    );

    if (!receipt) {
      return res.status(404).json({
        success: false,
        error: "Receipt not found",
      });
    }

    // 4. Delete from Cloudinary
    await deleteReceiptFromCloudinary(receipt.cloudinaryId);

    // 5. Remove from expense
    await expense.removeReceipt(req.params.receiptId);

    // 6. Audit log
    await auditLogger.expenseUpdated(
      expense._id,
      req.user._id,
      { action: "receipt_deleted", receiptId: req.params.receiptId },
      req.user.companyId,
    );

    // 7. Return response
    res.status(200).json({
      success: true,
      message: "Receipt deleted successfully",
      expense: expense,
    });
  } catch (error) {
    console.error("❌ Delete receipt error:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to delete receipt",
    });
  }
});

// GET /api/expenses/:id/receipts/:receiptId - Get receipt URL
router.get("/:id/receipts/:receiptId", protect, async (req, res) => {
  try {
    // 1. Find expense
    const expense = await Expense.findById(req.params.id);

    if (!expense) {
      return res.status(404).json({
        success: false,
        error: "Expense not found",
      });
    }

    // ✅ FIXED C1: Use canAccessCompany() consistently
    if (!req.user.canAccessCompany(expense.companyId)) {
      return res.status(403).json({
        success: false,
        error: "Not authorized to view receipts for this expense",
      });
    }

    // 3. Find receipt
    const receipt = expense.receipts.find(
      (r) => r._id.toString() === req.params.receiptId,
    );

    if (!receipt) {
      return res.status(404).json({
        success: false,
        error: "Receipt not found",
      });
    }

    // 4. Return receipt URL
    res.status(200).json({
      success: true,
      url: receipt.fileUrl,
      receipt: receipt,
    });
  } catch (error) {
    console.error("❌ Get receipt error:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to get receipt",
    });
  }
});

export default router;
