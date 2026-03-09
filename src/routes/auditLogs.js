// backend/src/routes/auditLogs.js - VIEW AUDIT LOGS
import express from "express";
import AuditLog from "../models/auditLog.js";
import protect from "../middleware/authMiddleware.js";
import { requireAdmin } from "../utils/roles.js";

const router = express.Router();

// GET /api/audit-logs - Get audit logs for user's company
router.get("/", protect, requireAdmin, async (req, res) => {
  try {
    const {
      limit = 100,
      page = 1,
      action,
      entity,
      startDate,
      endDate,
    } = req.query;

    if (!req.user.companyId) {
      return res.json({
        success: true,
        logs: [],
        count: 0,
        page: 1,
        totalPages: 0,
      });
    }

    // Build query
    const query = { companyId: req.user.companyId };

    if (action) {
      query.action = action;
    }

    if (entity) {
      query.entity = entity;
    }

    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) {
        query.timestamp.$gte = new Date(startDate);
      }
      if (endDate) {
        query.timestamp.$lte = new Date(endDate);
      }
    }

    // Execute query with pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [logs, total] = await Promise.all([
      AuditLog.find(query)
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .populate("userId", "firstName lastName email avatar")
        .lean(),
      AuditLog.countDocuments(query),
    ]);

    res.json({
      success: true,
      logs,
      count: logs.length,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / parseInt(limit)),
    });
  } catch (error) {
    console.error("Get audit logs error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch audit logs",
    });
  }
});

// GET /api/audit-logs/entity/:entity/:entityId - Get logs for specific entity
router.get(
  "/entity/:entity/:entityId",
  protect,
  requireAdmin,
  async (req, res) => {
    try {
      const { entity, entityId } = req.params;
      const { limit = 50 } = req.query;

      const logs = await AuditLog.findByEntity(
        entity,
        entityId,
        parseInt(limit)
      );

      res.json({
        success: true,
        logs,
        count: logs.length,
      });
    } catch (error) {
      console.error("Get entity audit logs error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch entity audit logs",
      });
    }
  }
);

// GET /api/audit-logs/user/:userId - Get logs for specific user
router.get("/user/:userId", protect, requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 50 } = req.query;

    // Verify the user belongs to the same company
    const logs = await AuditLog.find({
      userId,
      companyId: req.user.companyId,
    })
      .sort({ timestamp: -1 })
      .limit(parseInt(limit))
      .populate("userId", "firstName lastName email avatar")
      .lean();

    res.json({
      success: true,
      logs,
      count: logs.length,
    });
  } catch (error) {
    console.error("Get user audit logs error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch user audit logs",
    });
  }
});

// GET /api/audit-logs/recent - Get recent activity
router.get("/recent", protect, requireAdmin, async (req, res) => {
  try {
    const { limit = 20 } = req.query;

    if (!req.user.companyId) {
      return res.json({
        success: true,
        logs: [],
        count: 0,
      });
    }

    const logs = await AuditLog.find({ companyId: req.user.companyId })
      .sort({ timestamp: -1 })
      .limit(parseInt(limit))
      .populate("userId", "firstName lastName email avatar")
      .lean();

    res.json({
      success: true,
      logs,
      count: logs.length,
    });
  } catch (error) {
    console.error("Get recent audit logs error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch recent audit logs",
    });
  }
});

// GET /api/audit-logs/stats - Get audit statistics
router.get("/stats", protect, requireAdmin, async (req, res) => {
  try {
    if (!req.user.companyId) {
      return res.json({
        success: true,
        stats: {
          totalLogs: 0,
          byAction: {},
          byEntity: {},
          recentActivity: [],
        },
      });
    }

    const { days = 30 } = req.query;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    // Get logs for the period
    const logs = await AuditLog.find({
      companyId: req.user.companyId,
      timestamp: { $gte: startDate },
    }).lean();

    // Calculate statistics
    const byAction = logs.reduce((acc, log) => {
      acc[log.action] = (acc[log.action] || 0) + 1;
      return acc;
    }, {});

    const byEntity = logs.reduce((acc, log) => {
      acc[log.entity] = (acc[log.entity] || 0) + 1;
      return acc;
    }, {});

    // Get activity by day
    const activityByDay = logs.reduce((acc, log) => {
      const date = new Date(log.timestamp).toISOString().split("T")[0];
      acc[date] = (acc[date] || 0) + 1;
      return acc;
    }, {});

    // Convert to array and sort
    const recentActivity = Object.entries(activityByDay)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => b.date.localeCompare(a.date));

    res.json({
      success: true,
      stats: {
        totalLogs: logs.length,
        byAction,
        byEntity,
        recentActivity,
        period: {
          days: parseInt(days),
          startDate: startDate.toISOString(),
          endDate: new Date().toISOString(),
        },
      },
    });
  } catch (error) {
    console.error("Get audit stats error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch audit statistics",
    });
  }
});

// GET /api/audit-logs/actions - Get available actions
router.get("/actions", protect, requireAdmin, async (req, res) => {
  try {
    const actions = [
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
    ];

    res.json({
      success: true,
      actions,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Failed to fetch actions",
    });
  }
});

// GET /api/audit-logs/entities - Get available entities
router.get("/entities", protect, requireAdmin, async (req, res) => {
  try {
    const entities = [
      "User",
      "Company",
      "Expense",
      "Budget",
      "Invitation",
      "System",
    ];

    res.json({
      success: true,
      entities,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Failed to fetch entities",
    });
  }
});

export default router;
