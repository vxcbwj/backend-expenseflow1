// backend/src/models/auditLog.js
import mongoose from "mongoose";

const auditLogSchema = new mongoose.Schema(
  {
    action: {
      type: String,
      required: true,
      enum: [
        "CREATE",
        "UPDATE",
        "DELETE",
        "LOGIN",
        "LOGOUT",
        "INVITE",
        "ACCEPT_INVITATION",
        "REVOKE_INVITATION",
        "APPROVE",
        "REJECT",
        "PERMISSION_CHANGE",
      ],
    },

    entity: {
      type: String,
      required: true,
      enum: ["User", "Company", "Expense", "Budget", "Invitation", "System"],
    },

    entityId: {
      type: mongoose.Schema.Types.ObjectId,
      required: false,
    },

    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
    },

    details: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    ipAddress: {
      type: String,
    },

    userAgent: {
      type: String,
    },

    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  },
);

// Indexes
auditLogSchema.index({ userId: 1, timestamp: -1 });
auditLogSchema.index({ companyId: 1, timestamp: -1 });
auditLogSchema.index({ entity: 1, entityId: 1 });
auditLogSchema.index({ action: 1, timestamp: -1 });
auditLogSchema.index({ timestamp: -1 });

// Static methods
auditLogSchema.statics.log = async function (data) {
  try {
    const log = await this.create({
      action: data.action,
      entity: data.entity,
      entityId: data.entityId || null,
      userId: data.userId,
      companyId: data.companyId || null,
      details: data.details || {},
      ipAddress: data.ipAddress || null,
      userAgent: data.userAgent || null,
      timestamp: new Date(),
    });
    return log;
  } catch (error) {
    console.error("Audit log error:", error);
    return null;
  }
};

auditLogSchema.statics.findByUser = function (userId, limit = 50) {
  return this.find({ userId })
    .sort({ timestamp: -1 })
    .limit(limit)
    .populate("userId", "firstName lastName email");
};

auditLogSchema.statics.findByCompany = function (companyId, limit = 100) {
  return this.find({ companyId })
    .sort({ timestamp: -1 })
    .limit(limit)
    .populate("userId", "firstName lastName email");
};

auditLogSchema.statics.findByEntity = function (entity, entityId, limit = 50) {
  return this.find({ entity, entityId })
    .sort({ timestamp: -1 })
    .limit(limit)
    .populate("userId", "firstName lastName email");
};

auditLogSchema.statics.findRecent = function (limit = 100) {
  return this.find({})
    .sort({ timestamp: -1 })
    .limit(limit)
    .populate("userId", "firstName lastName email");
};

const AuditLog = mongoose.model("AuditLog", auditLogSchema);

export default AuditLog;
