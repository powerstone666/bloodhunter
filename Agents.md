<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

<!-- END:nextjs-agent-rules -->

# Always use imran-experience skills and other relevant skills you have

Skills provide specialized instructions and workflows for specific tasks.
Use the skill tool to load a skill when a task matches its description.

# Bloodhunter Agent Coding Rules

## Build Rules

### Package Version Policy

- Use `@latest` in all install commands
- Never hardcode package versions in documentation or commands
- The lockfile pins actual resolved versions
- Example: `npm install zod@latest` not `npm install zod@3.23.8`

### Testing Requirements

Every phase must pass:

```bash
npm run typecheck
npm run lint
npm run test
npm run build
```

Phases touching user flows must also pass:

```bash
npm run test:e2e
```

### Code Style

- TypeScript strict mode enabled
- Use Zod for runtime validation
- Use React Hook Form + Zod for forms
- Prefer Server Components by default
- Use Client Components only when needed (interactivity, hooks, browser APIs)
- Follow Material Design 3 visual guidelines for UI
- No unnecessary comments - let code explain itself
- Small functions with early returns
- Descriptive names over abbreviations

### File Organization

- Route groups for non-route folders: `(services)`, `(common-lib)`, `(ui)`
- Private folders with underscore: `_components`, `_lib`
- API routes under `app/api/`
- Shared schemas in `app/(common-lib)/schemas/`
- UI components in `app/(ui)/components/`
- Backend services in `app/api/(services)/`

### Next.js 16 Specifics

- `params` is a Promise - must be awaited
- Use `PageProps<'/route'>` and `LayoutProps<'/route'>` global helpers
- Route Handlers use Web Request/Response APIs
- No `pages/` directory - App Router only

### Mock-First Development

- Build UI and data contracts with mock data first
- Do not connect real LLM agents, scanners, or external services until UI/schema/DB are stable
- Use fixtures for test data

### Phase Completion Criteria

Each phase must have:

- Clear goal
- Small build scope
- Test requirement
- Manual demo requirement
- Definition of done
- Feedback step before next phase

## Architecture Decisions

See `docs/decisions/` for architectural decision records.

## Feedback

Phase review notes go in `docs/feedback/`.

## Agent Tickets

Small implementation tickets go in `docs/agent-tickets/`.
