// Claude Code WTE pipeline
import { watchJsonl } from './watch/index.js';
import { parseAndTransform } from './transform/index.js';
import { executeToDatabase } from '../execute/index.js';
import { initializeDatabase } from '../execute/schema.js';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

function processJsonlFile(filePath: string) {
  const sessionId = filePath.split('/').pop()?.replace('.jsonl', '') || 'unknown';
  console.log(`DEBUG: Processing JSONL file: ${filePath}`);
  console.log(`DEBUG: Extracted session ID: ${sessionId}`);
  
  try {
    console.log(`DEBUG: Reading file content from: ${filePath}`);
    const content = readFileSync(filePath, 'utf8');
    console.log(`DEBUG: File content length: ${content.length} characters`);
    
    const lines = content.trim().split('\n').filter(line => line.trim());
    console.log(`DEBUG: Found ${lines.length} non-empty lines`);
    
    const messages = lines.map(line => JSON.parse(line));
    console.log(`DEBUG: Parsed ${messages.length} JSON messages`);
    
    const result = executeToDatabase(messages, sessionId, filePath);
    console.log(`DEBUG: Database operation complete - inserted: ${result.messagesInserted}, updated: ${result.messagesUpdated}, errors: ${result.errors.length}`);
    console.log(`Synced ${result.messagesInserted} messages from ${sessionId}`);
    
    if (result.errors && result.errors.length > 0) {
      console.error(`Errors in ${sessionId}:`, result.errors.slice(0, 3)); // Show first 3 errors
    }
  } catch (error) {
    console.error(`ERROR: Failed to process ${filePath}:`, error);
    console.error(`ERROR: Error stack:`, error.stack);
  }
}

export async function runClaudeCodeSync() {
  console.log('Claude Code sync pipeline starting...');
  
  // Initialize database
  initializeDatabase();
  
  // Initial sync of all existing files  
  const getBasePath = () => {
    // In Docker container, use /home/user, otherwise use actual homedir
    return process.env.NODE_ENV === 'production' ? '/home/user' : homedir();
  };
  
  const projectsDir = join(getBasePath(), '.claude', 'projects');
  const projectDirs = readdirSync(projectsDir, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name);
  
  for (const projectDir of projectDirs) {
    const projectPath = join(projectsDir, projectDir);
    const files = readdirSync(projectPath)
      .filter(file => file.endsWith('.jsonl'));
    
    if (files.length === 0) continue;
    
    for (const file of files) {
      const filePath = join(projectPath, file);
      processJsonlFile(filePath);
    }
  }
  
  console.log('Initial sync complete');
}

export async function startWatching() {
  console.log('Starting real-time sync...');
  initializeDatabase();
  
  console.log('Performing initial sync on startup...');
  await runClaudeCodeSync();
  
  console.log('Starting file watcher...');
  return watchJsonl((filePath) => {
    console.log(`File watcher triggered for: ${filePath}`);
    processJsonlFile(filePath);
  });
}

