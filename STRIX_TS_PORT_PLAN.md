# Strix TypeScript Port — Agent-Friendly Build Plan

## Reference

- **Python Strix source**: `/Users/imran/Downloads/Upskilling/strix/`
- **TypeScript port plan**: `/Users/imran/Downloads/Upskilling/STRIX_TS_PORT_PLAN.md`

## 1. Purpose

This plan rewrites the earlier Strix TypeScript port roadmap into a buildable, testable, feedback-driven sequence.

The goal is not to build the full security SaaS in one giant pass. The goal is to let coding agents build one small slice at a time, prove it works, get feedback, and only then move to the next slice.

Core target:

- Port Strix from a Python CLI/TUI security scanner into a modern Next.js TypeScript web app.
- Keep the architecture agent-friendly, modular, testable, and easy to resume.
- Use modern UI patterns, latest package installs, and no hardcoded framework versions in commands or docs.
- Start with mocked scan data and fake streams before connecting real agents, sandboxes, or scanners.

## 2. Non-negotiable build rules

### 2.1 Package version rule

Do not hardcode package versions in the implementation plan.

Use:

```bash
npx create-next-app@latest strix-ts --yes --src-dir
npx shadcn@latest init
npm install package-name@latest
npm install -D package-name@latest
```

Do not write commands like:

```bash
npm install next@14.5.0
npm install react@19.0.0
npm install @xterm/xterm@6.0.0
```

The lockfile will pin the resolved versions. The plan and agent instructions should stay future-proof.

### 2.2 Small phase rule

Each phase must be small enough for one agent to complete in one focused PR.

A phase is only valid if it has:

- A clear goal.
- A small build scope.
- A test requirement.
- A manual demo requirement.
- A definition of done.
- A feedback step before the next phase starts.

### 2.3 Mock-first rule

Build UI and data contracts with mock data first.

Do not connect real LLM agents, real sandbox execution, real browser automation, Caido, Vercel Sandbox, or Docker until the UI, event schema, DB schema, and scan lifecycle are stable.

### 2.4 One vertical slice before breadth

Build one complete thin slice first:

New scan form -> create scan record -> mock scan stream -> live scan detail UI -> mock vulnerability -> report preview.

Only after this works should agents add advanced features such as multi-agent orchestration, memory graphs, MCP, skills, model switching, enterprise teams, or billing.

### 2.5 Scope control

Every scan config must support:

- Target URL.
- Scope mode.
- Allowed hostnames.
- Excluded paths.
- Optional auth headers/cookies.
- Aggressiveness level.
- Audit trail.

No runtime backend should execute against hosts outside the configured allowlist.

## 3. Recommended setup commands

### 3.1 Create app

```bash
npx create-next-app@latest strix-ts --yes --src-dir
cd strix-ts
```

Expected defaults:

- TypeScript.
- App Router.
- Tailwind CSS.
- ESLint.
- Turbopack.
- Import alias.
- Agent guidance files if the CLI adds them.

### 3.2 Initialize shadcn/ui

```bash
npx shadcn@latest init
```

Add UI primitives only when needed by a phase. Do not install every component on day one.

Starter components:

```bash
npx shadcn@latest add button card badge tabs input textarea select dialog sheet dropdown-menu table form label separator scroll-area skeleton progress toast tooltip
```

### 3.3 Core runtime packages

```bash
npm install zod@latest
npm install react-hook-form@latest @hookform/resolvers@latest
npm install better-sqlite3@latest
npm install nanoid@latest
npm install date-fns@latest
```

### 3.4 UI packages

```bash
npm install lucide-react@latest next-themes@latest
npm install @tanstack/react-table@latest
npm install react-resizable-panels@latest
npm install @xterm/xterm@latest @xterm/addon-fit@latest @xterm/addon-search@latest @xterm/addon-web-links@latest
npm install cmdk@latest sonner@latest vaul@latest recharts@latest
npm install react-markdown@latest remark-gfm@latest rehype-highlight@latest
```

### 3.5 AI and agent packages

Install these only when the agent phase starts, not during UI bootstrap.

```bash
npm install ai@latest
npm install @ai-sdk/openai@latest @ai-sdk/anthropic@latest @ai-sdk/google@latest @ai-sdk/openai-compatible@latest @ai-sdk/langchain@latest
npm install @langchain/core@latest @langchain/langgraph@latest deepagents@latest
```

### 3.6 Auth packages

Install these only when the auth phase starts.

```bash
npm install next-auth@latest
```

### 3.7 Testing packages

