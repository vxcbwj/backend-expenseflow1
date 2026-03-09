// backend/src/routes/companies.js - WITH AUDIT LOGGING
import express from "express";
import Company from "../models/company.js";
import User from "../models/user.js";
import protect from "../middleware/authMiddleware.js";
import {
  requireAdmin,
  requirePermission,
  PERMISSIONS,
} from "../utils/roles.js";
import { auditLogger } from "../utils/auditLogger.js";

const router = express.Router();

// GET /api/companies - Get user's company
router.get("/", protect, async (req, res) => {
  try {
    const companyId = req.user.companyId;

    if (!companyId) {
      return res.json({
        success: true,
        company: null,
        message: "No company assigned",
      });
    }

    const company = await Company.findById(companyId)
      .populate("adminId", "firstName lastName email avatar")
      .populate("managerIds", "firstName lastName email avatar");

    if (!company) {
      return res.status(404).json({
        success: false,
        error: "Company not found",
      });
    }

    res.json({
      success: true,
      company,
      userRole: req.user.globalRole,
      canManage: req.user.isAdmin(),
    });
  } catch (error) {
    console.error("Get company error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch company",
    });
  }
});

// GET /api/companies/:id - Get specific company
router.get("/:id", protect, async (req, res) => {
  try {
    const { id } = req.params;

    if (!req.user.canAccessCompany(id)) {
      return res.status(403).json({
        success: false,
        error: "Access denied to this company",
      });
    }

    const company = await Company.findById(id)
      .populate("adminId", "firstName lastName email avatar")
      .populate("managerIds", "firstName lastName email avatar");

    if (!company) {
      return res.status(404).json({
        success: false,
        error: "Company not found",
      });
    }

    res.json({
      success: true,
      company,
      userRole: req.user.globalRole,
      canManage: req.user.isAdmin(),
    });
  } catch (error) {
    console.error("Get company error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch company",
    });
  }
});

// POST /api/companies - Create company (Admin only, after registration)
router.post("/", protect, requireAdmin, async (req, res) => {
  try {
    const {
      name,
      industry,
      currency,
      description,
      logo,
      email,
      phone,
      website,
      address,
    } = req.body;

    if (!name || !industry) {
      return res.status(400).json({
        success: false,
        error: "Company name and industry are required",
      });
    }

    if (req.user.companyId) {
      return res.status(400).json({
        success: false,
        error: "You already have a company",
      });
    }

    const company = await Company.create({
      name,
      industry,
      currency: currency || "USD",
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
        defaultCurrency: currency || "USD",
        budgetAlerts: true,
        expenseApprovalRequired: false,
        expenseThreshold: 1000,
      },
    });

    await req.user.assignToCompany(company._id);

    // Audit log for company creation
    await auditLogger.companyCreated(company._id, req.user._id, {
      name: company.name,
      industry: company.industry,
      currency: company.currency,
    });

    console.log("✅ Company created:", {
      companyId: company._id,
      adminId: req.user._id,
    });

    res.status(201).json({
      success: true,
      message: "Company created successfully",
      company,
    });
  } catch (error) {
    console.error("Create company error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to create company",
    });
  }
});

