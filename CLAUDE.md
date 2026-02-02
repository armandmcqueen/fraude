# Claude Code Instructions

## TODO System

This project uses a file-based TODO system in the `todo/` directory.

### Files
- `todo/TODO.md` - Active todo list with current status and remaining tasks
- `todo/DONE.md` - Historical record of completed work
- `todo/<N>_<name>.md` - Detail files for complex tasks (e.g., `1_setup_nextjs.md`)

### Workflow
1. **Before starting work**: Read `todo/TODO.md` to understand current state
2. **When starting a task**: Mark it as in-progress by changing `[ ]` to `[x]` and adding "(in progress)" or similar
3. **When completing a task**: Move the item to the "Completed" section with the date
4. **For complex tasks**: Create a detail file with step-by-step notes, decisions made, and any blockers
5. **Update status**: Keep the "Current Status" section at the top accurate

### Example Detail File
```markdown
# 1. Setup Next.js

## Steps
1. Run create-next-app
2. Configure TypeScript strict mode
3. Set up Tailwind

## Decisions Made
- Using App Router (not Pages)
- Using src/ directory

## Blockers
- None
```

## Documentation Requirements

**Always update documentation when making changes.** This includes:
- `DESIGN.md` - Update when adding new architectural components or changing design decisions
- `IMPLEMENTATION.md` - Update when adding new files, changing data flow, or modifying types
- `todo/TODO.md` - Update task status and add completed items with dates

## Project Structure
- `DESIGN.md` - Stable architecture and design decisions
- `IMPLEMENTATION.md` - Implementation details (will evolve)
- `todo/` - Task tracking

## Component Library: shadcn/ui

This project uses **shadcn/ui** for UI components. We are adopting it incrementally.

### Incremental Adoption Strategy

When working on a feature that involves UI:
1. Check if the feature requires a component that should use shadcn/ui (toggles, buttons, dialogs, dropdowns, etc.)
2. If a custom/janky implementation exists, ask the user: "Should we migrate this to shadcn/ui first?"
3. Wait for user confirmation before proceeding with the migration
4. Only then continue with the feature work

Do NOT proactively migrate all components at once - only migrate when touching that area of the codebase.