```bash
npm install -D vitest@latest @vitest/ui@latest
npm install -D @testing-library/react@latest @testing-library/jest-dom@latest jsdom@latest
npm install -D playwright@latest
npm install -D prettier@latest eslint@latest
```

### 3.8 Required scripts

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test",
    "check": "npm run typecheck && npm run lint && npm run test && npm run build"
  }
}
```

## 4. Target architecture

The final system should be modular. Each module should be independently testable.

```text
src/
  app/
    layout.tsx
    page.tsx
    scans/
      page.tsx
      new/page.tsx
      [id]/page.tsx
      [id]/report/page.tsx
    reports/page.tsx
    skills/page.tsx
    memory/page.tsx
    settings/page.tsx
    api/
      scans/route.ts
      scans/[id]/route.ts
      scans/[id]/stream/route.ts
      providers/route.ts
      auth/[...nextauth]/route.ts

  features/
    dashboard/
    scans/
      components/
      hooks/
      mock/
      agent-tree/
      terminal/
      vulns/
      controls/
    reports/
    skills/
    memory/
    settings/
    bot/

  components/
    ui/
    layouts/
    shared/
      terminal/
      markdown.tsx
      model-switcher.tsx
      empty-state.tsx

  lib/
    db/
    events/
    scan-engine/
    coordinator/
    agents/
    providers/
    runtime/
    memory/
    reports/
    skills/
    security/
    utils/

  schemas/
    scan.ts
    vulnerability.ts
    provider.ts
    events.ts

  tests/
    unit/
    integration/
    e2e/
    fixtures/

  docs/
    decisions/
    agent-tickets/
    feedback/
```

## 5. Core contracts to build first

Agents should not start with UI details or LLM orchestration. They should first stabilize shared contracts.

### 5.1 Scan status

```ts
export type ScanStatus =
  | "draft"
  | "queued"
  | "running"
  | "paused"
  | "completed"
  | "failed"
  | "cancelled"
```

### 5.2 Scan phase

```ts
export type ScanPhase =
  | "setup"
  | "recon"
  | "fingerprint"
  | "analysis"
  | "verification"
  | "report"
```

### 5.3 Scan event

```ts
export type ScanEvent =
  | { type: "scan.created"; scanId: string; timestamp: string }
  | { type: "scan.started"; scanId: string; timestamp: string }
  | { type: "phase.started"; scanId: string; phase: ScanPhase; timestamp: string }
  | { type: "phase.completed"; scanId: string; phase: ScanPhase; timestamp: string }
  | { type: "agent.spawned"; scanId: string; agentId: string; parentId?: string; name: string; timestamp: string }
  | { type: "agent.log"; scanId: string; agentId: string; level: "info" | "warn" | "error" | "success"; message: string; timestamp: string }
  | { type: "tool.called"; scanId: string; agentId: string; toolName: string; summary: string; timestamp: string }
  | { type: "finding.created"; scanId: string; findingId: string; title: string; severity: Severity; timestamp: string }
  | { type: "scan.completed"; scanId: string; timestamp: string }
  | { type: "scan.failed"; scanId: string; error: string; timestamp: string }
```

### 5.4 Vulnerability schema

```ts
export type Severity = "critical" | "high" | "medium" | "low" | "info"

