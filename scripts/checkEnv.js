// backend/scripts/checkEnv.js
// Run with: $env:NODE_ENV="production"; node scripts/checkEnv.js
// Validates all required and optional environment variables before deployment.

import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const envFile =
  process.env.NODE_ENV === "production" ? ".env.production" : ".env";
dotenv.config({ path: path.resolve(__dirname, "..", envFile) });

console.log(`\n${"═".repeat(55)}`);
console.log(`  ENV CHECK — ${envFile}`);
console.log(`${"═".repeat(55)}\n`);

const REQUIRED = [
  { key: "NODE_ENV", hint: "Should be 'production'" },
  { key: "PORT", hint: "e.g. 5000" },
  { key: "MONGODB_URI", hint: "mongodb+srv://..." },
  { key: "JWT_SECRET", hint: "Random string, 32+ chars" },
  { key: "FRONTEND_URL", hint: "https://your-frontend.com" },
  { key: "CORS_ORIGINS", hint: "https://your-frontend.com" },
];

const OPTIONAL = [
  { key: "JWT_EXPIRE", hint: "e.g. 7d" },
  { key: "CLOUDINARY_CLOUD_NAME", hint: "Required for file uploads" },
  { key: "CLOUDINARY_API_KEY", hint: "Required for file uploads" },
  { key: "CLOUDINARY_API_SECRET", hint: "Required for file uploads" },
  { key: "SMTP_HOST", hint: "e.g. smtp.gmail.com" },
  { key: "SMTP_PORT", hint: "e.g. 587" },
  { key: "SMTP_USER", hint: "Required for email notifications" },
  { key: "SMTP_PASS", hint: "Required for email notifications" },
  { key: "SMTP_FROM_NAME", hint: "e.g. ExpenseFlow" },
  { key: "SMTP_FROM_EMAIL", hint: "e.g. noreply@yourdomain.com" },
  { key: "APP_NAME", hint: "e.g. ExpenseFlow" },
];

const SENSITIVE = [
  "MONGODB_URI",
  "JWT_SECRET",
  "CLOUDINARY_API_SECRET",
  "CLOUDINARY_API_KEY",
  "SMTP_PASS",
];

function display(key) {
  const val = process.env[key];
  if (!val) return "(not set)";
  if (SENSITIVE.includes(key)) {
    return val.length > 6
      ? val.slice(0, 4) + "*".repeat(val.length - 4)
      : "***";
  }
  return val;
}

// ── Required ────────────────────────────────────────────
console.log("  REQUIRED\n");
let missingRequired = 0;
for (const { key, hint } of REQUIRED) {
  const val = process.env[key];
  const status = val ? "✅" : "❌";
  if (!val) missingRequired++;
  console.log(
    `  ${status} ${key.padEnd(22)} ${val ? display(key) : `MISSING — ${hint}`}`,
  );
}

// Extra check: JWT_SECRET length
const jwtSecret = process.env.JWT_SECRET || "";
if (jwtSecret && jwtSecret.length < 32) {
  console.log(
    `\n  ⚠️  JWT_SECRET is only ${jwtSecret.length} chars — use 32+ for production`,
  );
}

// ── Optional ────────────────────────────────────────────
console.log("\n  OPTIONAL\n");
let missingOptional = 0;
for (const { key, hint } of OPTIONAL) {
  const val = process.env[key];
  const status = val ? "✅" : "⚠️ ";
  if (!val) missingOptional++;
  console.log(
    `  ${status} ${key.padEnd(24)} ${val ? display(key) : `not set  — ${hint}`}`,
  );
}

// ── Summary ─────────────────────────────────────────────
console.log(`\n${"═".repeat(55)}`);
if (missingRequired === 0) {
  console.log(`  ✅ All required variables are set`);
} else {
  console.log(
    `  ❌ ${missingRequired} required variable(s) missing — fix before deploying`,
  );
}
if (missingOptional > 0) {
  console.log(
    `  ⚠️  ${missingOptional} optional variable(s) not set — some features will be disabled`,
  );
}
console.log(`${"═".repeat(55)}\n`);

process.exit(missingRequired > 0 ? 1 : 0);
