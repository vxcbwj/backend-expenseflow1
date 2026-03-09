import multer from "multer";
import { sanitizeFilename } from "../utils/sanitize.js";

// ✅ FIXED C6: Configure storage with proper limits
const storage = multer.memoryStorage();

// ✅ FIXED C6: Enhanced file filter with better validation
const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = [
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "application/pdf",
  ];

  // Check MIME type
  if (!allowedMimeTypes.includes(file.mimetype)) {
    const error = new Error(
      `Invalid file type: ${file.mimetype}. Allowed: JPEG, PNG, GIF, WebP, PDF`,
    );
    error.code = "INVALID_MIME_TYPE";
    return cb(error, false);
  }

  // Validate file extension matches MIME type
  const mimeToExt = {
    "image/jpeg": ["jpg", "jpeg"],
    "image/png": ["png"],
    "image/gif": ["gif"],
    "image/webp": ["webp"],
    "application/pdf": ["pdf"],
  };

  const fileExt = file.originalname.split(".").pop()?.toLowerCase() || "";
  const allowedExts = mimeToExt[file.mimetype] || [];

  if (!allowedExts.includes(fileExt)) {
    const error = new Error(
      `File extension ${fileExt} doesn't match MIME type ${file.mimetype}`,
    );
    error.code = "EXTENSION_MISMATCH";
    return cb(error, false);
  }

  // Sanitize filename
  try {
    file.originalname = sanitizeFilename(file.originalname);
    cb(null, true);
  } catch (err) {
    cb(err, false);
  }
};

// ✅ FIXED C6: Configure multer with strict limits
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB per file - CRITICAL
    files: 5, // Max 5 files per request (matches Expense schema)
  },
});

// ✅ FIXED C6: Middleware with validation and error handling
const uploadMiddleware = (req, res, next) => {
  // Upload files with strict limits (allow up to 5 receipts per expense)
  upload.array("receipts", 5)(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      // Multer error
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(413).json({
          success: false,
          error: "File too large. Maximum size is 5MB",
          code: "FILE_SIZE_EXCEEDED",
        });
      }
      if (err.code === "LIMIT_FILE_COUNT") {
        return res.status(413).json({
          success: false,
          error: "Too many files. Maximum is 5 files per request",
          code: "FILE_COUNT_EXCEEDED",
        });
      }
      if (err.code === "LIMIT_PART_COUNT") {
        return res.status(413).json({
          success: false,
          error: "Too many form fields",
          code: "PART_COUNT_EXCEEDED",
        });
      }
      return res.status(400).json({
        success: false,
        error: err.message,
        code: "UPLOAD_ERROR",
      });
    } else if (err) {
      // Custom error from fileFilter
      return res.status(400).json({
        success: false,
        error: err.message,
        code: err.code || "FILE_VALIDATION_FAILED",
      });
    }

    // ✅ FIXED C6: Additional validation after upload
    if (!req.files || req.files.length === 0) {
      return next(); // No files, let route handler deal with it
    }

    // Validate each file
    for (const file of req.files) {
      if (!file.buffer) {
        return res.status(400).json({
          success: false,
          error: "File buffer missing",
          code: "BUFFER_MISSING",
        });
      }
      if (file.size > 5 * 1024 * 1024) {
        return res.status(413).json({
          success: false,
          error: `File ${file.originalname} exceeds 5MB limit`,
          code: "FILE_SIZE_EXCEEDED",
        });
      }
    }

    next();
  });
};

// Export middleware for array uploads
export default uploadMiddleware;

// Also export base upload for flexibility
export { upload, uploadMiddleware };
