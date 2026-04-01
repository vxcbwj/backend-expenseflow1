// backend/scripts/seedFirstAdmin.js
// Run with: $env:NODE_ENV="production"; node scripts/seedFirstAdmin.js
// Creates the first admin user for a fresh deployment.

import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import mongoose from "mongoose";
import bcrypt from "bcrypt";
import readline from "readline";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load the correct .env file based on NODE_ENV
const envFile =
  process.env.NODE_ENV === "production" ? ".env.production" : ".env";
dotenv.config({ path: path.resolve(__dirname, "..", envFile) });

// Import User model after env is loaded
const { default: User } = await import("../src/models/user.js");

// ─── helpers ────────────────────────────────────────────────────────────────

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const ask = (question) =>
  new Promise((resolve) => rl.question(question, resolve));

const askHidden = (question) =>
  new Promise((resolve) => {
    process.stdout.write(question);
    const stdin = process.openStdin();
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding("utf8");
    let password = "";
    process.stdin.on("data", function handler(char) {
      char = char + "";
      if (char === "\n" || char === "\r" || char === "\u0004") {
        process.stdin.setRawMode(false);
        process.stdin.pause();
        process.stdin.removeListener("data", handler);
        process.stdout.write("\n");
        resolve(password);
      } else if (char === "\u0003") {
        process.exit();
      } else if (char === "\u007f") {
        // backspace
        if (password.length > 0) {
          password = password.slice(0, -1);
          process.stdout.clearLine(0);
          process.stdout.cursorTo(0);
          process.stdout.write(question + "*".repeat(password.length));
        }
      } else {
        password += char;
        process.stdout.write("*");
      }
    });
  });

const validatePassword = (password) => {
  if (!password || password.length < 8)
    return "Password must be at least 8 characters";
  if (!/[A-Za-z]/.test(password))
    return "Password must contain at least one letter";
  if (!/[0-9]/.test(password))
    return "Password must contain at least one number";
  return null;
};

// ─── main ───────────────────────────────────────────────────────────────────

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error(
    `\n❌ MONGODB_URI is not set in ${envFile}. Cannot connect to database.\n`,
  );
  process.exit(1);
}

console.log(`\n🌱 ExpenseFlow — First Admin Seed`);
console.log(`   Environment : ${process.env.NODE_ENV || "development"}`);
console.log(`   Env file    : ${envFile}`);
console.log(`   Database    : ${MONGODB_URI.replace(/:([^@]+)@/, ":****@")}\n`);

try {
  await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 8000 });
  console.log("✅ Connected to MongoDB\n");
} catch (err) {
  console.error("❌ Could not connect to MongoDB:", err.message);
  process.exit(1);
}

// Check whether any admin already exists
const existingAdmin = await User.findOne({ globalRole: "admin" });
if (existingAdmin) {
  console.log(
    `⚠️  An admin already exists: ${existingAdmin.email}\n` +
      `   If you need to reset it, delete the user from MongoDB Atlas first.\n`,
  );
  await mongoose.disconnect();
  rl.close();
  process.exit(0);
}

// Collect details interactively
console.log("Enter details for the first admin account:\n");

const firstName = (await ask("First name : ")).trim();
const lastName = (await ask("Last name  : ")).trim();
const email = (await ask("Email      : ")).trim().toLowerCase();

if (!firstName || !lastName || !email) {
  console.error("\n❌ First name, last name and email are all required.\n");
  await mongoose.disconnect();
  rl.close();
  process.exit(1);
}

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
if (!emailRegex.test(email)) {
  console.error("\n❌ Invalid email format.\n");
  await mongoose.disconnect();
  rl.close();
  process.exit(1);
}

const existingUser = await User.findOne({ email });
if (existingUser) {
  console.error(`\n❌ A user with email "${email}" already exists.\n`);
  await mongoose.disconnect();
  rl.close();
  process.exit(1);
}

// Password — try hidden input, fall back to plain if terminal doesn't support raw mode
let password;
try {
  password = await askHidden("Password   : ");
} catch {
  rl.resume();
  password = (await ask("Password   : ")).trim();
}

const passwordError = validatePassword(password);
if (passwordError) {
  console.error(`\n❌ ${passwordError}\n`);
  await mongoose.disconnect();
  rl.close();
  process.exit(1);
}

rl.close();

// Hash and create
const hashedPassword = await bcrypt.hash(password, 12);

const admin = await User.create({
  firstName,
  lastName,
  email,
  password: hashedPassword,
  globalRole: "admin",
  isActive: true,
  companyId: null,
  joinedCompanyAt: null,
});

console.log(`\n✅ Admin created successfully!`);
console.log(`   Name  : ${admin.firstName} ${admin.lastName}`);
console.log(`   Email : ${admin.email}`);
console.log(`   ID    : ${admin._id}`);
console.log(
  `\n👉 Next step: log in and create your company at POST /api/companies\n`,
);

await mongoose.disconnect();
process.exit(0);
