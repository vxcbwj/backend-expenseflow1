// backend/src/controllers/auditLogController.js
import AuditLog from "../models/auditLog.js";
import catchAsync from "../utils/catchAsync.js";

// GET /api/audit-logs
export const getAuditLogs = catchAsync(async (req, res) => {
  const { limit = 100, page = 1, action, entity, startDate, endDate } = req.query;

  if (!req.user.companyId) {
    return res.json({ success: true, logs: [], count: 0, page: 1, totalPages: 0 });
  }

  const query = { companyId: req.user.companyId };

  if (action) query.action = action;
  if (entity) query.entity = entity;

  if (startDate || endDate) {
    query.timestamp = {};
    if (startDate) query.timestamp.$gte = new Date(startDate);
    if (endDate) query.timestamp.$lte = new Date(endDate);
  }

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
});

// GET /api/audit-logs/entity/:entity/:entityId
export const getEntityLogs = catchAsync(async (req, res) => {
  const { entity, entityId } = req.params;
  const { limit = 50 } = req.query;

  const logs = await AuditLog.findByEntity(entity, entityId, parseInt(limit));

  res.json({ success: true, logs, count: logs.length });
});

// GET /api/audit-logs/user/:userId
export const getUserLogs = catchAsync(async (req, res) => {
  const { userId } = req.params;
  const { limit = 50 } = req.query;

  const logs = await AuditLog.find({ userId, companyId: req.user.companyId })
    .sort({ timestamp: -1 })
    .limit(parseInt(limit))
    .populate("userId", "firstName lastName email avatar")
    .lean();

  res.json({ success: true, logs, count: logs.length });
});

// GET /api/audit-logs/recent
export const getRecentLogs = catchAsync(async (req, res) => {
  const { limit = 20 } = req.query;

  if (!req.user.companyId) {
    return res.json({ success: true, logs: [], count: 0 });
  }

  const logs = await AuditLog.find({ companyId: req.user.companyId })
    .sort({ timestamp: -1 })
    .limit(parseInt(limit))
    .populate("userId", "firstName lastName email avatar")
    .lean();

  res.json({ success: true, logs, count: logs.length });
});

// GET /api/audit-logs/stats
export const getAuditStats = catchAsync(async (req, res) => {
  if (!req.user.companyId) {
    return res.json({ success: true, stats: { totalLogs: 0, byAction: {}, byEntity: {}, recentActivity: [] } });
  }

  const { days = 30 } = req.query;
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - parseInt(days));

  const logs = await AuditLog.find({
    companyId: req.user.companyId,
    timestamp: { $gte: startDate },
  }).lean();

  const byAction = logs.reduce((acc, log) => { acc[log.action] = (acc[log.action] || 0) + 1; return acc; }, {});
  const byEntity = logs.reduce((acc, log) => { acc[log.entity] = (acc[log.entity] || 0) + 1; return acc; }, {});

  const activityByDay = logs.reduce((acc, log) => {
    const date = new Date(log.timestamp).toISOString().split("T")[0];
    acc[date] = (acc[date] || 0) + 1;
    return acc;
  }, {});

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
      period: { days: parseInt(days), startDate: startDate.toISOString(), endDate: new Date().toISOString() },
    },
  });
});

// GET /api/audit-logs/actions
export const getActions = catchAsync(async (req, res) => {
  const actions = [
    "CREATE","UPDATE","DELETE","LOGIN","LOGOUT","INVITE",
    "ACCEPT_INVITATION","REVOKE_INVITATION","APPROVE","REJECT","PERMISSION_CHANGE",
  ];
  res.json({ success: true, actions });
});

// GET /api/audit-logs/entities
export const getEntities = catchAsync(async (req, res) => {
  const entities = ["User","Company","Expense","Budget","Invitation","System"];
  res.json({ success: true, entities });
});