export interface Vulnerability {
  id: string
  scanId: string
  title: string
  severity: Severity
  endpoint: string
  method?: string
  description: string
  evidence: string
  remediation?: string
  confidence: "confirmed" | "likely" | "possible"
  status: "new" | "reviewed" | "accepted" | "false_positive" | "fixed"
  createdAt: string
}
```

---

## DeepAgents vs Python Strix: Functional Comparison

Strix's Python agent is built on the bare `openai-agents==0.14.6` SDK with a hand-rolled coordinator. DeepAgents provides these capabilities **out of the box** — no code to write, no edge cases to miss:

### Agent Capabilities

| Capability | Python Strix (openai-agents SDK) | DeepAgents (TS) | Why It Matters for Security Scanning |
|---|---|---|---|
| **Task planning** | Custom `todo` tool (~585 lines) — flat list, no state tracking across turns | Built-in `write_todos` with `pending`/`in_progress`/`completed` state, persisted in agent state, visible in LangSmith traces | Long scans (30+ min) need structured progress tracking across 100+ agent turns. Agents that lose track of what they've done miss vulnerabilities or repeat work. |
| **Filesystem as working memory** | Custom `notes` tool (~417 lines) — basic read/write, no glob, no grep, no line-level editing | Built-in `ls`, `read_file` (with offset/limit), `write_file`, `edit_file` (exact string replacement), `glob`, `grep` | Agents need to store intermediate findings (HTTP responses, extracted endpoints, fuzzing results) without blowing context window. DeepAgents' `edit_file` with exact string replacement means agents can update findings in-place without rewriting entire files. |
| **Context overflow management** | **None** — agents crash or silently truncate when context window fills on long scans | Automatic summarization + offloading large tool results to filesystem; agent reads summaries, not raw data | A single scan can generate 100+ HTTP responses, 50+ browser screenshots, 1000+ extracted endpoints. Without offloading, the agent forgets early findings by the time it reaches the last endpoint. |
| **Sub-agent delegation** | Custom `agents_graph` tool (~673 lines) — manual spawn, manual message passing, manual lifecycle | Built-in `task` tool — isolated context windows, autonomous execution, auto-summarized final report | Parent agent scans the sitemap, spawns child agents for each endpoint. Children hunt independently without polluting parent's context. DeepAgents' isolation means a child can do 50 turns of deep inspection and return only the findings. |
| **Prompt caching** | **Not implemented** — every turn reprocesses the full system prompt + skills | Auto-enabled for Anthropic/Bedrock models; caches static prompt sections across turns | Security scans repeat the same system prompt on every turn. Caching reduces latency ~40% and cost ~60% on long scans. |
| **Checkpointing / resume** | Custom `agents.json` + `agents.db` snapshot — manual, no automatic resume on failure | LangGraph checkpointing — automatic state persistence, resume from any point, replay from any turn | If a scan fails at turn 87 of 100, DeepAgents resumes from turn 87 with full state. Python Strix restarts the entire scan. |
| **Memory across sessions** | None — each scan starts fresh | `AGENTS.md` files persisted across sessions, read at startup, updated by agent based on feedback | The agent learns from previous scans — "this target uses WAF rule X, bypass with technique Y" — and carries that knowledge to future scans of the same target. |
| **Human-in-the-loop** | Not implemented — no way to pause, review, or redirect mid-scan | Built-in `interrupt_on` — pause on specific tools (e.g., `report_vulnerability`), approve/edit/reject before execution | Security scanners can produce false positives. Reviewing findings before they're committed prevents noise in the report. |
| **Streaming** | `Runner.run_streamed()` — basic event stream, no structured progress events | Typed event streams with `stream.subagents` — each delegated task gets its own stream handle with independent message, tool, and nested subagent streams | The UI can show a live tree: parent agent → child agent 1 → tool calls, child agent 2 → tool calls, all in parallel. Python Strix's flat stream can't do this. |
| **Skills** | Custom `load_skill` tool (~106 lines) — loads markdown at runtime, no progressive disclosure | Built-in SKILL.md loader with progressive disclosure — reads frontmatter at startup, full content only when needed | Strix has 53 skills. Without progressive disclosure, loading all skills upfront consumes ~30K tokens. DeepAgents keeps startup compact and loads skills on demand. |
| **MCP integration** | Not implemented | Built-in MCP support — connect to any MCP server for additional tools | Future-proof: connect to MCP servers for new attack surfaces, databases, cloud APIs without modifying the agent. |
| **Sandbox backends** | Docker only | Pluggable backends (in-memory, local disk, LangGraph store, composite, custom) + sandbox backends with `execute` tool | Development runs in-memory, production runs in Vercel Sandbox, self-hosted runs in Docker — same code, different backend. |
| **Observability** | Basic logging + PostHog events | LangSmith — full trace of every turn, tool call, sub-agent spawn, with timing, token usage, and error attribution | Debugging a 100-turn scan that produced 3 false positives is impossible without per-turn tracing. LangSmith shows exactly which turn introduced each finding. |

### Things Strix Does That DeepAgents Doesn't (Still Need Custom Code)

| Capability | Why DeepAgents Can't Do It | Custom Solution |
|---|---|---|
| **Parent↔child bidirectional messaging** | DeepAgents sub-agents are stateless — one task, one report | Custom coordinator with `sendToParentTool` / `sendToChildTool` that read/write to a DB-backed message queue |
| **Park/wake agent loop** | DeepAgents runs its own loop — agents run to completion | Coordinator manages agent lifecycle externally; DeepAgents runs as a step within the coordinator's loop |
| **Scan lifecycle management** | DeepAgents handles one task, not a multi-phase scan (recon → fingerprint → exploit → report) | Coordinator orchestrates phases: spawn recon agent → analyze results → spawn exploit agents → aggregate → report |
| **Vulnerability deduplication** | Not in scope for a general agent harness | Custom dedup logic (port from `report/dedupe.py`) |
| **CVSS scoring** | Not in scope | Custom or `@turingpointde/cvss-calculator` |

### Vercel AI SDK model routing + DeepAgents bridge

DeepAgents expects LangChain `BaseChatModel`. Vercel AI SDK models are `LanguageModelV1`. A thin wrapper bridges them:

```typescript
// lib/ai-sdk-langchain-bridge.ts
import { BaseChatModel } from "@langchain/core/language_models/chat_models"
import { AIMessage, AIMessageChunk } from "@langchain/core/messages"
import { generateText, streamText, type LanguageModelV1 } from "ai"
import { convertModelMessages } from "@ai-sdk/langchain"

