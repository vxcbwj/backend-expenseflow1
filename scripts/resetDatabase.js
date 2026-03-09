import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

const resetDatabase = async () => {
  try {
    console.log("🔄 Connecting to MongoDB...");
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Connected to:", mongoose.connection.db.databaseName);

    console.log("\n🗑️  Dropping all collections...");
    const collections = await mongoose.connection.db.collections();

    if (collections.length === 0) {
      console.log("   No collections found - database is already empty!");
    } else {
      for (let collection of collections) {
        console.log(`   ✓ Dropping: ${collection.collectionName}`);
        await collection.drop();
      }
    }

    console.log("\n✅ Database reset complete!");
    console.log("📊 Database is now empty and ready for fresh data");
    console.log("\n🚀 Next steps:");
    console.log("   1. Start your server: npm run dev");
    console.log("   2. Register a new user at http://localhost:5173/register");
    console.log("   3. Create a company and start testing!");

    await mongoose.connection.close();
    console.log("\n🔌 Disconnected from MongoDB");
    process.exit(0);
  } catch (error) {
    console.error("\n❌ Error resetting database:");
    console.error("   ", error.message);
    process.exit(1);
  }
};

console.log("╔════════════════════════════════════════╗");
console.log("║   ExpenseFlow Database Reset Tool     ║");
console.log("╚════════════════════════════════════════╝");
console.log("");

resetDatabase();
