import mongoose from "mongoose";
import dotenv from "dotenv";
import config from "../src/config/env.js";
import User from "../src/models/user.js";

dotenv.config();

const formatAlgerianPhone = (digits) => {
  const national = digits.slice(3);
  return `+213 ${national.slice(0, 3)} ${national.slice(3, 5)} ${national.slice(5, 7)} ${national.slice(7)}`;
};

const generateAlgerianPhone = (index) => {
  const prefix = index % 2 === 0 ? "5" : "6";
  const uniqueDigits = String(index + 1).padStart(8, "0");
  return formatAlgerianPhone(`213${prefix}${uniqueDigits}`);
};

const seedPhoneNumbers = async () => {
  try {
    console.log("🔄 Connecting to MongoDB...");
    await mongoose.connect(config.mongodb.uri, {
      serverSelectionTimeoutMS: 5000,
    });
    console.log("✅ Connected to MongoDB");

    const users = await User.find().select("email phone");
    const usersToSeed = users.filter(
      (user) => !user.phone || !user.phone.toString().trim(),
    );

    if (usersToSeed.length === 0) {
      console.log("✅ No empty phone fields found. Nothing to seed.");
      return;
    }

    console.log(
      `📋 Seeding ${usersToSeed.length} users with Algerian phone numbers`,
    );

    const bulkOperations = usersToSeed.map((user, index) => {
      const phone = generateAlgerianPhone(index);
      console.log(`  - ${user.email} -> ${phone}`);

      return {
        updateOne: {
          filter: { _id: user._id },
          update: { $set: { phone } },
        },
      };
    });

    const result = await User.bulkWrite(bulkOperations);
    const modifiedCount = result.modifiedCount ?? result.nModified ?? 0;

    console.log(`\n✅ Seed complete. ${modifiedCount} users updated.`);
  } catch (error) {
    console.error("❌ Phone seeding failed:", error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log("🔌 MongoDB connection closed");
    process.exit(0);
  }
};

seedPhoneNumbers();
