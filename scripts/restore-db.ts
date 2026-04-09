#!/usr/bin/env tsx
/**
 * SQLite Database Restore Script
 * Usage: CONFIRM_RESTORE=yes npx tsx scripts/restore-db.ts <backup-file>
 */

import { copyFileSync, statSync } from "fs";
import path from "path";

const DB_PATH = path.join(process.cwd(), "prisma/dev.db");

function main() {
  if (process.env.CONFIRM_RESTORE !== "yes") {
    console.error("Safety: set CONFIRM_RESTORE=yes to proceed");
    process.exit(1);
  }

  const backupFile = process.argv[2];
  if (!backupFile) {
    console.error("Usage: CONFIRM_RESTORE=yes npx tsx scripts/restore-db.ts <backup-file>");
    process.exit(1);
  }

  const fullPath = path.isAbsolute(backupFile) ? backupFile : path.join(process.cwd(), backupFile);

  const stats = statSync(fullPath);
  if (stats.size === 0) {
    console.error("Backup file is empty — aborting");
    process.exit(1);
  }

  console.log(`Restoring ${fullPath} → ${DB_PATH}`);
  copyFileSync(fullPath, DB_PATH);
  console.log(`Restore complete (${(stats.size / 1024).toFixed(1)} KB)`);
}

main();
