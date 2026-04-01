// backend/src/models/expense.js
import mongoose from "mongoose";
import { deleteReceiptFromCloudinary } from "../utils/cloudinary.js";

// Helper function to validate receipts array length
function arrayLimit(val) {
  return val.length <= 5;
}

const expenseSchema = new mongoose.Schema(
  {
    amount: {
      type: Number,
      required: [true, "Amount is required"],
      min: [0, "Amount cannot be negative"],
    },

    category: {
      type: String,
      required: [true, "Category is required"],
      enum: [
        "Office Supplies",
        "Software",
        "Hardware",
        "Travel",
        "Meals & Entertainment",
        "Marketing",
        "Utilities",
        "Rent",
        "Salaries",
        "Consulting",
        "Insurance",
        "Training",
        "Maintenance",
        "Shipping",
        "Advertising",
        "Legal",
        "Taxes",
        "Other",
      ],
    },

    department: {
      type: String,
      required: [true, "Department is required"],
      enum: [
        "Sales & Marketing",
        "Operations",
        "Technology",
        "Finance",
        "Human Resources",
        "Administration",
        "Other",
      ],
      default: "Other",
    },

    description: {
      type: String,
      required: [true, "Description is required"],
      trim: true,
      maxlength: [500, "Description cannot exceed 500 characters"],
    },

    date: {
      type: Date,
      required: true,
      default: Date.now,
    },

    vendor: {
      type: String,
      trim: true,
    },

    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: [true, "Company ID is required"],
    },

    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User ID is required"],
    },

    createdBy: {
      type: String,
      required: true,
    },

    isRecurring: {
      type: Boolean,
      default: false,
    },

    recurrenceInterval: {
      type: String,
      enum: ["monthly", "quarterly", "yearly", null],
      default: null,
    },

    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "paid"],
      default: "pending",
    },

    notes: {
      type: String,
      trim: true,
      maxlength: [1000, "Notes cannot exceed 1000 characters"],
    },

    attachments: [
      {
        fileName: String,
        fileUrl: String,
        uploadedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],

    paymentMethod: {
      type: String,
      enum: ["Credit Card", "Bank Transfer", "Cash", "Check", "Other", null],
      default: null,
    },

    receiptUrl: {
      type: String,
      default: null,
    },

    receipts: {
      type: [
        {
          fileName: {
            type: String,
            required: true,
          },
          fileUrl: {
            type: String,
            required: true,
          },
          fileType: {
            type: String,
            enum: ["image", "pdf"],
            required: true,
          },
          cloudinaryId: {
            type: String,
            required: true,
          },
          thumbnailUrl: {
            type: String,
            default: null,
          },
          uploadedAt: {
            type: Date,
            default: Date.now,
          },
          size: {
            type: Number,
            required: true,
          },
          uploadedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
          },
        },
      ],
      validate: [arrayLimit, "{PATH} exceeds the limit of 5 receipts"],
      default: [],
    },

    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    approvedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// Indexes
expenseSchema.index({ companyId: 1, date: -1 });
expenseSchema.index({ companyId: 1, category: 1 });
expenseSchema.index({ companyId: 1, department: 1, date: -1 });
expenseSchema.index({ companyId: 1, department: 1, category: 1 });
expenseSchema.index({ userId: 1, date: -1 });
expenseSchema.index({ companyId: 1, userId: 1, date: -1 });
expenseSchema.index({ companyId: 1, status: 1 });

// Virtual for total receipts count
expenseSchema.virtual("receiptCount").get(function () {
  return this.receipts ? this.receipts.length : 0;
});

// Virtual for checking if more receipts can be added
expenseSchema.virtual("canAddReceipts").get(function () {
  return this.receiptCount < 5;
});

