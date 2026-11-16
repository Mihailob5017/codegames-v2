# AGENTS.md

Guidance for AI coding agents (Claude, Codex, Cursor, Kilo and others) working in this repository.

## Project

- `api/`: Express 5 + TypeScript (ESM, relative imports keep the `.ts` extension), Drizzle ORM on PostgreSQL, Zod 4 validation.
- `web/`: React 19 + Vite + TypeScript.
- Design and decisions: [docs/Architecture.md](docs/Architecture.md) and [docs/Technical Decisions.md](docs/Technical%20Decisions.md).

## Commands (from the repo root)

- Tests: `npm test`, `npm run test:api`, `npm run test:web`, `npm run test:coverage`
- API typecheck: `npx --prefix api tsc --noEmit -p api`
- Web build and lint: `npm --prefix web run build`, `npm --prefix web run lint`
- Database (runs in Docker): `npm run db:generate`, `npm run db:migrate`, `npm run db:seed`

## Reviewing changes

When asked to review changes, for example "review this before I commit", follow [docs/Review Guidelines.md](docs/Review%20Guidelines.md) exactly. It covers the review checklist, the report format, and how to write and verify tests afterwards. Tests are written only once there are no 🔴 Blocker or 🟠 Important findings.

In Claude Code, the `/review` command runs this as two agents: `code-reviewer`, which is read-only, then `test-writer` once the review is approved. See `.claude/agents/` and `.claude/commands/review.md`.
