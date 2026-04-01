// backend/scripts/inspectDB.js
// Run with: node scripts/inspectDB.js
// Shows a full snapshot of every collection in the database.

import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import mongoose from "mongoose";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const envFile =
  process.env.NODE_ENV === "production" ? ".env.production" : ".env";
dotenv.config({ path: path.resolve(__dirname, "..", envFile) });

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error(`\n❌ MONGODB_URI not set in ${envFile}\n`);
  process.exit(1);
}

await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 8000 });
const db = mongoose.connection.db;

const SENSITIVE_FIELDS = ["password", "token", "apiSecret", "apiKey"];

// Redact sensitive fields recursively so they never print to the terminal
function redact(obj) {
  if (!obj || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map(redact);
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    out[k] = SENSITIVE_FIELDS.includes(k) ? "***REDACTED***" : redact(v);
  }
  return out;
}

const collectionNames = (await db.listCollections().toArray())
  .map((c) => c.name)
  .sort();

console.log(`\n${"═".repeat(60)}`);
console.log(`  DATABASE SNAPSHOT`);
console.log(`  URI: ${MONGODB_URI.replace(/:([^@]+)@/, ":****@")}`);
console.log(`  Collections: ${collectionNames.length}`);
console.log(`${"═".repeat(60)}\n`);

for (const name of collectionNames) {
  const col = db.collection(name);
  const count = await col.countDocuments();
  const docs = await col.find({}).limit(50).toArray();

  console.log(`${"─".repeat(60)}`);
  console.log(
    `  📁 ${name.toUpperCase()}  (${count} document${count !== 1 ? "s" : ""})`,
  );
  console.log(`${"─".repeat(60)}`);

  if (docs.length === 0) {
    console.log("  (empty)\n");
    continue;
  }

  docs.forEach((doc, i) => {
    console.log(
      `\n  [${i + 1}] ${JSON.stringify(redact(doc), null, 4).replace(/\n/g, "\n  ")}`,
    );
  });

  if (count > 50) {
    console.log(`\n  … and ${count - 50} more documents (showing first 50)\n`);
  } else {
    console.log();
  }
}

console.log(`${"═".repeat(60)}`);
console.log(`  END OF SNAPSHOT`);
console.log(`${"═".repeat(60)}\n`);

await mongoose.disconnect();
process.exit(0);
