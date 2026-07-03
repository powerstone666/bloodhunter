# ADR-0001: Build Rules and Development Workflow

## Status

Accepted

## Context

Bloodhunter (Strix TS port) is a security scanner web application being ported from Python to TypeScript/Next.js. The project requires:

- Multi-agent coordination for building features
- Consistent code quality across contributors
- Clear testing and validation gates
- Mock-first development to avoid premature integration with external services

## Decision

### Package Management

All package installations must use `@latest` tag:

```bash
npm install package-name@latest
npm install -D package-name@latest
```

Never hardcode versions in documentation or commands. The lockfile pins actual resolved versions.

### Testing Gates

Every phase must pass these checks before proceeding:

```bash
npm run typecheck  # TypeScript compilation
npm run lint       # ESLint validation
npm run test       # Vitest unit tests
npm run build      # Production build
```

User-facing features must also pass:

```bash
npm run test:e2e   # Playwright E2E tests
```

### Code Style

- TypeScript strict mode enabled
- Zod for runtime validation
- React Hook Form + Zod for forms
- Server Components by default
- Client Components only when needed (interactivity, hooks, browser APIs)
- Material Design 3 visual guidelines
- No unnecessary comments
- Small functions with early returns
- Descriptive names over abbreviations

### File Organization

Follow Next.js App Router conventions with route groups:

- `app/(common-lib)/` - Shared code (schemas, types, utils)
- `app/(ui)/` - UI components
- `app/api/` - API route handlers
- `app/api/(services)/` - Backend services
- `_components/` - Private component folders
- `_lib/` - Private utility folders

### Next.js 16 Breaking Changes

- `params` is a Promise - must be awaited
- Use global `PageProps<'/route'>` and `LayoutProps<'/route'>` helpers
- Route Handlers use Web Request/Response APIs
- App Router only - no `pages/` directory

### Development Workflow

1. Mock-first: Build UI and data contracts with mock data
2. Do not connect real services until UI/schema/DB are stable
3. Use fixtures for test data
4. Each phase must have clear goal, scope, tests, demo, and feedback gate

## Consequences

**Positive:**

- Consistent code quality across all contributors
- Clear validation gates prevent broken builds
- Mock-first approach reduces integration risk
- Agent-friendly structure for AI-assisted development

**Negative:**

- Slightly slower initial development due to testing requirements
- Requires discipline to maintain mock-first approach

## Related

- [STRIX_TS_PORT_PLAN.md](../../STRIX_TS_PORT_PLAN.md) - Full implementation plan
- [AGENTS.md](../../AGENTS.md) - Agent coding rules
