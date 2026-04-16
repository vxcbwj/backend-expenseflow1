// backend/src/controllers/companyController.js
import Company from "../models/company.js";
import User from "../models/user.js";
import { auditLogger } from "../utils/auditLogger.js";
import catchAsync from "../utils/catchAsync.js";
import AppError from "../utils/AppError.js";

// GET /api/companies
export const getMyCompany = catchAsync(async (req, res, next) => {
  const companyId = req.user.companyId;

  if (!companyId) {
    return res.json({ success: true, company: null, message: "No company assigned" });
  }

  const company = await Company.findById(companyId)
    .populate("adminId", "firstName lastName email avatar")
    .populate("managerIds", "firstName lastName email avatar");

  if (!company) return next(new AppError("Company not found", 404));

  res.json({ success: true, company, userRole: req.user.globalRole, canManage: req.user.isAdmin() });
});

// GET /api/companies/:id
export const getCompany = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  if (!req.user.canAccessCompany(id)) {
    return next(new AppError("Access denied to this company", 403));
  }

  const company = await Company.findById(id)
    .populate("adminId", "firstName lastName email avatar")
    .populate("managerIds", "firstName lastName email avatar");

  if (!company) return next(new AppError("Company not found", 404));

  res.json({ success: true, company, userRole: req.user.globalRole, canManage: req.user.isAdmin() });
});

// POST /api/companies
export const createCompany = catchAsync(async (req, res, next) => {
  const { name, industry, currency, description, logo, email, phone, website, address } = req.body;

  if (!name || !industry) return next(new AppError("Company name and industry are required", 400));
  if (req.user.companyId) return next(new AppError("You already have a company", 400));

  const company = await Company.create({
    name,
    industry,
    currency: currency || "DZD",
    description,
    logo,
    email,
    phone,
    website,
    address,
    adminId: req.user._id,
    managerIds: [],
    isActive: true,
    settings: {
      defaultCurrency: currency || "DZD",
      budgetAlerts: true,
      expenseApprovalRequired: false,
      expenseThreshold: 1000,
    },
  });

  await req.user.assignToCompany(company._id);

  await auditLogger.companyCreated(company._id, req.user._id, {
    name: company.name,
    industry: company.industry,
    currency: company.currency,
  });

  console.log("✅ Company created:", { companyId: company._id, adminId: req.user._id });

  res.status(201).json({ success: true, message: "Company created successfully", company });
});

// PUT /api/companies/:id
export const updateCompany = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  if (!req.user.canManageCompany(id)) return next(new AppError("You can only update your own company", 403));

  const { name, industry, currency, description, logo, email, phone, website, address, taxId, registrationNumber, fiscalYearStart, settings, isActive } = req.body;

  const company = await Company.findById(id);
  if (!company) return next(new AppError("Company not found", 404));

  const changes = {};
  if (name && name !== company.name) { changes.name = { from: company.name, to: name }; company.name = name; }
  if (industry && industry !== company.industry) { changes.industry = { from: company.industry, to: industry }; company.industry = industry; }
  if (currency && currency !== company.currency) { changes.currency = { from: company.currency, to: currency }; company.currency = currency; }
  if (description !== undefined && description !== company.description) { changes.description = { from: company.description, to: description }; company.description = description; }
  if (logo !== undefined && logo !== company.logo) { changes.logo = { from: company.logo, to: logo }; company.logo = logo; }
  if (email !== undefined && email !== company.email) { changes.email = { from: company.email, to: email }; company.email = email; }
  if (phone !== undefined && phone !== company.phone) { changes.phone = { from: company.phone, to: phone }; company.phone = phone; }
  if (website !== undefined && website !== company.website) { changes.website = { from: company.website, to: website }; company.website = website; }
  if (address !== undefined && address !== company.address) { changes.address = { from: company.address, to: address }; company.address = address; }
  if (taxId !== undefined && taxId !== company.taxId) { changes.taxId = { from: company.taxId, to: taxId }; company.taxId = taxId; }
  if (registrationNumber !== undefined && registrationNumber !== company.registrationNumber) {
    changes.registrationNumber = { from: company.registrationNumber, to: registrationNumber };
    company.registrationNumber = registrationNumber;
  }
  if (fiscalYearStart !== undefined && fiscalYearStart !== company.fiscalYearStart) {
    changes.fiscalYearStart = { from: company.fiscalYearStart, to: fiscalYearStart };
    company.fiscalYearStart = fiscalYearStart;
  }
  if (isActive !== undefined && isActive !== company.isActive) { changes.isActive = { from: company.isActive, to: isActive }; company.isActive = isActive; }
  if (settings) {
    changes.settings = { from: company.settings, to: { ...company.settings, ...settings } };
    company.settings = { ...company.settings, ...settings };
  }

  await company.save();

  if (Object.keys(changes).length > 0) {
    await auditLogger.companyUpdated(company._id, req.user._id, changes);
  }

  res.json({ success: true, message: "Company updated successfully", company });
});

// DELETE /api/companies/:id
export const deleteCompany = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  if (!req.user.canManageCompany(id)) return next(new AppError("You can only delete your own company", 403));

  const company = await Company.findById(id);
  if (!company) return next(new AppError("Company not found", 404));

  const managers = await User.find({ companyId: id, globalRole: "manager" });

  await auditLogger.companyDeleted(company._id, req.user._id);
  await Company.findByIdAndDelete(id);
  await req.user.removeFromCompany();
  await User.updateMany({ companyId: id }, { $set: { companyId: null, joinedCompanyAt: null } });

  console.log("✅ Company deleted:", { companyId: id, managersRemoved: managers.length });

  res.json({ success: true, message: "Company deleted successfully" });
});

// GET /api/companies/:id/managers
export const getManagers = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  if (!req.user.canAccessCompany(id)) return next(new AppError("Access denied to this company", 403));

  const managers = await User.findManagersByCompany(id);

  res.json({ success: true, managers, count: managers.length });
});

// GET /api/companies/:id/users
export const getCompanyUsers = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  if (!req.user.canAccessCompany(id)) return next(new AppError("Access denied to this company", 403));

  const users = await User.findByCompany(id);

  res.json({ success: true, users, count: users.length });
});