// PUT /api/companies/:id - Update company (Admin only)
router.put("/:id", protect, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    if (!req.user.canManageCompany(id)) {
      return res.status(403).json({
        success: false,
        error: "You can only update your own company",
      });
    }

    const {
      name,
      industry,
      currency,
      description,
      logo,
      email,
      phone,
      website,
      address,
      taxId,
      registrationNumber,
      fiscalYearStart,
      settings,
      isActive,
    } = req.body;

    const company = await Company.findById(id);
    if (!company) {
      return res.status(404).json({
        success: false,
        error: "Company not found",
      });
    }

    // Track changes for audit
    const changes = {};
    if (name && name !== company.name) {
      changes.name = { from: company.name, to: name };
      company.name = name;
    }
    if (industry && industry !== company.industry) {
      changes.industry = { from: company.industry, to: industry };
      company.industry = industry;
    }
    if (currency && currency !== company.currency) {
      changes.currency = { from: company.currency, to: currency };
      company.currency = currency;
    }
    if (description !== undefined && description !== company.description) {
      changes.description = { from: company.description, to: description };
      company.description = description;
    }
    if (logo !== undefined && logo !== company.logo) {
      changes.logo = { from: company.logo, to: logo };
      company.logo = logo;
    }
    if (email !== undefined && email !== company.email) {
      changes.email = { from: company.email, to: email };
      company.email = email;
    }
    if (phone !== undefined && phone !== company.phone) {
      changes.phone = { from: company.phone, to: phone };
      company.phone = phone;
    }
    if (website !== undefined && website !== company.website) {
      changes.website = { from: company.website, to: website };
      company.website = website;
    }
    if (address !== undefined && address !== company.address) {
      changes.address = { from: company.address, to: address };
      company.address = address;
    }
    if (taxId !== undefined && taxId !== company.taxId) {
      changes.taxId = { from: company.taxId, to: taxId };
      company.taxId = taxId;
    }
    if (
      registrationNumber !== undefined &&
      registrationNumber !== company.registrationNumber
    ) {
      changes.registrationNumber = {
        from: company.registrationNumber,
        to: registrationNumber,
      };
      company.registrationNumber = registrationNumber;
    }
    if (
      fiscalYearStart !== undefined &&
      fiscalYearStart !== company.fiscalYearStart
    ) {
      changes.fiscalYearStart = {
        from: company.fiscalYearStart,
        to: fiscalYearStart,
      };
      company.fiscalYearStart = fiscalYearStart;
    }
    if (isActive !== undefined && isActive !== company.isActive) {
      changes.isActive = { from: company.isActive, to: isActive };
      company.isActive = isActive;
    }

    if (settings) {
      changes.settings = {
        from: company.settings,
        to: { ...company.settings, ...settings },
      };
      company.settings = { ...company.settings, ...settings };
    }

    await company.save();

    // Audit log if changes were made
    if (Object.keys(changes).length > 0) {
      await auditLogger.companyUpdated(company._id, req.user._id, changes);
    }

    res.json({
      success: true,
      message: "Company updated successfully",
      company,
    });
  } catch (error) {
    console.error("Update company error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to update company",
    });
  }
});

// DELETE /api/companies/:id - Delete company (Admin only)
router.delete("/:id", protect, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    if (!req.user.canManageCompany(id)) {
      return res.status(403).json({
        success: false,
        error: "You can only delete your own company",
      });
    }

    const company = await Company.findById(id);
    if (!company) {
      return res.status(404).json({
        success: false,
        error: "Company not found",
      });
    }

    const managers = await User.find({
      companyId: id,
      globalRole: "manager",
    });

    // Audit log before deletion
    await auditLogger.companyDeleted(company._id, req.user._id);

    await Company.findByIdAndDelete(id);

    await req.user.removeFromCompany();

    await User.updateMany(
      { companyId: id },
      { $set: { companyId: null, joinedCompanyAt: null } }
    );

    console.log("✅ Company deleted:", {
      companyId: id,
      managersRemoved: managers.length,
    });

    res.json({
      success: true,
      message: "Company deleted successfully",
    });
  } catch (error) {
    console.error("Delete company error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to delete company",
    });
  }
});

// GET /api/companies/:id/managers - Get all managers
router.get("/:id/managers", protect, async (req, res) => {
  try {
    const { id } = req.params;

    if (!req.user.canAccessCompany(id)) {
      return res.status(403).json({
        success: false,
        error: "Access denied to this company",
      });
    }

    const managers = await User.findManagersByCompany(id);

    res.json({
      success: true,
      managers,
      count: managers.length,
    });
  } catch (error) {
    console.error("Get managers error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch managers",
    });
  }
});

// GET /api/companies/:id/users - Get all users (admin + managers)
router.get("/:id/users", protect, async (req, res) => {
  try {
    const { id } = req.params;

    if (!req.user.canAccessCompany(id)) {
      return res.status(403).json({
        success: false,
        error: "Access denied to this company",
      });
    }

    const users = await User.findByCompany(id);

    res.json({
      success: true,
      users,
      count: users.length,
    });
  } catch (error) {
    console.error("Get company users error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch company users",
    });
  }
});

export default router;
