# mem-sqlite Project Rules

## Critical System Rules

### STRICT PROHIBITION: DO NOT EDIT OR CREATE FILES IN DIR ~/.claude/projects/ 
**ZERO TOLERANCE POLICY**: This directory is READ-only for AI agents.

- **NO FILE CREATION** in `~/.claude/projects/` or subdirectories
- **NO FILE MODIFICATION** of any JSONL files in this domain
- **NO TESTING FILES** or synthetic data insertions
- **NO TOUCH COMMANDS** or file operations

**Rationale**: The `~/.claude/projects/` directory contains actual Claude Code conversation data in JSONL format. Any synthetic insertions:
- Pollute the production data store
- Generate massive error logging due to format incompatibility
- Corrupt the real-time sync pipeline we're debugging
- Create false positive test results

### Testing and Debugging Guidelines

- Use existing JSONL data for debugging
- Monitor logs via `docker compose logs` 
- Test fixes by restarting containers
- Create test data in dedicated test directories only