class AISDKChatModel extends BaseChatModel {
  constructor(private model: LanguageModelV1) {
    super({})
  }
  _llmType() { return "ai-sdk-bridge" }

  async _generate(messages: BaseMessage[]) {
    const result = await generateText({
      model: this.model,
      messages: convertModelMessages(messages),
    })
    return {
      generations: [{ message: new AIMessage(result.text), text: result.text }],
      llmOutput: { usage: result.usage, finishReason: result.finishReason },
    }
  }

  async *_streamResponseChunks(messages: BaseMessage[]) {
    const { textStream } = streamText({
      model: this.model,
      messages: convertModelMessages(messages),
    })
    for await (const chunk of textStream) {
      yield new AIMessageChunk({ content: chunk })
    }
  }
}

export function wrapAISDKModel(model: LanguageModelV1) {
  return new AISDKChatModel(model)
}
```

Usage — Vercel AI SDK model routing + DeepAgents agent harness:

```typescript
import { createProviderRegistry } from "ai"
import { openai } from "@ai-sdk/openai"
import { anthropic } from "@ai-sdk/anthropic"
import { createDeepAgent } from "deepagents"
import { wrapAISDKModel } from "@/lib/ai-sdk-langchain-bridge"

const registry = createProviderRegistry({ openai, anthropic })

