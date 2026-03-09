import dotenv from "dotenv";
dotenv.config();

import { v2 as cloudinary } from "cloudinary";
import streamifier from "streamifier";
import config from "../config/env.js";

// ✅ FIXED: Use config object for Cloudinary credentials
cloudinary.config({
  cloud_name: config.cloudinary.cloudName,
  api_key: config.cloudinary.apiKey,
  api_secret: config.cloudinary.apiSecret,
});

// Validate configuration
if (!config.cloudinary.isConfigured) {
  console.warn("⚠️ Cloudinary not fully configured. File uploads will fail.");
  console.warn(
    "   Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET in .env",
  );
}

/**
 * Upload receipt/document to Cloudinary
 * @param {Buffer} buffer - File buffer from multer
 * @param {string} filename - Original filename
 * @param {string} companyId - Company ID for folder organization
 * @param {string} expenseId - Expense ID for folder organization
 * @returns {Promise<{url, publicId, format, size, resourceType, thumbnailUrl}>}
 */
export const uploadReceiptToCloudinary = (
  buffer,
  filename,
  companyId,
  expenseId,
) => {
  return new Promise((resolve, reject) => {
    try {
      // Sanitize filename for public_id
      const sanitizedName = filename
        .replace(/\.[^.]+$/, "") // Remove extension
        .replace(/\s+/g, "-") // Replace spaces with hyphens
        .toLowerCase();

      // Create upload stream
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: `expenses/${companyId}/${expenseId}`,
          public_id: sanitizedName,
          resource_type: "auto",
          transformation: [
            // Apply transformations for images
            {
              width: 1200,
              height: 1200,
              crop: "limit",
              quality: "auto:good",
            },
          ],
        },
        (error, result) => {
          if (error) {
            reject(error);
          } else {
            // Generate thumbnail for images
            const thumbnailUrl =
              result.resource_type === "image"
                ? cloudinary.url(result.public_id, {
                    width: 200,
                    height: 200,
                    crop: "fill",
                    gravity: "auto",
                  })
                : null;

            resolve({
              url: result.secure_url,
              publicId: result.public_id,
              format: result.format,
              size: result.bytes,
              resourceType: result.resource_type,
              thumbnailUrl,
            });
          }
        },
      );

      // Pipe buffer through streamifier to upload stream
      streamifier.createReadStream(buffer).pipe(stream);
    } catch (error) {
      reject(error);
    }
  });
};

/**
 * Delete receipt from Cloudinary
 * @param {string} publicId - Cloudinary public ID
 * @returns {Promise<{success: boolean, message: string}>}
 */
export const deleteReceiptFromCloudinary = async (publicId) => {
  try {
    const result = await cloudinary.uploader.destroy(publicId);

    return {
      success: result.result === "ok",
      message:
        result.result === "ok"
          ? "Receipt deleted successfully"
          : "Failed to delete receipt",
    };
  } catch (error) {
    console.error("❌ Error deleting from Cloudinary:", error);
    return {
      success: false,
      message: error.message,
    };
  }
};

export default cloudinary;
