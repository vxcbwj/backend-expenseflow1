// backend/src/models/user.js
import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
    },

    password: {
      type: String,
      required: true,
    },

    firstName: {
      type: String,
      required: true,
      trim: true,
    },

    lastName: {
      type: String,
      required: true,
      trim: true,
    },

    phone: {
      type: String,
      trim: true,
    },

    avatar: {
      type: String,
    },

    globalRole: {
      type: String,
      enum: ["admin", "manager"],
      default: "manager",
      required: true,
    },

    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      default: null,
    },

    joinedCompanyAt: {
      type: Date,
      default: null,
    },

    // ✅ ADDED: Missing isActive field
    isActive: {
      type: Boolean,
      default: true,
    },

    // Future-proof fields for a 4 user role system
    departmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Department",
      default: null,
    },

    canApproveExpenses: {
      type: Boolean,
      default: null, // null = use role default
    },

    maxApprovalAmount: {
      type: Number,
      default: null, // null = unlimited
    },

    metadata: {
      type: Object,
      default: {},
    },

    preferences: {
      theme: {
        type: String,
        enum: ["light", "dark", "auto"],
        default: "auto",
      },
      currency: {
        type: String,
        default: "USD",
      },
      language: {
        type: String,
        default: "en",
      },
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// Virtual properties
userSchema.virtual("fullName").get(function () {
  return `${this.firstName} ${this.lastName}`;
});

userSchema.virtual("initials").get(function () {
  return `${this.firstName?.[0] || ""}${
    this.lastName?.[0] || ""
  }`.toUpperCase();
});

// Instance methods
userSchema.methods.isAdmin = function () {
  return this.globalRole === "admin";
};

userSchema.methods.isManager = function () {
  return this.globalRole === "manager";
};

userSchema.methods.canAccessCompany = function (companyId) {
  if (!companyId || !this.companyId) return false;
  return this.companyId.toString() === companyId.toString();
};

userSchema.methods.canManageCompany = function (companyId) {
  if (!this.isAdmin()) return false;
  return this.canAccessCompany(companyId);
};

userSchema.methods.canInviteManagers = function (companyId) {
  return this.canManageCompany(companyId);
};

userSchema.methods.assignToCompany = async function (companyId) {
  if (!companyId) {
    throw new Error("Company ID is required");
  }

  if (this.companyId && this.companyId.toString() !== companyId.toString()) {
    throw new Error("User already belongs to a company");
  }

  this.companyId = companyId;
  this.joinedCompanyAt = new Date();

  return this.save();
};

userSchema.methods.removeFromCompany = async function () {
  this.companyId = null;
  this.joinedCompanyAt = null;

  return this.save();
};

// ✅ UPDATED: Added isActive to safe object
userSchema.methods.toSafeObject = function () {
  const userObj = this.toObject();
  delete userObj.password;

  return {
    id: userObj._id?.toString(),
    email: userObj.email,
    firstName: userObj.firstName,
    lastName: userObj.lastName,
    fullName: this.fullName,
    initials: this.initials,
    phone: userObj.phone,
    avatar: userObj.avatar,
    globalRole: userObj.globalRole,
    companyId: userObj.companyId,
    joinedCompanyAt: userObj.joinedCompanyAt,
    isActive: userObj.isActive, // ✅ ADDED
    preferences: userObj.preferences,
    createdAt: userObj.createdAt,
    updatedAt: userObj.updatedAt,
  };
};

// Static methods
userSchema.statics.findByEmail = function (email) {
  if (!email) return null;
  return this.findOne({ email: email.toLowerCase().trim() });
};

userSchema.statics.emailExists = async function (email) {
  if (!email) return false;
  const count = await this.countDocuments({
    email: email.toLowerCase().trim(),
  });
  return count > 0;
};

userSchema.statics.findByCompany = function (companyId) {
  if (!companyId) return [];
  return this.find({ companyId }).select("-password");
};

userSchema.statics.findManagersByCompany = function (companyId) {
  if (!companyId) return [];
  return this.find({
    companyId,
    globalRole: "manager",
  }).select("-password");
};

userSchema.statics.findAdminByCompany = function (companyId) {
  if (!companyId) return null;
  return this.findOne({
    companyId,
    globalRole: "admin",
  }).select("-password");
};

// ✅ ADDED: Static method to find active users
userSchema.statics.findActiveUsers = function (companyId) {
  if (!companyId) return [];
  return this.find({
    companyId,
    isActive: true,
  }).select("-password");
};

// Middleware
userSchema.pre("save", function (next) {
  if (this.email) this.email = this.email.toLowerCase().trim();
  if (this.firstName) this.firstName = this.firstName.trim();
  if (this.lastName) this.lastName = this.lastName.trim();
  if (this.phone) this.phone = this.phone.trim();

  next();
});

// Indexes
userSchema.index({ companyId: 1 });
userSchema.index({ globalRole: 1 });
userSchema.index({ companyId: 1, globalRole: 1 });
userSchema.index({ email: 1 }, { unique: true }); // ✅ ADDED: Ensure email uniqueness
userSchema.index({ isActive: 1 }); // ✅ ADDED: Index for filtering active users

const User = mongoose.model("User", userSchema);

export default User;
