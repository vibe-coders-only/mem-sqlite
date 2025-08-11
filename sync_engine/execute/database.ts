import Database from 'better-sqlite3';
import { initializeDatabase, getDatabase } from './schema.js';
import type { ClaudeCodeMessage, SummaryMessage, UserMessage, AssistantMessage } from '../claude_code/types.js';
import { TransactionLogger } from './transaction_log.js';

export interface ExecuteResult {
  messagesInserted: number;
  messagesUpdated: number;
  errors: Error[];
}

export function executeToDatabase(messages: any[], sessionId: string, sessionPath: string): ExecuteResult {
  return retryDatabaseOperation(() => {
    const db = initializeDatabase();
    const logger = TransactionLogger.getInstance();
    const result: ExecuteResult = {
      messagesInserted: 0,
      messagesUpdated: 0,
      errors: []
    };
    
    try {
      // Use a single transaction for the entire batch
      const transaction = db.transaction(() => {
        ensureSession(db, sessionId, sessionPath, logger);
        
        for (const message of messages) {
          try {
            const messageId = getMessageId(message);
            const exists = db.prepare('SELECT id FROM messages WHERE id = ?').get(messageId);
            
            if (exists) {
              result.messagesUpdated++;
            } else {
              insertMessage(db, message, sessionId, logger);
              result.messagesInserted++;
            }
          } catch (error) {
            result.errors.push(error as Error);
          }
        }
        
        // Log batch operation summary
        if (result.messagesInserted > 0 || result.messagesUpdated > 0) {
          logger.logBatchOperation(sessionId, 'sync_batch', result.messagesInserted + result.messagesUpdated);
        }
      });
      
      transaction();
      
    } catch (error) {
      result.errors.push(error as Error);
    } finally {
      db.close();
    }
    
    return result;
  });
}

function ensureSession(db: Database.Database, sessionId: string, sessionPath: string, logger: TransactionLogger): void {
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO sessions (id, sessionId, sessionPath)
    VALUES (?, ?, ?)
  `);
  const result = stmt.run(sessionId, sessionId, sessionPath);
  
  if (result.changes > 0) {
    logger.logSessionInsert(sessionId, sessionPath);
  }
}

function getMessageId(message: any): string {
  if (message.uuid) return message.uuid;
  if (message.leafUuid) return message.leafUuid;
  return `${message.sessionId}_${Date.now()}_${Math.random()}`;
}

function insertMessage(db: Database.Database, message: any, sessionId: string, logger: TransactionLogger): void {
  const messageId = getMessageId(message);
  
  const baseParams = {
    id: messageId,
    sessionId,
    type: message.type,
    timestamp: message.timestamp || new Date().toISOString(),
    isSidechain: message.isSidechain ? 1 : 0
  };
  
  let params: any = { ...baseParams };
  
  switch (message.type) {
    case 'summary':
      params.projectName = message.summary;
      break;
      
    case 'user':
      params.userText = message.message?.content || '';
      params.userType = message.userType;
      params.userAttachments = null;
      break;
      
    case 'assistant':
      params.assistantRole = message.message?.role;
      params.assistantText = extractAssistantText(message.message?.content);
      params.assistantModel = message.message?.model;
      break;
  }
  
  const columns = Object.keys(params).join(', ');
  const placeholders = Object.keys(params).map(() => '?').join(', ');
  
  // Convert all values to SQLite-compatible types
  const values = Object.values(params).map(value => {
    if (value === null || value === undefined) return null;
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
    if (typeof value === 'bigint') return value;
    if (Buffer.isBuffer(value)) return value;
    
    // Convert complex objects to JSON strings
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  });
  
  db.prepare(`
    INSERT INTO messages (${columns})
    VALUES (${placeholders})
  `).run(...values);
  
  // Log the message insertion
  logger.logMessageInsert(sessionId, messageId, message.type);
}

function extractAssistantText(content: any): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .filter(item => item.type === 'text')
      .map(item => item.text)
      .join(' ');
  }
  return '';
}

function retryDatabaseOperation<T>(operation: () => T, maxRetries: number = 5): T {
  let lastError: Error;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return operation();
    } catch (error: any) {
      lastError = error;
      
      // Check if this is a SQLite busy error
      if (error.code === 'SQLITE_BUSY' || error.message?.includes('database is locked')) {
        const delay = Math.min(50 * Math.pow(2, attempt - 1), 1000); // Exponential backoff, max 1s
        console.warn(`Database busy, retrying in ${delay}ms (attempt ${attempt}/${maxRetries})`);
        
        // Sleep for the delay period
        const start = Date.now();
        while (Date.now() - start < delay) {
          // Busy wait for small delays to avoid async complexity
        }
        
        if (attempt < maxRetries) continue;
      }
      
      // Re-throw non-retry errors immediately
      throw error;
    }
  }
  
  throw lastError!;
}

export { initializeDatabase, getDatabase };