// backend/src/models/invitation.js
import mongoose from "mongoose";
import crypto from "crypto";

const invitationSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
    },

    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },

    invitedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    role: {
      type: String,
      enum: ["manager"],
      default: "manager",
      required: true,
    },

    token: {
      type: String,
      required: true,
    },

    status: {
      type: String,
      enum: ["pending", "accepted", "expired", "revoked"],
      default: "pending",
    },

    expiresAt: {
      type: Date,
      required: true,
      default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },

    message: {
      type: String,
      maxlength: 500,
    },

    acceptedAt: {
      type: Date,
    },

    acceptedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// Indexes
invitationSchema.index({ email: 1, companyId: 1, status: 1 });
invitationSchema.index({ token: 1 }, { unique: true });

// Virtuals
invitationSchema.virtual("isActive").get(function () {
  return this.status === "pending" && this.expiresAt > new Date();
});

invitationSchema.virtual("isExpired").get(function () {
  return this.expiresAt <= new Date();
});

// Static methods
invitationSchema.statics.generateToken = function () {
  return crypto.randomBytes(32).toString("hex");
};

invitationSchema.statics.findActiveByToken = function (token) {
  return this.findOne({
    token,
    status: "pending",
    expiresAt: { $gt: new Date() },
  });
};

invitationSchema.statics.findByCompany = function (companyId) {
  return this.find({ companyId }).sort({ createdAt: -1 });
};

invitationSchema.statics.findPendingByEmail = function (email, companyId) {
  return this.findOne({
    email: email.toLowerCase(),
    companyId,
    status: "pending",
  });
};

// Instance methods
invitationSchema.methods.accept = async function (userId) {
  this.status = "accepted";
  this.acceptedAt = new Date();
  this.acceptedBy = userId;
  return this.save();
};

invitationSchema.methods.revoke = async function () {
  this.status = "revoked";
  return this.save();
};

invitationSchema.methods.regenerateToken = async function () {
  this.token = invitationSchema.statics.generateToken();
  this.expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  this.status = "pending";
  return this.save();
};

invitationSchema.methods.getInvitationLink = function () {
  const baseUrl = process.env.FRONTEND_URL || "http://localhost:3000";
  return `${baseUrl}/register?token=${this.token}`;
};

// Middleware
invitationSchema.pre("save", function (next) {
  if (!this.token) {
    this.token = invitationSchema.statics.generateToken();
  }
  next();
});

const Invitation = mongoose.model("Invitation", invitationSchema);

export default Invitation;
