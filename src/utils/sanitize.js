// backend/src/utils/sanitize.js
/**
 * Text sanitization utilities
 * Simple regex-based approach without external dependencies
 */

/**
 * Sanitize text input to prevent XSS attacks
 * Removes potentially dangerous characters and HTML tags
 * @param {string} text - The text to sanitize
 * @returns {string} - Sanitized text
 */
export const sanitizeText = (text) => {
  if (!text || typeof text !== "string") {
    return "";
  }

  return text
    .replace(/[<>]/g, "") // Remove < and > to prevent HTML injection
    .replace(/javascript:/gi, "") // Remove javascript: protocol
    .replace(/on\w+\s*=/gi, "") // Remove event handlers (onclick, onload, etc.)
    .replace(/data:text\/html/gi, "") // Remove data URLs
    .trim();
};

/**
 * Sanitize filename for safe storage
 * Removes special characters and normalizes spaces
 * @param {string} filename - The filename to sanitize
 * @returns {string} - Sanitized filename
 */
export const sanitizeFilename = (filename) => {
  if (!filename || typeof filename !== "string") {
    return "unnamed_file";
  }

  // Get file extension
  const lastDotIndex = filename.lastIndexOf(".");
  const name =
    lastDotIndex > 0 ? filename.substring(0, lastDotIndex) : filename;
  const ext = lastDotIndex > 0 ? filename.substring(lastDotIndex) : "";

  // Sanitize the name part
  const sanitizedName = name
    .replace(/[^a-zA-Z0-9_\-\s]/g, "") // Only allow alphanumeric, underscore, hyphen, space
    .replace(/\s+/g, "_") // Replace spaces with underscores
    .substring(0, 100); // Limit length

  // Sanitize extension (only allow common file types)
  const allowedExtensions = [
    ".jpg",
    ".jpeg",
    ".png",
    ".gif",
    ".webp", // Images
    ".pdf",
    ".doc",
    ".docx", // Documents
    ".txt",
    ".csv",
    ".xlsx",
    ".xls", // Data files
  ];

  const sanitizedExt = allowedExtensions.includes(ext.toLowerCase())
    ? ext.toLowerCase()
    : "";

  return sanitizedName + sanitizedExt || "unnamed_file";
};

/**
 * Sanitize email address
 * Basic email format validation and sanitization
 * @param {string} email - The email to sanitize
 * @returns {string} - Sanitized email or empty string if invalid
 */
export const sanitizeEmail = (email) => {
  if (!email || typeof email !== "string") {
    return "";
  }

  const sanitized = email.toLowerCase().trim().replace(/[<>]/g, "");

  // Basic email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(sanitized) ? sanitized : "";
};

/**
 * Sanitize HTML for display (strip all tags)
 * @param {string} html - The HTML to sanitize
 * @returns {string} - Text without HTML tags
 */
export const stripHtml = (html) => {
  if (!html || typeof html !== "string") {
    return "";
  }

  return html
    .replace(/<[^>]*>/g, "") // Remove all HTML tags
    .trim();
};

/**
 * Sanitize URL
 * Ensures URL uses safe protocols (http/https)
 * @param {string} url - The URL to sanitize
 * @returns {string} - Sanitized URL or empty string if invalid
 */
export const sanitizeUrl = (url) => {
  if (!url || typeof url !== "string") {
    return "";
  }

  const trimmed = url.trim();

  // Only allow http and https protocols
  if (trimmed.match(/^https?:\/\//i)) {
    return trimmed;
  }

  // If no protocol, assume https
  if (!trimmed.match(/^[a-z]+:/i)) {
    return `https://${trimmed}`;
  }

  // Invalid protocol
  return "";
};

/**
 * Sanitize object recursively
 * Applies text sanitization to all string values in an object
 * @param {Object} obj - The object to sanitize
 * @returns {Object} - Sanitized object
 */
export const sanitizeObject = (obj) => {
  if (!obj || typeof obj !== "object") {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeObject(item));
  }

  const sanitized = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === "string") {
      sanitized[key] = sanitizeText(value);
    } else if (typeof value === "object" && value !== null) {
      sanitized[key] = sanitizeObject(value);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
};

export default {
  sanitizeText,
  sanitizeFilename,
  sanitizeEmail,
  stripHtml,
  sanitizeUrl,
  sanitizeObject,
};
