// backend/src/models/budget.js
import mongoose from "mongoose";

const budgetSchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    category: {
      type: String,
      required: true,
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

    amount: {
      type: Number,
      required: true,
      min: 0.01,
    },

    period: {
      type: String,
      required: true,
      enum: ["monthly", "quarterly", "yearly", "custom"],
      default: "monthly",
    },

    startDate: {
      type: Date,
      required: true,
      default: Date.now,
    },

    endDate: {
      type: Date,
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    name: {
      type: String,
      trim: true,
      maxLength: 100,
    },

    description: {
      type: String,
      trim: true,
      maxLength: 500,
    },

    currentSpending: {
      type: Number,
      default: 0,
    },

    warningThreshold: {
      type: Number,
      default: 80,
    },

    status: {
      type: String,
      enum: ["on_track", "warning", "exceeded", "inactive"],
      default: "on_track",
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// Indexes
budgetSchema.index({ companyId: 1, isActive: 1 });
budgetSchema.index({ companyId: 1, category: 1 });
budgetSchema.index({ createdBy: 1 });

// Virtuals
budgetSchema.virtual("percentageUsed").get(function () {
  if (this.amount === 0) return 0;
  return Math.min(100, (this.currentSpending / this.amount) * 100);
});

budgetSchema.virtual("remaining").get(function () {
  return Math.max(0, this.amount - this.currentSpending);
});

budgetSchema.virtual("calculatedStatus").get(function () {
  if (!this.isActive) return "inactive";
  const percentageUsed = this.percentageUsed;
  if (percentageUsed >= 100) return "exceeded";
  if (percentageUsed >= this.warningThreshold) return "warning";
  return "on_track";
});

// Middleware
budgetSchema.pre("save", function (next) {
  this.status = this.calculatedStatus;
  next();
});

// Static methods
budgetSchema.statics.findByCompany = function (companyId, activeOnly = false) {
  const query = { companyId };
  if (activeOnly) query.isActive = true;
  return this.find(query).sort({ createdAt: -1 });
};

budgetSchema.statics.findByCategory = function (companyId, category) {
  return this.find({ companyId, category, isActive: true });
};

const Budget = mongoose.model("Budget", budgetSchema);

export default Budget;
