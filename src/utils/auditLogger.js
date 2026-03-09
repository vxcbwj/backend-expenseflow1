/**
 * Enhanced Audit Logger with Retry Queue
 * Ensures audit logs are persisted reliably (M2 FIXED)
 */

import AuditLog from "../models/auditLog.js";

/**
 * Audit Queue Management
 * Handles retrying failed audit log insertions with exponential backoff
 */
class AuditQueue {
  constructor() {
    this.queue = [];
    this.isProcessing = false;
    this.retryConfig = {
      maxRetries: 5,
      backoffMultiplier: 2,
      initialDelay: 1000, // 1 second
      maxDelay: 16000, // 16 seconds
    };
  }

  /**
   * Add a log entry to the queue
   * @param {Object} logEntry - The audit log entry
   * @param {number} attempt - Current attempt number (for retries)
   */
  addToQueue(logEntry, attempt = 1) {
    this.queue.push({
      logEntry,
      attempt,
      addedAt: Date.now(),
    });

    // Process queue if not already processing
    if (!this.isProcessing) {
      this.processQueue();
    }
  }

  /**
   * Get current queue status
   * @returns {Object} Queue statistics
   */
  getStatus() {
    return {
      queueSize: this.queue.length,
      isProcessing: this.isProcessing,
      retryConfig: this.retryConfig,
    };
  }

  /**
   * Process the retry queue
   * Exponential backoff strategy: 1s, 2s, 4s, 8s, 16s
   */
  async processQueue() {
    if (this.isProcessing || this.queue.length === 0) {
      return;
    }

    this.isProcessing = true;

    while (this.queue.length > 0) {
      const item = this.queue.shift();
      const { logEntry, attempt } = item;

      try {
        // Try to save the audit log
        const auditLog = new AuditLog(logEntry);
        await auditLog.save();

        if (attempt > 1) {
          console.log(
            `✅ Audit log successfully retried (attempt ${attempt}):`,
            logEntry.action,
          );
        }
      } catch (error) {
        // Retry logic with exponential backoff
        if (attempt < this.retryConfig.maxRetries) {
          const delay = Math.min(
            this.retryConfig.initialDelay *
              Math.pow(this.retryConfig.backoffMultiplier, attempt - 1),
            this.retryConfig.maxDelay,
          );

          console.warn(
            `⚠️  Audit log save failed (attempt ${attempt}/${this.retryConfig.maxRetries}). ` +
              `Retrying in ${delay}ms. Error: ${error.message}`,
          );

          // Re-queue with delay
          setTimeout(() => {
            this.addToQueue(logEntry, attempt + 1);
          }, delay);
        } else {
          // Max retries exceeded
          console.error(
            `❌ CRITICAL: Audit log failed after ${this.retryConfig.maxRetries} attempts. ` +
              `Log entry will be lost! Action: ${logEntry.action}, Entity: ${logEntry.entity}, ` +
              `Error: ${error.message}`,
          );
        }
      }
    }

    this.isProcessing = false;
  }
}

// Global audit queue instance
const auditQueue = new AuditQueue();

/**
 * Main audit log function with queue retry logic
 * @param {Object} options - Audit log options
 * @returns {Promise<AuditLog|null>}
 */
export const logAction = async ({
  action,
  entity,
  entityId = null,
  userId,
  companyId = null,
  details = {},
  ipAddress = null,
  userAgent = null,
}) => {
  try {
    const auditLogEntry = {
      action,
      entity,
      entityId,
      userId,
      companyId,
      details,
      ipAddress,
      userAgent,
      timestamp: new Date(),
    };

    // Try to save immediately
    const auditLog = new AuditLog(auditLogEntry);
    await auditLog.save();

    console.log(`📝 Audit logged: ${action} on ${entity} by ${userId}`);
    return auditLog;
  } catch (error) {
    // On error, add to retry queue (M2 FIXED)
    console.warn(
      `⚠️  Immediate audit log failed, adding to retry queue. Error: ${error.message}`,
    );

    auditQueue.addToQueue({
      action,
      entity,
      entityId,
      userId,
      companyId,
      details,
      ipAddress,
      userAgent,
      timestamp: new Date(),
    });

    return null;
  }
};