const model = registry.languageModel("anthropic:claude-sonnet-4-6")
const agent = createDeepAgent({
  model: wrapAISDKModel(model),  // ← 50-line bridge
  tools: [mySecurityTool],
})
```

For the Next.js frontend, `@ai-sdk/langchain`'s `toUIMessageStream` converts DeepAgents/LangGraph streams into AI SDK UI streams that `useChat` consumes directly — real-time text deltas, tool calls, and custom data events in the browser.

---

## Phase 0 - Repo contract and agent rules

Goal: Make the repo safe for multiple coding agents.

Build:

- Create the Next.js project.
- Add `AGENTS.md` with coding rules.
- Add `docs/decisions/0001-build-rules.md`.
- Add package version policy: commands use `@latest`; lockfile pins actual versions.
- Add `docs/feedback/` for phase review notes.
- Add `docs/agent-tickets/` for small implementation tickets.

Tests:

- `npm run typecheck`
- `npm run lint`
- `npm run build`

Manual demo:

- App runs locally.
- Home page renders.
- Agents can read `AGENTS.md` and understand build rules.

Definition of done:

- Repo boots without errors.
- No hardcoded package versions in plan commands.
- A future agent can start from clear instructions.

Feedback gate:

- Confirm folder structure and coding rules before adding UI.

## Phase 1 - Modern app shell and design system

Goal: Build the visual foundation only.

Build:

- Add shadcn/ui.
- Add app layout with sidebar, top bar, and main content area.
- Add theme support.
- Add empty pages for Dashboard, Scans, Reports, Skills, Memory, Settings.
- Add reusable layout components.
- Add basic responsive behavior.

Do not build:

- Real scans.
- Real agents.
- Real DB.
- Real auth.

Tests:

- Unit test sidebar nav renders.
- Unit test active route state.
- Build test.
- One Playwright smoke test: home page loads and navigation works.

Manual demo:

- Navigate between main sections.
- Toggle theme.
- Resize screen and confirm layout does not break.

Definition of done:

- UI shell feels modern and clean.
- All routes exist with empty states.
- No business logic mixed into layout.

Feedback gate:

- Review visual direction before building feature screens.

## Phase 2 - Shared schemas and mock data

Goal: Define stable contracts before real implementation.

Build:

- Add Zod schemas for scan config, scan event, agent, vulnerability, provider config.
- Add TypeScript types derived from Zod.
- Add mock scan fixtures.
- Add mock vulnerabilities.
- Add mock agent tree data.
- Add event generator for fake scan streams.

Tests:

- Schema validation tests.
- Fixture validation tests.
- Event generator test.

Manual demo:

- A debug route or Storybook-like page renders mock scan data.

Definition of done:

- All UI and API code can depend on shared schemas.
- Mock events look like real future scan events.

Feedback gate:

- Confirm event names and vulnerability fields before building streaming UI.

## Phase 3 - Scan list and new scan form using mock API

Goal: Build the first user workflow without DB or agents.

Build:

- `/scans` page with tabs: Active, Paused, Completed, Failed.
- `/scans/new` page with scan form.
- Fields: target URL, scope mode, max depth, max agents, environment, custom headers, custom cookies, excluded paths, model placeholder.
- Use React Hook Form and Zod validation.
- Mock `POST /api/scans` returns a fake scan ID.
- Redirect to `/scans/[id]` after create.

Tests:

- Form validation unit tests.
- API route mock test.
- Playwright test: create scan with valid target.
- Playwright test: invalid URL shows validation error.

Manual demo:

- Create a fake scan and land on scan detail page.

Definition of done:

- The first vertical flow exists.
- No real scanner involved yet.

Feedback gate:

- Confirm form fields are enough for MVP.

## Phase 4 - Scan detail page with fake live stream

Goal: Prove the core UX before real scan execution.

Build:

- Scan detail page with resizable panels.
- Left panel: agent tree.
- Center panel: terminal-style event stream.
- Right panel: vulnerabilities and findings tabs.
- Bottom drawer: memory placeholder.
- Mock SSE endpoint that emits fake events over time.
- UI consumes SSE and updates panels live.

Tests:

- Event reducer unit tests.
- SSE parser tests.
- Terminal render tests with fake logs.
- Playwright test: fake scan stream shows logs and vulnerability card.

Manual demo:

- Start fake scan.
- Watch agent logs appear.
- Watch a fake vulnerability appear.
- Pause and resume buttons can update local state, even if not real yet.

Definition of done:

- The product looks alive with fake events.
- Event-driven UI is stable.

Feedback gate:

- Review scan detail UX before connecting DB or agents.

## Phase 5 - SQLite persistence v1

Goal: Persist scans, events, and vulnerabilities.

Build:

- Add `app.db` for users/settings/scan metadata.
- Add per-scan DB path convention: `data/scans/scan-{id}.db`.
- Implement DB initialization.
- Tables:
  - scans
  - scan_events
  - agents
  - vulnerabilities
  - provider_configs placeholder
- Replace mock scan create with real DB insert.
- Save fake stream events into DB.
- Replay previous events when opening an existing scan.

Tests:

- DB migration/init tests.
- Repository tests for scan CRUD.
- Event persistence tests.
- Replay test.

Manual demo:

- Create scan.
- Reload page.
- Events and vulnerabilities remain visible.

Definition of done:

- Scan state survives refresh.
- UI still uses fake event engine, but persistence is real.

Feedback gate:

- Confirm DB shape before adding auth and providers.

## Phase 6 - Provider settings and model selector

Goal: Add provider configuration without real agent execution.

Build:

- Settings page for providers.
- Add provider config form.
- Fields: provider, API key, base URL, default model, enabled flag.
- Store API keys encrypted at rest.
- Add provider connection test endpoint with safe mock mode.
- Add model selector UI to New Scan form.
- Add provider registry wrapper interface.

Tests:

- Provider schema tests.
- Encryption/decryption tests.
- API key never returned to client test.
- UI test for adding provider config.

Manual demo:

- Add provider.
- See masked API key.
- Select provider/model on new scan form.

Definition of done:

- Provider settings exist.
- Secrets are not exposed back to the browser.
- Real LLM calls are still optional and gated.

Feedback gate:

- Confirm provider UX before connecting DeepAgents.

## Phase 7 - Auth and user scope

Goal: Add basic user separation.

Build:

- Add Auth.js/NextAuth route.
- Add login page.
- Add session helper.
- Attach scans and provider configs to user ID.
- Protect dashboard and settings routes.
- Keep local dev bypass option behind explicit env flag.

Tests:

- Auth route exists.
- Protected pages redirect unauthenticated users.
- User A cannot fetch User B scan by ID.
- Provider configs are user-scoped.

Manual demo:

- Login.
- Create scan.
- Logout.
- Protected pages require auth.

Definition of done:

- User separation works for MVP.
- Team/multi-tenant enterprise features are deferred.

Feedback gate:

- Confirm auth flow before adding expensive runtime/agent work.

## Phase 8 - Runtime backend abstraction

Goal: Add runtime interface before choosing Docker, Vercel Sandbox, or local process.

Build:

- Create `RuntimeBackend` interface.
- Create `MockRuntimeBackend` first.
- Optional later backends:
  - `LocalRuntimeBackend` for safe local commands.
  - `DockerRuntimeBackend` for offline/self-hosted.
  - `VercelSandboxBackend` for deployed sandbox execution.
- Add allowlist checks before any network operation.
- Add runtime event streaming into existing ScanEvent schema.

Tests:

- Mock runtime tests.
- Allowlist validation tests.
- Command result normalization tests.
- Runtime error handling tests.

Manual demo:

- Fake scan uses runtime interface instead of direct mock generator.

Definition of done:

- Scan engine does not care which runtime backend is used.
- No unsafe command execution exists in MVP.

Feedback gate:

- Confirm runtime contract before adding real HTTP/browser tools.

## Phase 9 - Agent harness minimal

Goal: Connect one simple agent in isolation.

Build:

- Add provider registry wrapper.
- Add DeepAgents wrapper only for a small test task.
- Add one harmless tool: `record_note` or `emit_log`.
- Add one test agent route disabled by default.
- Stream agent events into existing UI event contract.
- Add timeout and cancellation control.

Do not build:

- Recon scanner.
- Exploit tools.
- Browser automation.
- Multi-agent coordinator.

Tests:

- Agent factory unit test with mocked model.
- Tool schema tests.
- Timeout test.
- Event conversion test.

Manual demo:

- Agent says hello and emits structured logs into scan detail UI.

Definition of done:

- Real agent plumbing works on a harmless task.
- UI does not need changes to display real agent events.

Feedback gate:

- Confirm the bridge and stream shape before adding security tools.

## Phase 10 - Single-agent recon MVP

Goal: Build the first useful security scanning slice in a controlled way.

Build:

- Add authorized target validation.
- Add `http_request` tool with host allowlist enforcement.
- Add passive recon only:
  - fetch root URL
  - read headers
  - collect links from same host
  - detect simple technologies from headers and HTML hints
- Save endpoints and findings into DB.
- Show results in UI.

Tests:

- Same-host allowlist tests.
- Blocks external redirect test.
- HTTP tool mocked response tests.
- Recon parser tests.
- E2E test against local fixture app.

Manual demo:

- Run passive scan against local test app.
- See endpoints and headers in UI.

Definition of done:

- One real passive scan works safely.
- No active exploitation or fuzzing yet.

Feedback gate:

- Review output quality before adding vulnerability reporting.

## Phase 11 - Vulnerability reporting pipeline

Goal: Add structured findings with review status.

Build:

- Add `report_vulnerability` tool.
- Add vulnerability dedupe v1.
- Add confidence field.
- Add status transitions:
  - new
  - reviewed
  - accepted
  - false_positive
  - fixed
- Add vulnerability detail page/panel.
- Add evidence redaction helper.

Tests:

- Dedupe unit tests.
- Status transition tests.
- Evidence redaction tests.
- UI filter tests.

Manual demo:

- Mock or local scan reports one finding.
- User marks it reviewed or false positive.

Definition of done:

- Findings are no longer just logs.
- User feedback can be recorded.

Feedback gate:

- Confirm fields and review flow before adding memory.

## Phase 12 - Memory Layer 1: scan history and checkpoint basics

Goal: Make scans resumable and explainable.

Build:

- Persist agent messages/tool calls in per-scan DB.
- Add checkpoint table.
- Add scan replay screen.
- Add pause/resume using DB state for current phase.
- Add failure recovery for fake and passive scans.

Tests:

- Checkpoint create/read tests.
- Resume from paused scan test.
- Failed scan retry test.
- Replay event ordering test.

Manual demo:

- Start scan.
- Pause.
- Refresh.
- Resume from previous state.

Definition of done:

- The scan lifecycle is reliable before parallel agents are added.

Feedback gate:

- Confirm resume behavior before building graph memory.

## Phase 13 - Attack surface graph v1

Goal: Add simple structured memory for endpoints and findings.

Build:

- Add nodes table.
- Add edges table.
- Node types:
  - endpoint
  - parameter
  - technology
  - finding
  - agent_action
- Edge types:
  - has_parameter
  - uses_technology
  - found_on
  - tested_by
- Add simple graph query functions.
- Add UI table view first, graph visualization later.

Do not build:

- Vector embeddings yet.
- D3 graph yet.
- Complex semantic search yet.

Tests:

- Node insert tests.
- Edge insert tests.
- Query untested endpoints test.
- Query findings by endpoint test.

Manual demo:

- Passive scan produces endpoint nodes.
- Finding links to endpoint.

Definition of done:

- Agents have a shared structured map.
- Visualization can still be simple.

Feedback gate:

- Confirm graph data model before adding vector search.

## Phase 14 - Human feedback loop

Goal: Let user feedback change future scan behavior.

Build:

- Add feedback table.
- Capture actions:
  - mark false positive
  - accept vulnerability
  - add remediation note
  - request deeper scan
  - ignore category
- Add feedback summary to scan report.
- Add basic user preference fields.

Tests:

- Feedback persistence tests.
- Preference update tests.
- Feedback visible in report test.

Manual demo:

- Mark a finding false positive.
- New scan config shows learned preference suggestion.

Definition of done:

- The product can iterate based on user corrections.

Feedback gate:

- Confirm what feedback should influence before automating behavior.

## Phase 15 - Report generation v1

Goal: Produce usable reports from current findings.

Build:

- Report summary page.
- Severity counts.
- Vulnerability list.
- Evidence section.
- Remediation section.
- Markdown export.
- JSON export.
- PDF export can be deferred until Markdown/HTML is stable.

Tests:

- Report renderer test.
- Export JSON schema test.
- Markdown snapshot test.
- Empty report test.

Manual demo:

- Generate report from scan with at least one finding.

Definition of done:

- User can share a basic report.
- Advanced charts are deferred.

Feedback gate:

- Review report format before PDF and charts.

## Phase 16 - Multi-agent coordinator v1

Goal: Add parallelism only after single-agent flow is stable.

Build:

- Coordinator table for agent lifecycle.
- Parent agent or coordinator process.
- Child hunter tasks for endpoint groups.
- DB-backed message queue.
- Agent tree UI updates from real agent lifecycle.
- Limit max agents with config.
- Add cancellation propagation.

Tests:

- Agent lifecycle tests.
- Queue tests.
- Cancellation tests.
- Max concurrency tests.
- Child result aggregation tests.

Manual demo:

- One scan spawns two safe child agents against local fixture endpoints.
- UI shows both agents.
- Results aggregate into one report.

Definition of done:

- Multi-agent behavior works on safe local fixtures.
- No duplicate scans of same endpoint group.

Feedback gate:

- Review stability before adding active scanning modules.

## Phase 17 - Skills manager v1

Goal: Add custom guidance without making the base prompt huge.

Build:

- Built-in skills list.
- Custom SKILL.md upload.
- Skill metadata parser.
- Skill preview page.
- Skill selection in New Scan form.
- Inject selected skill summaries into agent prompt.
- Keep full skill loading on demand.

Tests:

- Skill frontmatter parser tests.
- Invalid skill upload tests.
- Skill selection persistence tests.
- Prompt assembly snapshot test.

Manual demo:

- Upload a harmless custom skill.
- Select it for a scan.
- Agent receives skill summary.

Definition of done:

- Skills are manageable and do not overload context.

Feedback gate:

- Confirm skill UX before adding team-shared skills.

## Phase 18 - Model switching and provider resilience

Goal: Make long scans survive model/provider issues.

Build:

- Model switcher component.
- Provider failover config.
- Rate-limit error handling.
- Retry policy.
- Cost and token usage table.
- Store model used per agent turn.

Tests:

- Switch model updates next turn only.
- Provider error fallback test.
- Usage accounting test.
- UI state test.

Manual demo:

- Pause scan.
- Switch model.
- Resume scan.
- New logs show new model.

Definition of done:

- Model switching does not corrupt scan state.

Feedback gate:

- Confirm provider UX before adding model catalog automation.

## Phase 19 - Smart bot assistant v1

Goal: Add a helper panel that works with current scan context.

Build:

- Slide-out bot panel.
- Context injection from current scan/vulnerability.
- Actions:
  - explain finding
  - rewrite remediation
  - summarize scan
  - generate client-friendly wording
- Copy to report button.
- Send instruction to coordinator button, gated by confirmation.

Tests:

- Context builder test.
- Prompt injection guard test.
- Copy to report test.
- UI open/close test.

Manual demo:

- Open a vulnerability.
- Ask bot to simplify it.
- Insert rewritten text into report draft.

Definition of done:

- Bot helps the workflow without controlling scans by default.

Feedback gate:

- Confirm assistant actions before adding MCP tools.

## Phase 20 - Hardening, observability, and release prep

Goal: Make MVP safe to demo and deploy.

Build:

- Audit logs.
- Rate limits.
- Scan limits.
- Secret redaction.
- Structured logging.
- Error boundaries.
- Sentry integration.
- PostHog events.
- Dependency scanning in CI.
- Playwright E2E suite for critical flows.
- Demo dataset.
- Launch checklist.

Tests:

- Full `npm run check`.
- E2E happy path.
- E2E auth protection.
- E2E scan replay.
- Secret redaction tests.
- Load test for mock stream endpoint.

Manual demo:

- Fresh user logs in.
- Adds provider mock.
- Creates passive scan against local fixture.
- Watches scan stream.
- Reviews finding.
- Exports report.

Definition of done:

- MVP is demo-ready.
- Known limitations are documented.

Feedback gate:

- Decide next roadmap: active scanning, enterprise, MCP, advanced memory, or UI polish.

---

## 6. Deferred until after MVP

Do not include these in the first stable release:

- Billing.
- SSO/SAML.
- Team RBAC.
- Advanced D3 memory graph.
- Full vector search memory.
- Caido proxy integration.
- MCP marketplace.
- Active fuzzing modules.
- Browser automation at scale.
- Vercel Sandbox snapshots.
- Public report sharing links.
- Scheduled scans.
- Compliance templates.

These are valuable, but adding them early will overwhelm agents and increase context size.

## 7. Testing strategy

### 7.1 Per phase

Every phase must run:

```bash
npm run typecheck
npm run lint
npm run test
npm run build
```

Phases touching user flows must also run:

```bash
npm run test:e2e
```

### 7.2 Test layers

| Layer | Tool | What to test |
|---|---|---|
| Schemas | Vitest | Zod validation, event contracts, scan config |
| DB | Vitest | CRUD, migrations, per-scan isolation |
| UI components | Testing Library | Forms, tables, panels, states |
| Streams | Vitest | SSE parsing, event reducer, replay |
| E2E | Playwright | Create scan, stream logs, review finding, export report |
| Agent | Mocked model tests | Tool schemas, event conversion, timeout, cancellation |
| Runtime | Mock backend tests | Allowlist, command normalization, cleanup |

### 7.3 Required fixtures

Create fixtures early:

```text
tests/fixtures/
  scans/
    passive-scan-events.json
    scan-with-one-finding.json
    failed-scan-events.json
  targets/
    local-basic-app/
    local-auth-app/
  vulnerabilities/
    sql-injection.sample.json
    xss.sample.json
    info-header.sample.json
