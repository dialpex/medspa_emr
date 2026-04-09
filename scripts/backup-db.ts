#!/usr/bin/env tsx
/**
 * SQLite Database Backup Script
 * Usage: npx tsx scripts/backup-db.ts
 * Can be run via cron for automated backups.
 */

import { execSync } from "child_process";
import { mkdirSync, readdirSync, unlinkSync, statSync } from "fs";
import path from "path";

const DB_PATH = path.join(process.cwd(), "prisma/dev.db");
const BACKUP_DIR = path.join(process.cwd(), "backups");
const MAX_BACKUPS = 30;

function main() {
  // Ensure backup directory exists
  mkdirSync(BACKUP_DIR, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupFile = path.join(BACKUP_DIR, `dev-${timestamp}.db`);

  console.log(`Backing up ${DB_PATH} → ${backupFile}`);

  // Use SQLite .backup command for consistent snapshot
  execSync(`sqlite3 "${DB_PATH}" ".backup '${backupFile}'"`, { stdio: "inherit" });

  // Verify backup exists and has size > 0
  const stats = statSync(backupFile);
  if (stats.size === 0) {
    throw new Error("Backup file is empty — aborting");
  }

  console.log(`Backup complete: ${(stats.size / 1024).toFixed(1)} KB`);

  // Rotate old backups
  const backups = readdirSync(BACKUP_DIR)
    .filter((f) => f.startsWith("dev-") && f.endsWith(".db"))
    .sort()
    .reverse();

  if (backups.length > MAX_BACKUPS) {
    const toDelete = backups.slice(MAX_BACKUPS);
    for (const file of toDelete) {
      const fullPath = path.join(BACKUP_DIR, file);
      console.log(`Rotating old backup: ${file}`);
      unlinkSync(fullPath);
    }
  }

  console.log(`Done. ${Math.min(backups.length, MAX_BACKUPS)} backups retained.`);
}

main();
