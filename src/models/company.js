// backend/src/models/company.js
import mongoose from "mongoose";

const companySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    industry: {
      type: String,
      required: true,
    },

    adminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    managerIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    currency: {
      type: String,
      default: "DZD",
    },

    description: {
      type: String,
      trim: true,
    },

    logo: {
      type: String,
    },

    email: {
      type: String,
      lowercase: true,
      trim: true,
    },

    phone: {
      type: String,
      trim: true,
    },

    website: {
      type: String,
      trim: true,
    },

    address: {
      type: String,
      trim: true,
    },

    taxId: {
      type: String,
      trim: true,
    },

    registrationNumber: {
      type: String,
      trim: true,
    },

    fiscalYearStart: {
      type: Number,
      min: 1,
      max: 12,
      default: 1,
    },

    settings: {
      defaultCurrency: {
        type: String,
        default: "DZD",
      },
      budgetAlerts: {
        type: Boolean,
        default: true,
      },
      expenseApprovalRequired: {
        type: Boolean,
        default: false,
      },
      expenseThreshold: {
        type: Number,
        default: 1000,
      },
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// Indexes
companySchema.index({ adminId: 1 });
companySchema.index({ name: 1 });
companySchema.index({ isActive: 1 });

// Instance methods
companySchema.methods.addManager = async function (managerId) {
  if (!this.managerIds.includes(managerId)) {
    this.managerIds.push(managerId);
    return this.save();
  }
  return this;
};

companySchema.methods.removeManager = async function (managerId) {
  this.managerIds = this.managerIds.filter(
    (id) => id.toString() !== managerId.toString(),
  );
  return this.save();
};

companySchema.methods.isManager = function (userId) {
  return this.managerIds.some((id) => id.toString() === userId.toString());
};

companySchema.methods.isAdmin = function (userId) {
  return this.adminId.toString() === userId.toString();
};

companySchema.methods.hasAccess = function (userId) {
  return this.isAdmin(userId) || this.isManager(userId);
};

// Static methods
companySchema.statics.findByAdmin = function (adminId) {
  return this.findOne({ adminId, isActive: true });
};

companySchema.statics.findActiveCompanies = function () {
  return this.find({ isActive: true }).sort({ createdAt: -1 });
};

const Company = mongoose.model("Company", companySchema);

export default Company;