```

## 8. Agent ticket template

Every agent task should be written like this:

```md
# Ticket: Build scan event reducer

## Goal
Create a pure reducer that converts ScanEvent[] into ScanDetailState.

## Scope
- Add reducer in `src/features/scans/state/scan-event-reducer.ts`.
- Support scan, phase, agent, log, finding, complete, failed events.
- Add tests using fixtures.

## Out of scope
- UI rendering.
- SSE connection.
- DB persistence.

## Files allowed
- `src/features/scans/state/*`
- `src/schemas/events.ts`
- `tests/unit/scan-event-reducer.test.ts`

## Acceptance criteria
- All event types handled.
- Unknown events ignored safely.
- Events are idempotent if replayed.
- Tests pass.

## Commands
npm run test
npm run typecheck
```

## 9. Build order for coding agents

Use this order for best results:

1. Contracts.
2. Fixtures.
3. Mock UI.
4. Mock stream.
5. DB persistence.
6. Auth/settings.
7. Runtime interface.
8. Harmless agent.
9. Passive recon.
10. Vulnerability pipeline.
11. Report export.
12. Memory.
13. Multi-agent.
14. Advanced integrations.

This prevents the agent from being overloaded by trying to build UI, DB, LLM, sandbox, reports, and memory at the same time.

## 10. MVP success criteria

The MVP is complete when a user can:

- Log in.
- Add or select a provider config.
- Create a passive authorized scan.
- Watch live scan events.
- See agent logs.
- See endpoints/finding results.
- Review a vulnerability.
- Mark false positives.
- Generate a basic Markdown/JSON report.
- Resume or replay a scan.

The MVP does not need advanced exploitation, billing, enterprise teams, or a full autonomous pentest agent.

## 11. Summary

The improved plan is intentionally smaller and more buildable.

The old plan described the full product vision. This new plan converts that vision into a sequence of verified vertical slices:

- Mock first.
- Persist second.
- Agent third.
- Real scanning fourth.
- Multi-agent only after single-agent is stable.
- Advanced SaaS features last.

This gives coding agents a clear structure, reduces context overload, and creates feedback checkpoints after every meaningful phase.
