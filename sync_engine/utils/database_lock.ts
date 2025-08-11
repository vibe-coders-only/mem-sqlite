/**
 * Database coordination utilities to prevent concurrent write conflicts.
 * Provides mutex-like coordination for database operations.
 */

class DatabaseMutex {
  private locks: Map<string, Promise<void>> = new Map();
  
  /**
   * Acquire a lock for a specific database operation.
   * Returns a promise that resolves when the lock is acquired.
   */
  async acquire(lockId: string): Promise<() => void> {
    // Wait for any existing lock to be released
    const existingLock = this.locks.get(lockId);
    if (existingLock) {
      await existingLock;
    }
    
    // Create a new lock
    let releaseLock: () => void;
    const lockPromise = new Promise<void>((resolve) => {
      releaseLock = () => {
        this.locks.delete(lockId);
        resolve();
      };
    });
    
    this.locks.set(lockId, lockPromise);
    
    return releaseLock!;
  }
  
  /**
   * Execute an operation with exclusive access to a database.
   * Automatically handles lock acquisition and release.
   */
  async withLock<T>(lockId: string, operation: () => T | Promise<T>): Promise<T> {
    const releaseLock = await this.acquire(lockId);
    
    try {
      return await operation();
    } finally {
      releaseLock();
    }
  }
  
  /**
   * Check if a lock is currently held for the given ID.
   */
  isLocked(lockId: string): boolean {
    return this.locks.has(lockId);
  }
  
  /**
   * Get the number of active locks.
   */
  getActiveLockCount(): number {
    return this.locks.size;
  }
}

// Global singleton instance
const globalMutex = new DatabaseMutex();

/**
 * Acquire an exclusive lock for database write operations.
 * Use this to coordinate between Claude Code sync and ELIA pipeline.
 */
export async function withDatabaseWriteLock<T>(
  operation: () => T | Promise<T>
): Promise<T> {
  return globalMutex.withLock('database_write', operation);
}

/**
 * Acquire an exclusive lock for a specific session.
 * Use this when processing individual sessions to prevent conflicts.
 */
export async function withSessionLock<T>(
  sessionId: string,
  operation: () => T | Promise<T>
): Promise<T> {
  return globalMutex.withLock(`session_${sessionId}`, operation);
}

/**
 * Check if database write operations are currently locked.
 */
export function isDatabaseWriteLocked(): boolean {
  return globalMutex.isLocked('database_write');
}

/**
 * Check if a specific session is currently being processed.
 */
export function isSessionLocked(sessionId: string): boolean {
  return globalMutex.isLocked(`session_${sessionId}`);
}

/**
 * Get statistics about current lock usage.
 */
export function getLockStats(): { activeLocks: number; isWriteLocked: boolean } {
  return {
    activeLocks: globalMutex.getActiveLockCount(),
    isWriteLocked: isDatabaseWriteLocked()
  };
}

export { DatabaseMutex };