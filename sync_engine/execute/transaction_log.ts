import { writeFileSync, appendFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';

export interface DatabaseTransaction {
  timestamp: string;
  operation: 'insert' | 'update' | 'delete';
  table: string;
  sessionId: string;
  messageId?: string;
  changes: any;
}

const getBasePath = () => {
  // In Docker container, use /home/user, otherwise use actual homedir
  return process.env.NODE_ENV === 'production' ? '/home/user' : homedir();
};

const LOG_PATH = process.env.TEST_LOG_PATH || join(getBasePath(), '.local', 'share', 'memory-sqlite', 'cc_db_changes.jsonl');

export class TransactionLogger {
  private static instance: TransactionLogger;
  
  static getInstance(): TransactionLogger {
    if (!TransactionLogger.instance) {
      TransactionLogger.instance = new TransactionLogger();
    }
    return TransactionLogger.instance;
  }
  
  // For testing: reset singleton instance
  static resetInstance(): void {
    TransactionLogger.instance = undefined as any;
  }
  
  private constructor() {
    // Ensure log directory exists
    const logDir = process.env.TEST_LOG_PATH 
      ? dirname(process.env.TEST_LOG_PATH)  // Parent dir of test log file
      : join(getBasePath(), '.local', 'share', 'memory-sqlite');
    mkdirSync(logDir, { recursive: true });
  }
  
  logTransaction(transaction: DatabaseTransaction): void {
    const logEntry = {
      ...transaction,
      timestamp: new Date().toISOString(),
      logId: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    };
    
    const jsonLine = JSON.stringify(logEntry) + '\n';
    
    try {
      appendFileSync(LOG_PATH, jsonLine, 'utf8');
      console.log(`DB_LOG: ${transaction.operation} ${transaction.table} for session ${transaction.sessionId}`);
    } catch (error) {
      console.error('Failed to write transaction log:', error);
    }
  }
  
  logSessionInsert(sessionId: string, sessionPath: string): void {
    this.logTransaction({
      timestamp: new Date().toISOString(),
      operation: 'insert',
      table: 'sessions',
      sessionId,
      changes: { sessionPath }
    });
  }
  
  logMessageInsert(sessionId: string, messageId: string, messageType: string): void {
    this.logTransaction({
      timestamp: new Date().toISOString(),
      operation: 'insert',
      table: 'messages',
      sessionId,
      messageId,
      changes: { type: messageType }
    });
  }
  
  logBatchOperation(sessionId: string, operation: string, count: number): void {
    this.logTransaction({
      timestamp: new Date().toISOString(),
      operation: 'insert',
      table: 'batch_operation',
      sessionId,
      changes: { operation, count }
    });
  }
  
  getLogPath(): string {
    return LOG_PATH;
  }
}