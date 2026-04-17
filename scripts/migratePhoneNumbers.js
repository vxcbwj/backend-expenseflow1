import mongoose from "mongoose";
import config from "../src/config/env.js";
import User from "../src/models/user.js";

const formatAlgerianPhone = (digits) => {
  const national = digits.slice(3);

  if (national.length === 9) {
    return `+213 ${national.slice(0, 3)} ${national.slice(3, 5)} ${national.slice(5, 7)} ${national.slice(7)}`;
  }

  if (national.length === 8) {
    return `+213 ${national.slice(0, 2)} ${national.slice(2, 4)} ${national.slice(4, 6)} ${national.slice(6)}`;
  }

  return `+213 ${national}`;
};

const normalizePhone = (value) => {
  if (!value) return "";

  const trimmed = value.toString().trim();
  const digits = trimmed.replace(/\D/g, "");

  if (digits.startsWith("0") && (digits.length === 10 || digits.length === 9)) {
    return formatAlgerianPhone(`213${digits.slice(1)}`);
  }

  if (
    digits.startsWith("00213") &&
    (digits.length === 14 || digits.length === 13)
  ) {
    return formatAlgerianPhone(digits.slice(2));
  }

  if (
    digits.startsWith("213") &&
    (digits.length === 12 || digits.length === 11)
  ) {
    return formatAlgerianPhone(digits);
  }

  return "";
};

const migratePhoneNumbers = async () => {
  try {
    console.log("🔄 Connecting to MongoDB...");
    await mongoose.connect(config.mongodb.uri, {
      serverSelectionTimeoutMS: 5000,
    });
    console.log("✅ Connected to MongoDB");

    const users = await User.find().select("email phone");
    console.log(`📋 Found ${users.length} users to process`);

    let updatedCount = 0;
    let skippedCount = 0;
    let warningCount = 0;

    for (const user of users) {
      const originalPhone = user.phone ?? "";
      const normalizedPhone = normalizePhone(originalPhone);

      if (originalPhone === normalizedPhone) {
        console.log(
          `⏭️ Already correct: ${user.email} (${originalPhone || "empty"})`,
        );
        skippedCount += 1;
        continue;
      }

      if (!normalizedPhone && originalPhone) {
        console.warn(
          `⚠️ Warning [${user.id}]: phone value is not recognizable and will be cleared for ${user.email}`,
        );
        warningCount += 1;
      }

      await User.updateOne(
        { _id: user._id },
        { $set: { phone: normalizedPhone } },
      );

      console.log(
        `✅ Updated ${user.email}: ${originalPhone || "(empty)"} -> ${
          normalizedPhone || "(empty)"
        }`,
      );
      updatedCount += 1;
    }

    console.log("\n✅ Migration complete");
    console.log(`Total users processed: ${users.length}`);
    console.log(`Total updated: ${updatedCount}`);
    console.log(`Total skipped: ${skippedCount}`);
    if (warningCount > 0) {
      console.log(`Total warnings: ${warningCount}`);
    }
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log("🔌 MongoDB connection closed");
    process.exit(0);
  }
};

migratePhoneNumbers();