// Static methods
expenseSchema.statics.getCategoryTotals = async function (
  companyId,
  startDate,
  endDate,
) {
  const matchStage = { companyId };

  if (startDate || endDate) {
    matchStage.date = {};
    if (startDate) matchStage.date.$gte = new Date(startDate);
    if (endDate) matchStage.date.$lte = new Date(endDate);
  }

  return this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: "$category",
        totalAmount: { $sum: "$amount" },
        count: { $sum: 1 },
        averageAmount: { $avg: "$amount" },
      },
    },
    { $sort: { totalAmount: -1 } },
  ]);
};

expenseSchema.statics.getMonthlyTotals = async function (companyId, year) {
  const startDate = new Date(year, 0, 1);
  const endDate = new Date(year, 11, 31, 23, 59, 59);

  return this.aggregate([
    {
      $match: {
        companyId,
        date: { $gte: startDate, $lte: endDate },
      },
    },
    {
      $group: {
        _id: { $month: "$date" },
        totalAmount: { $sum: "$amount" },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);
};

expenseSchema.statics.getCompanyTotal = async function (
  companyId,
  startDate,
  endDate,
) {
  const matchStage = { companyId };

  if (startDate || endDate) {
    matchStage.date = {};
    if (startDate) matchStage.date.$gte = new Date(startDate);
    if (endDate) matchStage.date.$lte = new Date(endDate);
  }

  const result = await this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: null,
        totalAmount: { $sum: "$amount" },
        count: { $sum: 1 },
      },
    },
  ]);

  return result[0] || { totalAmount: 0, count: 0 };
};

expenseSchema.statics.findByCompany = function (companyId, options = {}) {
  const query = { companyId };

  if (options.startDate || options.endDate) {
    query.date = {};
    if (options.startDate) query.date.$gte = new Date(options.startDate);
    if (options.endDate) query.date.$lte = new Date(options.endDate);
  }

  if (options.category) query.category = options.category;
  if (options.department) query.department = options.department;
  if (options.userId) query.userId = options.userId;
  if (options.status) query.status = options.status;

  return this.find(query).sort({ date: -1, createdAt: -1 });
};

// Static method to get expenses by category for budget tracking
expenseSchema.statics.getCategorySpending = async function (
  companyId,
  category,
  startDate,
  endDate,
) {
  const matchStage = {
    companyId,
    category,
    status: { $in: ["approved", "paid"] },
  };

  if (startDate || endDate) {
    matchStage.date = {};
    if (startDate) matchStage.date.$gte = new Date(startDate);
    if (endDate) matchStage.date.$lte = new Date(endDate);
  }

  const result = await this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: null,
        totalAmount: { $sum: "$amount" },
        count: { $sum: 1 },
      },
    },
  ]);

  return result[0] || { totalAmount: 0, count: 0 };
};

// Instance methods
expenseSchema.methods.approve = async function (approverId) {
  this.status = "approved";
  this.approvedBy = approverId;
  this.approvedAt = new Date();
  return this.save();
};

expenseSchema.methods.reject = async function () {
  this.status = "rejected";
  return this.save();
};

expenseSchema.methods.markAsPaid = async function () {
  this.status = "paid";
  return this.save();
};

expenseSchema.methods.duplicate = async function (newDate = new Date()) {
  const duplicatedExpense = new this.constructor({
    ...this.toObject(),
    _id: undefined,
    date: newDate,
    status: "pending",
    approvedBy: undefined,
    approvedAt: undefined,
    createdAt: undefined,
    updatedAt: undefined,
    receipts: [],
  });

  return duplicatedExpense.save();
};

// Instance method: Add receipts
expenseSchema.methods.addReceipts = async function (receiptsData) {
  if (this.receipts.length + receiptsData.length > 5) {
    throw new Error(
      `Cannot add ${receiptsData.length} receipts. Maximum is 5, currently have ${this.receipts.length}`,
    );
  }

  this.receipts.push(...receiptsData);
  return await this.save();
};

