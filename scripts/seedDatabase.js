import mongoose from "mongoose";
import dotenv from "dotenv";
import bcrypt from "bcrypt"; // CHANGED FROM bcryptjs to bcrypt

dotenv.config();

// ============================================
// SEED DATA CONFIGURATION - UPDATED FOR DEPARTMENT FEATURE
// ============================================

const SEED_CONFIG = {
  companies: [
    {
      name: "TechVision Solutions",
      industry: "Technology",
      currency: "USD",
      description: "Software development and IT consulting company",
      email: "contact@techvision.com",
      phone: "+1-555-0100",
      website: "www.techvision.com",
      address: "123 Tech Street, San Francisco, CA 94105",
      settings: {
        defaultCurrency: "USD",
        budgetAlerts: true,
        expenseApprovalRequired: true,
        expenseThreshold: 500,
      },
    },
    {
      name: "Green Earth Retail",
      industry: "Retail",
      currency: "USD",
      description: "Eco-friendly retail and sustainable products",
      email: "info@greenearth.com",
      phone: "+1-555-0200",
      website: "www.greenearth.com",
      address: "456 Eco Avenue, Portland, OR 97201",
      settings: {
        defaultCurrency: "USD",
        budgetAlerts: true,
        expenseApprovalRequired: false,
        expenseThreshold: 1000,
      },
    },
    {
      name: "FinanceHub Consulting",
      industry: "Finance",
      currency: "USD",
      description: "Financial consulting and advisory services",
      email: "hello@financehub.com",
      phone: "+1-555-0300",
      website: "www.financehub.com",
      address: "789 Wall Street, New York, NY 10005",
      settings: {
        defaultCurrency: "USD",
        budgetAlerts: true,
        expenseApprovalRequired: true,
        expenseThreshold: 250,
      },
    },
  ],

  users: {
    techvision: {
      admin: {
        email: "admin@techvision.com",
        password: "Admin123!",
        firstName: "Sarah",
        lastName: "Johnson",
        phone: "+1-555-0101",
      },
      managers: [
        {
          email: "mike.chen@techvision.com",
          password: "Manager123!",
          firstName: "Mike",
          lastName: "Chen",
          phone: "+1-555-0102",
        },
        {
          email: "lisa.rodriguez@techvision.com",
          password: "Manager123!",
          firstName: "Lisa",
          lastName: "Rodriguez",
          phone: "+1-555-0103",
        },
      ],
    },
    greenearth: {
      admin: {
        email: "admin@greenearth.com",
        password: "Admin123!",
        firstName: "David",
        lastName: "Martinez",
        phone: "+1-555-0201",
      },
      managers: [
        {
          email: "emma.wilson@greenearth.com",
          password: "Manager123!",
          firstName: "Emma",
          lastName: "Wilson",
          phone: "+1-555-0202",
        },
      ],
    },
    financehub: {
      admin: {
        email: "admin@financehub.com",
        password: "Admin123!",
        firstName: "James",
        lastName: "Anderson",
        phone: "+1-555-0301",
      },
      managers: [
        {
          email: "sophia.taylor@financehub.com",
          password: "Manager123!",
          firstName: "Sophia",
          lastName: "Taylor",
          phone: "+1-555-0302",
        },
        {
          email: "alex.brown@financehub.com",
          password: "Manager123!",
          firstName: "Alex",
          lastName: "Brown",
          phone: "+1-555-0303",
        },
      ],
    },
  },

  expenseTemplates: [
    {
      category: "Office Supplies",
      department: "Operations",
      min: 50,
      max: 300,
      vendor: "Office Depot",
      description: "Office supplies purchase",
    },
    {
      category: "Software",
      department: "Technology",
      min: 100,
      max: 5000,
      vendor: "Software Co",
      description: "Software license/subscription",
    },
    {
      category: "Hardware",
      department: "Technology",
      min: 500,
      max: 3000,
      vendor: "Computer World",
      description: "Computer/equipment purchase",
    },
    {
      category: "Travel",
      department: "Sales & Marketing",
      min: 200,
      max: 2000,
      vendor: "Travel Agency",
      description: "Business travel expenses",
    },
    {
      category: "Meals & Entertainment",
      department: "Sales & Marketing",
      min: 50,
      max: 500,
      vendor: "Various Restaurants",
      description: "Client meetings/team lunches",
    },
    {
      category: "Marketing",
      department: "Sales & Marketing",
      min: 500,
      max: 5000,
      vendor: "Digital Ads Co",
      description: "Marketing campaign expenses",
    },
    {
      category: "Utilities",
      department: "Operations",
      min: 200,
      max: 800,
      vendor: "City Power Company",
      description: "Monthly utilities payment",
    },
    {
      category: "Rent",
      department: "Operations",
      min: 2000,
      max: 8000,
      vendor: "Property Management LLC",
      description: "Office rent payment",
    },
    {
      category: "Salaries",
      department: "Human Resources",
      min: 3000,
      max: 10000,
      vendor: "Payroll Services",
      description: "Monthly salary payment",
    },
    {
      category: "Consulting",
      department: "Technology",
      min: 1000,
      max: 5000,
      vendor: "Consulting Firm",
      description: "Professional services",
    },
    {
      category: "Insurance",
      department: "Finance",
      min: 500,
      max: 2000,
      vendor: "Insurance Co",
      description: "Business insurance premium",
    },
    {
      category: "Training",
      department: "Human Resources",
      min: 200,
      max: 2000,
      vendor: "Training Institute",
      description: "Employee training program",
    },
  ],

  budgetTemplates: {
    "Office Supplies": 2000,
    Software: 10000,
    Hardware: 15000,
    Travel: 8000,
    "Meals & Entertainment": 3000,
    Marketing: 12000,
    Utilities: 5000,
    Rent: 12000,
    Salaries: 60000,
    Consulting: 15000,
    Insurance: 6000,
    Training: 5000,
  },
};

