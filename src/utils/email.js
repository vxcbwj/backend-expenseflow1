import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

// Email configuration
let isEmailConfigured = false;

// Create email transporter
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: parseInt(process.env.SMTP_PORT) || 587,
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// Verify email configuration on startup
if (process.env.SMTP_USER && process.env.SMTP_PASS) {
  transporter
    .verify()
    .then(() => {
      console.log("✅ Email service ready");
      isEmailConfigured = true;
    })
    .catch((error) => {
      console.warn("⚠️ Email verification failed:", error.message);
      console.warn(
        "   Emails will not be sent. Check SMTP credentials in .env",
      );
      isEmailConfigured = false;
    });
} else {
  console.warn(
    "⚠️ Email not configured. Set SMTP_USER and SMTP_PASS in .env to enable email notifications",
  );
}

/**
 * Send email using nodemailer
 * @param {Object} options - Email options
 * @param {string} options.to - Recipient email
 * @param {string} options.subject - Email subject
 * @param {string} options.html - HTML content
 * @param {string} options.text - Plain text content
 * @returns {Promise<{success: boolean, messageId?: string, message?: string}>}
 */
export const sendEmail = async (options) => {
  if (!isEmailConfigured) {
    console.warn("⚠️ Email not configured, skipping email send");
    return { success: false, message: "Email not configured" };
  }

  // ✅ FIXED Mi5: Validate email format before sending
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(options.to)) {
    console.error(`❌ Invalid recipient email format: ${options.to}`);
    return { success: false, error: "Invalid email address" };
  }

  if (!emailRegex.test(process.env.SMTP_USER)) {
    console.error(`❌ Invalid sender email format: ${process.env.SMTP_USER}`);
    return { success: false, error: "Invalid sender email" };
  }

  try {
    const info = await transporter.sendMail({
      from: `"${process.env.APP_NAME || "ExpenseFlow"}" <${process.env.SMTP_USER}>`,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
    });

    console.log(`✅ Email sent to ${options.to}: ${options.subject}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error("❌ Email send error:", error);
    return { success: false, error: error.message };
  }
};

/**
 * Check if email is enabled
 * @returns {boolean}
 */
export const isEmailEnabled = () => isEmailConfigured;

export default transporter;
