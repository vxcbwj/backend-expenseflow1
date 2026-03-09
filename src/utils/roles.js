// backend/src/utils/roles.js - SIMPLIFIED 2-ROLE SYSTEM

export const ROLES = {
  ADMIN: "admin",
  MANAGER: "manager",
};

export const PERMISSIONS = {
  // Admin-only permissions
  CREATE_COMPANY: "create_company",
  DELETE_COMPANY: "delete_company",
  INVITE_MANAGERS: "invite_managers",
  REMOVE_MANAGERS: "remove_managers",
  SET_COMPANY_SETTINGS: "set_company_settings",

  // Shared permissions (both admin and manager)
  SET_BUDGETS: "set_budgets",
  VIEW_ALL_EXPENSES: "view_all_expenses",
  SUBMIT_EXPENSES: "submit_expenses",
  EDIT_EXPENSES: "edit_expenses",
  DELETE_EXPENSES: "delete_expenses",
  GENERATE_REPORTS: "generate_reports",
  EXPORT_DATA: "export_data",
  VIEW_ANALYTICS: "view_analytics",
};

const ROLE_PERMISSIONS = {
  admin: [
    PERMISSIONS.CREATE_COMPANY,
    PERMISSIONS.DELETE_COMPANY,
    PERMISSIONS.INVITE_MANAGERS,
    PERMISSIONS.REMOVE_MANAGERS,
    PERMISSIONS.SET_COMPANY_SETTINGS,
    PERMISSIONS.SET_BUDGETS,
    PERMISSIONS.VIEW_ALL_EXPENSES,
    PERMISSIONS.SUBMIT_EXPENSES,
    PERMISSIONS.EDIT_EXPENSES,
    PERMISSIONS.DELETE_EXPENSES,
    PERMISSIONS.GENERATE_REPORTS,
    PERMISSIONS.EXPORT_DATA,
    PERMISSIONS.VIEW_ANALYTICS,
  ],

  manager: [
    PERMISSIONS.SET_BUDGETS,
    PERMISSIONS.VIEW_ALL_EXPENSES,
    PERMISSIONS.SUBMIT_EXPENSES,
    PERMISSIONS.EDIT_EXPENSES,
    PERMISSIONS.DELETE_EXPENSES,
    PERMISSIONS.GENERATE_REPORTS,
    PERMISSIONS.EXPORT_DATA,
    PERMISSIONS.VIEW_ANALYTICS,
  ],
};

export const hasPermission = (user, permission) => {
  if (!user || !user.globalRole) return false;
  if (!permission) return false;

  const rolePermissions = ROLE_PERMISSIONS[user.globalRole] || [];
  return rolePermissions.includes(permission);
};

export const isAdmin = (user) => {
  return user?.globalRole === ROLES.ADMIN;
};

export const isManager = (user) => {
  return user?.globalRole === ROLES.MANAGER;
};

export const canManageCompany = (user, companyId) => {
  if (!user || !companyId) return false;
  if (!isAdmin(user)) return false;
  return user.companyId?.toString() === companyId.toString();
};

export const canInviteManagers = (user, companyId) => {
  return canManageCompany(user, companyId);
};

export const canAccessCompany = (user, companyId) => {
  if (!user || !companyId) return false;
  if (!user.companyId) return false;
  return user.companyId.toString() === companyId.toString();
};

export const requirePermission = (permission) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: "Authentication required",
      });
    }

    if (hasPermission(req.user, permission)) {
      return next();
    }

    return res.status(403).json({
      success: false,
      error: "Insufficient permissions",
      required: permission,
      userRole: req.user.globalRole,
    });
  };
};

export const requireAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: "Authentication required",
    });
  }

  if (!isAdmin(req.user)) {
    return res.status(403).json({
      success: false,
      error: "Admin access required",
      userRole: req.user.globalRole,
    });
  }

  next();
};

export const requireManager = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: "Authentication required",
    });
  }

  if (!isManager(req.user)) {
    return res.status(403).json({
      success: false,
      error: "Manager access required",
      userRole: req.user.globalRole,
    });
  }

  next();
};

export const requireAdminOrManager = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: "Authentication required",
    });
  }

  if (!isAdmin(req.user) && !isManager(req.user)) {
    return res.status(403).json({
      success: false,
      error: "Admin or Manager access required",
      userRole: req.user.globalRole,
    });
  }

  next();
};

export const requireCompanyAccess = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: "Authentication required",
    });
  }

  const companyId =
    req.params.companyId ||
    req.params.id ||
    req.body.companyId ||
    req.query.companyId;

  if (!companyId) {
    return res.status(400).json({
      success: false,
      error: "Company ID is required",
    });
  }

  if (!canAccessCompany(req.user, companyId)) {
    return res.status(403).json({
      success: false,
      error: "Access denied to this company",
      userCompanyId: req.user.companyId,
      requestedCompanyId: companyId,
    });
  }

  req.companyId = companyId;
  next();
};

export default {
  ROLES,
  PERMISSIONS,
  hasPermission,
  isAdmin,
  isManager,
  canManageCompany,
  canInviteManagers,
  canAccessCompany,
  requirePermission,
  requireAdmin,
  requireManager,
  requireAdminOrManager,
  requireCompanyAccess,
};
