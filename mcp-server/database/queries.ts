/**
 * Safe query execution for mem-sqlite MCP server
 */

import { getDatabase } from './connection.js';
import { QueryResult, QueryArgs } from './types.js';

// Keywords that are not allowed in queries (security)
const FORBIDDEN_KEYWORDS = [
  'INSERT', 'UPDATE', 'DELETE', 'DROP', 'CREATE', 'ALTER', 'REPLACE',
  'PRAGMA', 'ATTACH', 'DETACH', 'VACUUM', 'REINDEX'
];

/**
 * Validate SQL query for safety
 */
function validateQuery(sql: string): void {
  const normalizedSql = sql.trim().toUpperCase();
  
  // Must start with SELECT
  if (!normalizedSql.startsWith('SELECT')) {
    throw new Error('Only SELECT statements are allowed');
  }
  
  // Check for forbidden keywords
  for (const keyword of FORBIDDEN_KEYWORDS) {
    if (normalizedSql.includes(keyword)) {
      throw new Error(`Forbidden keyword detected: ${keyword}`);
    }
  }
  
  // Basic SQL injection prevention
  const suspiciousPatterns = [
    /;\s*(INSERT|UPDATE|DELETE|DROP|CREATE|ALTER)/i,
    /UNION\s+SELECT/i,
    /--/,
    /\/\*/
  ];
  
  for (const pattern of suspiciousPatterns) {
    if (pattern.test(sql)) {
      throw new Error('Suspicious SQL pattern detected');
    }
  }
}

/**
 * Add LIMIT clause if not present
 */
function ensureLimit(sql: string, limit: number): string {
  const normalizedSql = sql.trim().toUpperCase();
  
  // Check if LIMIT already exists
  if (normalizedSql.includes('LIMIT')) {
    return sql;
  }
  
  // Add LIMIT clause
  return `${sql.trim()} LIMIT ${limit}`;
}

/**
 * Execute safe SELECT query
 */
export function executeQuery(args: QueryArgs): QueryResult {
  const { sql, limit = 100 } = args;
  
  // Validate limit
  const maxLimit = 1000;
  const actualLimit = Math.min(Math.max(1, limit), maxLimit);
  
  // Validate and prepare query
  validateQuery(sql);
  const safeSql = ensureLimit(sql, actualLimit);
  
  try {
    const db = getDatabase();
    const stmt = db.prepare(safeSql);
    const results = stmt.all();
    
    return {
      query: safeSql,
      rowCount: results.length,
      results: results as Array<Record<string, any>>
    };
  } catch (error) {
    throw new Error(`Query execution failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Get database schema information
 */
export function getSchemaInfo(): QueryResult {
  try {
    const db = getDatabase();
    
    // Get table information
    const tables = db.prepare(`
      SELECT name, sql 
      FROM sqlite_master 
      WHERE type = 'table' 
      AND name NOT LIKE 'sqlite_%'
      ORDER BY name
    `).all();
    
    return {
      query: 'Schema information',
      rowCount: tables.length,
      results: tables as Array<Record<string, any>>
    };
  } catch (error) {
    throw new Error(`Schema query failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}