// ============================================
// HELPER FUNCTIONS
// ============================================

const hashPassword = async (password) => {
  const salt = await bcrypt.genSalt(10);
  return await bcrypt.hash(password, salt);
};

const getRandomDate = (daysBack) => {
  const date = new Date();
  date.setDate(date.getDate() - Math.floor(Math.random() * daysBack));
  return date;
};

const getRandomAmount = (min, max) => {
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

const getRandomStatus = () => {
  const statuses = [
    "pending",
    "approved",
    "approved",
    "approved",
    "rejected",
    "paid",
  ];
  return statuses[Math.floor(Math.random() * statuses.length)];
};

const getRandomDescription = (category, department) => {
  const descriptions = [
    `Monthly ${category.toLowerCase()} expense for ${department}`,
    `${category} payment for ${department} department`,
    `${department} department ${category.toLowerCase()} cost`,
    `Professional ${category.toLowerCase()} services for ${department}`,
    `${category} - ${department} department operations`,
  ];
  return descriptions[Math.floor(Math.random() * descriptions.length)];
};

// ============================================
// MAIN SEED FUNCTION
// ============================================

const seedDatabase = async () => {
  try {
    console.log("╔══════════════════════════════════════════════╗");
    console.log("║    ExpenseFlow Database Seeder v2.0         ║");
    console.log("║    (With Department Feature)                ║");
    console.log("╚══════════════════════════════════════════════╝\n");

    console.log("🔄 Connecting to MongoDB...");

    // Use local MongoDB if no URI is set
    const mongoURI =
      process.env.MONGODB_URI || "mongodb://localhost:27017/expenseflow";
    await mongoose.connect(mongoURI);

    const dbName = mongoose.connection.db.databaseName;
    console.log(`✅ Connected to: ${dbName}\n`);

    console.log("🧹 Clearing existing data...");
    const collections = [
      "users",
      "companies",
      "expenses",
      "budgets",
      "invitations",
      "auditlogs",
    ];

    for (const collectionName of collections) {
      try {
        const collection = mongoose.connection.db.collection(collectionName);
        const count = await collection.countDocuments();
        if (count > 0) {
          await collection.deleteMany({});
          console.log(`   ✓ Cleared ${count} documents from ${collectionName}`);
        }
      } catch (error) {
        // Collection might not exist yet
        console.log(
          `   ⚠️  Collection ${collectionName} doesn't exist or error: ${error.message}`,
        );
      }
    }
    console.log("");

    const db = mongoose.connection.db;
    const createdData = {
      companies: [],
      users: [],
      expenses: [],
      budgets: [],
    };

    console.log("🏢 Creating Companies...\n");

    // Create Companies
    for (const companyData of SEED_CONFIG.companies) {
      console.log(`   Creating: ${companyData.name}...`);

      const company = {
        ...companyData,
        adminId: null,
        managerIds: [],
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = await db.collection("companies").insertOne(company);
      company._id = result.insertedId;
      createdData.companies.push(company);
      console.log(`   ✓ ${companyData.name} created (ID: ${company._id})`);
    }

    console.log(`\n✅ ${createdData.companies.length} companies created\n`);
    console.log("👥 Creating Users (2-Role System)...\n");

    // Create Users for each company
    const companyKeys = ["techvision", "greenearth", "financehub"];

    for (let i = 0; i < createdData.companies.length; i++) {
      const company = createdData.companies[i];
      const companyKey = companyKeys[i];
      const usersConfig = SEED_CONFIG.users[companyKey];

      console.log(`   ${company.name}:`);

      // Create Admin
      const adminData = usersConfig.admin;
      const hashedPassword = await hashPassword(adminData.password);

      const admin = {
        email: adminData.email,
        password: hashedPassword,
        firstName: adminData.firstName,
        lastName: adminData.lastName,
        phone: adminData.phone,
        globalRole: "admin",
        companyId: company._id,
        joinedCompanyAt: new Date(),
        preferences: {
          theme: "auto",
          currency: "USD",
          language: "en",
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const adminResult = await db.collection("users").insertOne(admin);
      admin._id = adminResult.insertedId;
      createdData.users.push(admin);
      console.log(`      ✓ Admin: ${admin.email} (ID: ${admin._id})`);

      // Update company with adminId
      await db
        .collection("companies")
        .updateOne({ _id: company._id }, { $set: { adminId: admin._id } });
      company.adminId = admin._id;

      // Create Managers
      const managerIds = [];
      for (const managerData of usersConfig.managers) {
        const hashedPassword = await hashPassword(managerData.password);

        const manager = {
          email: managerData.email,
          password: hashedPassword,
          firstName: managerData.firstName,
          lastName: managerData.lastName,
          phone: managerData.phone,
          globalRole: "manager",
          companyId: company._id,
          joinedCompanyAt: new Date(),
          preferences: {
            theme: "auto",
            currency: "USD",
            language: "en",
          },
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        const managerResult = await db.collection("users").insertOne(manager);
        manager._id = managerResult.insertedId;
        managerIds.push(manager._id);
        createdData.users.push(manager);
        console.log(`      ✓ Manager: ${manager.email} (ID: ${manager._id})`);
      }

      // Update company with managerIds
      await db
        .collection("companies")
        .updateOne({ _id: company._id }, { $set: { managerIds: managerIds } });
      company.managerIds = managerIds;

      console.log("");
    }

    console.log(`✅ ${createdData.users.length} users created\n`);
    console.log("📊 Creating Budgets...\n");

    // Create Budgets for each company
    for (const company of createdData.companies) {
      console.log(`   ${company.name}:`);

      const categories = Object.keys(SEED_CONFIG.budgetTemplates);
      let budgetCount = 0;

      for (const category of categories) {
        const amount = SEED_CONFIG.budgetTemplates[category];
        const startDate = new Date();
        startDate.setDate(1);
        const endDate = new Date(startDate);
        endDate.setMonth(endDate.getMonth() + 1);
        endDate.setDate(0);

        // Find department for this category
        const template = SEED_CONFIG.expenseTemplates.find(
          (t) => t.category === category,
        );
        const department = template ? template.department : "Other";

        const budget = {
          companyId: company._id,
          category: category,
          amount: amount,
          period: "monthly",
          name: `${category} Budget`,
          description: `Monthly budget for ${category} (${department} department)`,
          startDate: startDate,
          endDate: endDate,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        const result = await db.collection("budgets").insertOne(budget);
        budget._id = result.insertedId;
        createdData.budgets.push(budget);
        budgetCount++;
      }

      console.log(`      ✓ ${budgetCount} budgets created`);
    }

    console.log(`\n✅ ${createdData.budgets.length} budgets created\n`);
    console.log("💰 Creating Expenses (With Departments)...\n");

    // Create Expenses
    for (const company of createdData.companies) {
      console.log(`   ${company.name}:`);

      const companyUsers = createdData.users.filter(
        (u) => u.companyId.toString() === company._id.toString(),
      );
      const adminUser = companyUsers.find((u) => u.globalRole === "admin");

      let expenseCount = 0;

      for (const template of SEED_CONFIG.expenseTemplates) {
        const numExpenses = Math.floor(Math.random() * 5) + 8;

        for (let i = 0; i < numExpenses; i++) {
          const randomUser =
            companyUsers[Math.floor(Math.random() * companyUsers.length)];
          const status = getRandomStatus();
          const amount = getRandomAmount(template.min, template.max);
          const date = getRandomDate(90);
          const department = template.department;

          const expense = {
            companyId: company._id,
            userId: randomUser._id,
            category: template.category,
            department: department,
            amount: amount,
            description: getRandomDescription(template.category, department),
            vendor: template.vendor,
            date: date,
            status: status,
            paymentMethod: ["Credit Card", "Bank Transfer", "Cash"][
              Math.floor(Math.random() * 3)
            ],
            approvedBy: status === "approved" ? adminUser._id : null,
            approvedAt:
              status === "approved"
                ? new Date(date.getTime() + 86400000)
                : null,
            createdBy: `${randomUser.firstName} ${randomUser.lastName}`,
            createdAt: date,
            updatedAt: new Date(),
          };

          const result = await db.collection("expenses").insertOne(expense);
          expense._id = result.insertedId;
          createdData.expenses.push(expense);
          expenseCount++;
        }
      }

      console.log(`      ✓ ${expenseCount} expenses created`);
    }

    console.log(`\n✅ ${createdData.expenses.length} total expenses created\n`);

    // Summary
    console.log("\n" + "═".repeat(50));
    console.log("✅ DATABASE SEEDED SUCCESSFULLY!");
    console.log("═".repeat(50));
    console.log("\n📊 SUMMARY:\n");
    console.log(`   Companies:  ${createdData.companies.length}`);
    console.log(`   Users:      ${createdData.users.length} (2-role system)`);
    console.log(`   Budgets:    ${createdData.budgets.length}`);
    console.log(
      `   Expenses:   ${createdData.expenses.length} (with departments)`,
    );

    // Department breakdown
    const departmentCounts = {};
    createdData.expenses.forEach((expense) => {
      const dept = expense.department || "Other";
      departmentCounts[dept] = (departmentCounts[dept] || 0) + 1;
    });

    console.log("\n📈 DEPARTMENT BREAKDOWN:");
    Object.entries(departmentCounts).forEach(([dept, count]) => {
      const percentage = ((count / createdData.expenses.length) * 100).toFixed(
        1,
      );
      console.log(`   ${dept}: ${count} expenses (${percentage}%)`);
    });

    console.log(`\n🔐 LOGIN CREDENTIALS:\n`);

    for (let i = 0; i < createdData.companies.length; i++) {
      const company = createdData.companies[i];
      const companyKey = companyKeys[i];
      const usersConfig = SEED_CONFIG.users[companyKey];

      console.log(`   ${company.name}:`);
      console.log(
        `      Admin:    ${usersConfig.admin.email} / ${usersConfig.admin.password}`,
      );
      usersConfig.managers.forEach((m, idx) => {
        console.log(`      Manager${idx + 1}: ${m.email} / ${m.password}`);
      });
      console.log("");
    }

    console.log("🚀 READY TO START!");
    console.log("\n📱 Frontend: http://localhost:5173");
    console.log("🔧 Backend:  http://localhost:5000");
    console.log("\n💡 FEATURES IN THIS SEED:");
    console.log("   • 2-role system (admin/manager)");
    console.log("   • Department field on all expenses");
    console.log("   • Realistic expense data with departments");
    console.log("   • Budgets matching expense categories\n");

    await mongoose.connection.close();
    console.log("🔌 Disconnected from MongoDB\n");
    process.exit(0);
  } catch (error) {
    console.error("\n❌ ERROR SEEDING DATABASE:");
    console.error("   ", error.message);
    if (error.code === "MODULE_NOT_FOUND") {
      console.error("\n💡 TROUBLESHOOTING:");
      console.error("   1. Make sure MongoDB is running: mongod");
      console.error("   2. Make sure .env has MONGODB_URI");
      console.error("   3. Try running from backend directory:");
      console.error("      cd backend");
      console.error("      node scripts/seedDatabase.js");
    }
    process.exit(1);
  }
};

// Run the seeder
seedDatabase();