// Instance method: Remove receipt
expenseSchema.methods.removeReceipt = async function (receiptId) {
  const receiptIndex = this.receipts.findIndex(
    (r) => r._id.toString() === receiptId.toString(),
  );

  if (receiptIndex === -1) {
    throw new Error("Receipt not found");
  }

  const receipt = this.receipts[receiptIndex];

  this.receipts = this.receipts.filter(
    (r) => r._id.toString() !== receiptId.toString(),
  );

  await this.save();

  return receipt;
};

// Pre-save: track which fields changed so post-save hook knows whether to sync budget
expenseSchema.pre("save", function (next) {
  this._statusChanged = this.isModified("status");
  this._amountChanged = this.isModified("amount");
  this._categoryChanged = this.isModified("category");
  next();
});

// Post-save: sync budget spending atomically when relevant fields change
// ✅ FIX: mongoose.model("Budget") is wrapped in its own try/catch so if the
//         Budget model hasn't been registered yet (e.g. during tests or early
//         startup) the hook exits cleanly instead of throwing an unhandled error.
expenseSchema.post("save", async function (doc) {
  const shouldSync =
    doc._statusChanged || doc._amountChanged || doc._categoryChanged;
  if (!shouldSync) return;

  try {
    if (!["approved", "paid"].includes(doc.status)) return;

    let Budget;
    try {
      Budget = mongoose.model("Budget");
    } catch {
      // Budget model not registered yet — skip sync safely
      return;
    }

    const budget = await Budget.findOne({
      companyId: doc.companyId,
      category: doc.category,
      isActive: true,
      startDate: { $lte: doc.date },
      $or: [{ endDate: { $gte: doc.date } }, { endDate: null }],
    });

    if (!budget) return;

    const Expense = mongoose.model("Expense");
    const spending = await Expense.getCategorySpending(
      budget.companyId,
      budget.category,
      budget.startDate,
      budget.endDate,
    );

    // Atomic update — avoids race conditions from concurrent expense saves
    await Budget.updateOne(
      { _id: budget._id },
      {
        $set: {
          currentSpending: spending.totalAmount,
          updatedAt: new Date(),
        },
      },
    );

    console.log(
      `✅ Budget synced (atomic): ${budget.category} = ${spending.totalAmount}`,
    );
  } catch (error) {
    console.error("Failed to sync budget spending:", error);
    // Non-blocking — expense save already succeeded
  }
});

// Post-deleteOne: sync budget when an approved/paid expense is removed
// ✅ FIX: Same guarded mongoose.model("Budget") pattern as post-save above.
expenseSchema.post("deleteOne", { document: true }, async function (doc) {
  try {
    if (!["approved", "paid"].includes(doc.status)) return;

    let Budget;
    try {
      Budget = mongoose.model("Budget");
    } catch {
      // Budget model not registered yet — skip sync safely
      return;
    }

    const budget = await Budget.findOne({
      companyId: doc.companyId,
      category: doc.category,
      isActive: true,
    });

    if (!budget) return;

    const Expense = mongoose.model("Expense");
    const spending = await Expense.getCategorySpending(
      budget.companyId,
      budget.category,
      budget.startDate,
      budget.endDate,
    );

    await Budget.updateOne(
      { _id: budget._id },
      {
        $set: {
          currentSpending: spending.totalAmount,
          updatedAt: new Date(),
        },
      },
    );

    console.log(
      `✅ Budget synced on delete (atomic): ${budget.category} = ${spending.totalAmount}`,
    );
  } catch (error) {
    console.error("Failed to sync budget on expense deletion:", error);
  }
});

// Pre-deleteOne: clean up all receipts from Cloudinary before the document is removed
// Must use { document: true, query: false } so `this` is the document instance.
expenseSchema.pre(
  "deleteOne",
  { document: true, query: false },
  async function (next) {
    try {
      for (const receipt of this.receipts) {
        await deleteReceiptFromCloudinary(receipt.cloudinaryId);
      }
      next();
    } catch (error) {
      console.error("❌ Error deleting receipts from Cloudinary:", error);
      next(error);
    }
  },
);

const Expense = mongoose.model("Expense", expenseSchema);

export default Expense;
