import mongoose from "mongoose";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const backupDatabase = async () => {
  try {
    console.log("╔════════════════════════════════════════╗");
    console.log("║   ExpenseFlow Database Backup Tool    ║");
    console.log("╚════════════════════════════════════════╝\n");

    console.log("🔄 Connecting to MongoDB...");
    await mongoose.connect(process.env.MONGODB_URI);
    const dbName = mongoose.connection.db.databaseName;
    console.log(`✅ Connected to: ${dbName}\n`);

    // Create backup directory
    const timestamp = new Date()
      .toISOString()
      .replace(/[:.]/g, "-")
      .slice(0, 19);
    const backupDir = path.join(__dirname, "..", "backups");
    const backupPath = path.join(backupDir, `backup-${timestamp}`);

    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    fs.mkdirSync(backupPath, { recursive: true });

    console.log(`📁 Backup directory: ${backupPath}\n`);
    console.log("📦 Backing up collections...\n");

    // Get all collections
    const collections = await mongoose.connection.db.collections();

    if (collections.length === 0) {
      console.log("⚠️  No collections found - database is empty!");
      await mongoose.connection.close();
      process.exit(0);
    }

    let totalDocuments = 0;
    const backupSummary = {
      database: dbName,
      timestamp: new Date().toISOString(),
      collections: [],
    };

    // Backup each collection
    for (const collection of collections) {
      const collectionName = collection.collectionName;
      const documents = await collection.find({}).toArray();
      const count = documents.length;
      totalDocuments += count;

      // Save to JSON file
      const filePath = path.join(backupPath, `${collectionName}.json`);
      fs.writeFileSync(filePath, JSON.stringify(documents, null, 2));

      console.log(
        `   ✓ ${collectionName.padEnd(20)} ${count.toString().padStart(5)} documents`,
      );

      backupSummary.collections.push({
        name: collectionName,
        documentCount: count,
        file: `${collectionName}.json`,
      });
    }

    // Save backup metadata
    const metadataPath = path.join(backupPath, "_backup-info.json");
    fs.writeFileSync(metadataPath, JSON.stringify(backupSummary, null, 2));

    // Create a README for the backup
    const readmePath = path.join(backupPath, "README.md");
    const readmeContent = `# Database Backup

**Database:** ${dbName}
**Timestamp:** ${new Date().toISOString()}
**Total Collections:** ${collections.length}
**Total Documents:** ${totalDocuments}

## Collections Backed Up:

${backupSummary.collections.map((c) => `- **${c.name}**: ${c.documentCount} documents`).join("\n")}

## How to Restore:

\`\`\`bash
cd backend
npm run restore-db -- "${timestamp}"
\`\`\`

Or manually import using MongoDB Compass:
1. Open MongoDB Compass
2. Connect to your database
3. For each collection:
   - Click "Add Data" → "Import File"
   - Select the corresponding .json file
   - Click "Import"
`;
    fs.writeFileSync(readmePath, readmeContent);

    console.log("\n" + "═".repeat(50));
    console.log(`✅ Backup completed successfully!`);
    console.log("═".repeat(50));
    console.log(`\n📊 Summary:`);
    console.log(`   Database:     ${dbName}`);
    console.log(`   Collections:  ${collections.length}`);
    console.log(`   Documents:    ${totalDocuments}`);
    console.log(`   Location:     ${backupPath}`);
    console.log(`\n📝 Files created:`);
    console.log(
      `   ${collections.map((c) => c.collectionName + ".json").join("\n   ")}`,
    );
    console.log(`   _backup-info.json`);
    console.log(`   README.md`);

    console.log(`\n🔄 To restore this backup later:`);
    console.log(`   npm run restore-db -- "${timestamp}"`);

    console.log(`\n✅ Safe to reset database now!`);
    console.log(`   Run: npm run reset-db\n`);

    await mongoose.connection.close();
    console.log("🔌 Disconnected from MongoDB\n");
    process.exit(0);
  } catch (error) {
    console.error("\n❌ Error creating backup:");
    console.error("   ", error.message);
    process.exit(1);
  }
};

backupDatabase();
