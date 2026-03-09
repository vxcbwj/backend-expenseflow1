# Database Backup

**Database:** expenseflow
**Timestamp:** 2026-02-10T10:36:53.978Z
**Total Collections:** 6
**Total Documents:** 218

## Collections Backed Up:

- **auditlogs**: 0 documents
- **companies**: 5 documents
- **users**: 24 documents
- **invitations**: 0 documents
- **expenses**: 155 documents
- **budgets**: 34 documents

## How to Restore:

```bash
cd backend
npm run restore-db -- "2026-02-10T10-36-52"
```

Or manually import using MongoDB Compass:
1. Open MongoDB Compass
2. Connect to your database
3. For each collection:
   - Click "Add Data" → "Import File"
   - Select the corresponding .json file
   - Click "Import"
