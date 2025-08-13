/**
 * Database connection management for mem-sqlite MCP server
 */

import Database from 'better-sqlite3';
import { getDatabasePath } from '../../sync_engine/utils/paths.js';

let dbInstance: Database.Database | null = null;

/**
 * Get database connection (read-only)
 */
export function getDatabase(): Database.Database {
  if (!dbInstance) {
    const dbPath = getDatabasePath();
    
    dbInstance = new Database(dbPath, {
      readonly: true,
      fileMustExist: true
    });
    
    // Configure for read-only access with timeout
    dbInstance.pragma('busy_timeout = 10000'); // 10 second timeout
    dbInstance.pragma('foreign_keys = ON');
    
    // Ensure WAL mode compatibility
    try {
      dbInstance.pragma('journal_mode = WAL');
    } catch (error) {
      // WAL mode might already be set by sync engine, ignore errors
      console.error('Warning: Could not set WAL mode (may already be set):', error);
    }
  }
  
  return dbInstance;
}

/**
 * Close database connection
 */
export function closeDatabase(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}

/**
 * Check if database exists and is accessible
 */
export function isDatabaseAvailable(): boolean {
  try {
    const db = getDatabase();
    // Test with a simple query
    db.prepare('SELECT 1').get();
    return true;
  } catch (error) {
    console.error('Database not available:', error);
    return false;
  }
}