// Helper functions for common actions
export const auditLogger = {
  // User actions
  userCreated: (userId, adminId, userDetails, companyId = null) =>
    logAction({
      action: "CREATE",
      entity: "User",
      entityId: userId,
      userId: adminId,
      companyId,
      details: { ...userDetails },
    }),

  userUpdated: (userId, adminId, changes, companyId = null) =>
    logAction({
      action: "UPDATE",
      entity: "User",
      entityId: userId,
      userId: adminId,
      companyId,
      details: { changes },
    }),

  userDeleted: (userId, adminId, companyId = null) =>
    logAction({
      action: "DELETE",
      entity: "User",
      entityId: userId,
      userId: adminId,
      companyId,
      details: {},
    }),

  // Company actions
  companyCreated: (companyId, userId, companyDetails) =>
    logAction({
      action: "CREATE",
      entity: "Company",
      entityId: companyId,
      userId,
      companyId,
      details: { ...companyDetails },
    }),

  companyUpdated: (companyId, userId, changes) =>
    logAction({
      action: "UPDATE",
      entity: "Company",
      entityId: companyId,
      userId,
      companyId,
      details: { changes },
    }),

  companyDeleted: (companyId, userId) =>
    logAction({
      action: "DELETE",
      entity: "Company",
      entityId: companyId,
      userId,
      companyId,
      details: {},
    }),

  // Expense actions
  expenseCreated: (expenseId, userId, expenseDetails, companyId) =>
    logAction({
      action: "CREATE",
      entity: "Expense",
      entityId: expenseId,
      userId,
      companyId,
      details: { ...expenseDetails },
    }),

  expenseUpdated: (expenseId, userId, changes, companyId) =>
    logAction({
      action: "UPDATE",
      entity: "Expense",
      entityId: expenseId,
      userId,
      companyId,
      details: { changes },
    }),

  expenseDeleted: (expenseId, userId, companyId) =>
    logAction({
      action: "DELETE",
      entity: "Expense",
      entityId: expenseId,
      userId,
      companyId,
      details: {},
    }),

  expenseApproved: (expenseId, userId, expenseDetails, companyId) =>
    logAction({
      action: "APPROVE",
      entity: "Expense",
      entityId: expenseId,
      userId,
      companyId,
      details: { ...expenseDetails },
    }),

  expenseRejected: (expenseId, userId, expenseDetails, companyId) =>
    logAction({
      action: "REJECT",
      entity: "Expense",
      entityId: expenseId,
      userId,
      companyId,
      details: { ...expenseDetails },
    }),

  // Budget actions
  budgetCreated: (budgetId, userId, budgetDetails, companyId) =>
    logAction({
      action: "CREATE",
      entity: "Budget",
      entityId: budgetId,
      userId,
      companyId,
      details: { ...budgetDetails },
    }),

  budgetUpdated: (budgetId, userId, changes, companyId) =>
    logAction({
      action: "UPDATE",
      entity: "Budget",
      entityId: budgetId,
      userId,
      companyId,
      details: { changes },
    }),

  budgetDeleted: (budgetId, userId, companyId) =>
    logAction({
      action: "DELETE",
      entity: "Budget",
      entityId: budgetId,
      userId,
      companyId,
      details: {},
    }),

  // Invitation actions
  invitationSent: (invitationId, userId, invitationDetails, companyId) =>
    logAction({
      action: "INVITE",
      entity: "Invitation",
      entityId: invitationId,
      userId,
      companyId,
      details: { ...invitationDetails },
    }),

  invitationAccepted: (invitationId, userId, companyId) =>
    logAction({
      action: "ACCEPT_INVITATION",
      entity: "Invitation",
      entityId: invitationId,
      userId,
      companyId,
      details: {},
    }),

  invitationRevoked: (invitationId, userId, companyId) =>
    logAction({
      action: "REVOKE_INVITATION",
      entity: "Invitation",
      entityId: invitationId,
      userId,
      companyId,
      details: {},
    }),

  // System actions
  login: (userId, ipAddress, userAgent) =>
    logAction({
      action: "LOGIN",
      entity: "System",
      entityId: userId,
      userId,
      details: {},
      ipAddress,
      userAgent,
    }),

  logout: (userId) =>
    logAction({
      action: "LOGOUT",
      entity: "System",
      entityId: userId,
      userId,
      details: {},
    }),

  permissionChange: (userId, adminId, changes, companyId = null) =>
    logAction({
      action: "PERMISSION_CHANGE",
      entity: "User",
      entityId: userId,
      userId: adminId,
      companyId,
      details: { changes },
    }),
};

/**
 * Get audit queue status for monitoring
 */
export const getAuditQueueStatus = () => {
  return auditQueue.getStatus();
};

// ✅ FIXED M7: Removed withAuditLog middleware (was unused and had async issues)
// This middleware is not used in any routes and can cause response timing problems
// Use explicit auditLogger calls in route handlers instead

export default {
  logAction,
  auditLogger,
  getAuditQueueStatus,
  auditQueue,
};
