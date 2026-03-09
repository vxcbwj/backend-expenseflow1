import mongoose from "mongoose";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const restoreDatabase = async () => {
  try {
    console.log("╔════════════════════════════════════════╗");
    console.log("║  ExpenseFlow Database Restore Tool    ║");
    console.log("╚════════════════════════════════════════╝\n");

    // Get backup timestamp from command line argument
    const backupTimestamp = process.argv[2];

    if (!backupTimestamp) {
      console.log("❌ Error: Please provide backup timestamp\n");
      console.log("Usage: npm run restore-db -- <timestamp>\n");
      console.log("Available backups:");

      const backupDir = path.join(__dirname, "..", "backups");
      if (fs.existsSync(backupDir)) {
        const backups = fs
          .readdirSync(backupDir)
          .filter((f) => f.startsWith("backup-"))
          .sort()
          .reverse();

        if (backups.length > 0) {
          backups.forEach((backup, index) => {
            const timestamp = backup.replace("backup-", "");
            const infoPath = path.join(backupDir, backup, "_backup-info.json");

            if (fs.existsSync(infoPath)) {
              const info = JSON.parse(fs.readFileSync(infoPath, "utf-8"));
              console.log(`\n${index + 1}. ${timestamp}`);
              console.log(
                `   Date: ${new Date(info.timestamp).toLocaleString()}`,
              );
              console.log(`   Collections: ${info.collections.length}`);
              console.log(
                `   Total docs: ${info.collections.reduce((sum, c) => sum + c.documentCount, 0)}`,
              );
            } else {
              console.log(`\n${index + 1}. ${timestamp}`);
            }
          });

          console.log(`\n💡 To restore, run:`);
          console.log(
            `   npm run restore-db -- "${backups[0].replace("backup-", "")}"`,
          );
        } else {
          console.log("   No backups found!");
        }
      } else {
        console.log("   No backup directory found!");
      }
      console.log("");
      process.exit(1);
    }

    const backupPath = path.join(
      __dirname,
      "..",
      "backups",
      `backup-${backupTimestamp}`,
    );

    if (!fs.existsSync(backupPath)) {
      console.log(`❌ Backup not found: ${backupPath}\n`);
      process.exit(1);
    }

    console.log(`📁 Restoring from: ${backupPath}\n`);

    // Read backup info
    const infoPath = path.join(backupPath, "_backup-info.json");
    const backupInfo = JSON.parse(fs.readFileSync(infoPath, "utf-8"));

    console.log("📊 Backup Information:");
    console.log(`   Database:   ${backupInfo.database}`);
    console.log(
      `   Created:    ${new Date(backupInfo.timestamp).toLocaleString()}`,
    );
    console.log(`   Collections: ${backupInfo.collections.length}`);
    console.log("");

    console.log("🔄 Connecting to MongoDB...");
    await mongoose.connect(process.env.MONGODB_URI);
    const dbName = mongoose.connection.db.databaseName;
    console.log(`✅ Connected to: ${dbName}\n`);

    console.log(
      "⚠️  WARNING: This will replace existing data in the database!",
    );
    console.log("⚠️  Press Ctrl+C within 5 seconds to cancel...\n");

    await new Promise((resolve) => setTimeout(resolve, 5000));

    console.log("📦 Restoring collections...\n");

    let totalRestored = 0;

    for (const collectionInfo of backupInfo.collections) {
      const filePath = path.join(backupPath, collectionInfo.file);

      if (!fs.existsSync(filePath)) {
        console.log(`   ⚠️  Skipping ${collectionInfo.name} - file not found`);
        continue;
      }

      const documents = JSON.parse(fs.readFileSync(filePath, "utf-8"));

      if (documents.length === 0) {
        console.log(
          `   ⚠️  Skipping ${collectionInfo.name} - empty collection`,
        );
        continue;
      }

      const collection = mongoose.connection.db.collection(collectionInfo.name);

      // Drop existing collection if it exists
      try {
        await collection.drop();
      } catch (err) {
        // Collection doesn't exist, that's fine
      }

      // Insert documents
      await collection.insertMany(documents);
      totalRestored += documents.length;

      console.log(
        `   ✓ ${collectionInfo.name.padEnd(20)} ${documents.length.toString().padStart(5)} documents restored`,
      );
    }

    console.log("\n" + "═".repeat(50));
    console.log("✅ Restore completed successfully!");
    console.log("═".repeat(50));
    console.log(`\n📊 Summary:`);
    console.log(`   Collections:  ${backupInfo.collections.length}`);
    console.log(`   Documents:    ${totalRestored}`);
    console.log(`\n🚀 Database restored! Restart your server.\n`);

    await mongoose.connection.close();
    console.log("🔌 Disconnected from MongoDB\n");
    process.exit(0);
  } catch (error) {
    console.error("\n❌ Error restoring backup:");
    console.error("   ", error.message);
    process.exit(1);
  }
};

restoreDatabase();
