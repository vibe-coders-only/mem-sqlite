// Parse JSONL entries and classify message types
export function parseAndTransform(entry: any) {
  // TODO: Parse entry, identify type (tool_use, completion, etc.)
  console.log('Parsing entry:', entry);
  return { parsed: true, type: 'unknown', data: entry };
}