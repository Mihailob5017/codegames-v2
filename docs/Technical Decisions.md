# Technical Decisions

This document records _why_ we chose what we chose, one record per decision, in a lightweight
[ADR](https://adr.github.io/) (Architecture Decision Record) format. For _how_ the system fits together, see [Architecture](./Architecture.md).

Each record has:

- **Status** – `Accepted`, `Proposed`, `Open` (not yet decided), `Superseded by TD-xxx`
- **Context** – the problem or constraint that forced a choice
- **Decision** – what we chose
- **Alternatives considered** – what we rejected and why
- **Consequences** – trade-offs we accept as a result

Decisions are never edited once accepted; if one changes, add a new record and mark the old one `Superseded`.

---

## TD-001: Split the application into Web and API segments

- **Status:** Accepted
- **Context:** The product has a rich interactive frontend and a backend that coordinates persistence, code execution and storage. These evolve at different speeds and have different scaling needs.
- **Decision:** Two independently deployable segments – a React SPA (`web`) and an Express API (`api`) – communicating over HTTP.
- **Alternatives considered:**
  - Full-stack meta-framework (Next.js / Remix): tighter coupling, SSR not needed for this product.
  - Monolith serving templates: poor fit for an editor-heavy UI.
- **Consequences:** Two build pipelines and a shared API contract to maintain; in return, clear ownership boundaries and independent deployment.

## TD-002: TypeScript across both segments

- **Status:** Accepted
- **Context:** Both segments are JavaScript-runtime based; shared types (e.g. API payloads) reduce integration bugs.
- **Decision:** TypeScript everywhere.
- **Alternatives considered:** Plain JavaScript – faster to start, but loses type safety at the API boundary.
- **Consequences:** Build step required; potential to share DTO types between segments later.

## TD-003: React + Vite for the frontend

- **Status:** Accepted
- **Context:** Need a component-based UI with fast local iteration.
- **Decision:** React with Vite as build tool and dev server.
- **Alternatives considered:** Create React App (deprecated); Next.js (see TD-001); Vue/Svelte (team familiarity favours React).
- **Consequences:** Client-side rendering only; SEO is not a concern for an authenticated app.

## TD-004: CSS Modules with BEM naming

- **Status:** Accepted
- **Context:** Styles must be scoped to components without introducing a runtime styling library.
- **Decision:** CSS Modules for scoping, BEM (`block__element--modifier`) for naming within each module.
- **Alternatives considered:**
  - Tailwind: utility-first approach conflicts with the desired traditional component styling.
  - CSS-in-JS (styled-components, Emotion): runtime cost and extra dependency.
- **Consequences:** No runtime styling overhead; developers must follow the naming convention manually (consider a stylelint rule).

## TD-005: Redux slices + custom hooks for state management

- **Status:** Accepted
- **Context:** Global state (user session, current challenge, editor state) is shared across many components.
- **Decision:** Redux Toolkit slices for global state; custom hooks wrap store access and side effects so components stay thin.
- **Alternatives considered:** React Context only (re-render cost at scale); Zustand/Jotai (lighter, but less structured); TanStack Query alone (covers server state, not client state).
- **Consequences:** Some boilerplate per slice; predictable state and strong devtools. _Open:_ whether server-state fetching uses plain thunks or RTK Query – see TD-014.

## TD-006: Monaco as the in-browser code editor

- **Status:** Accepted
- **Context:** Users write code in the browser and expect an IDE-like experience.
- **Decision:** `@monaco-editor/react` (the editor behind VS Code).
- **Alternatives considered:** CodeMirror 6 (lighter bundle, less out-of-the-box language support); Ace (dated).
- **Consequences:** Large bundle (~2 MB); should be lazy-loaded on the editor route.

## TD-007: Express for the API

- **Status:** Accepted
- **Context:** Need a minimal, well-understood HTTP framework for a TypeScript backend.
- **Decision:** Express 5 with TypeScript.
- **Alternatives considered:** NestJS (opinionated, heavier; DDD structure is applied manually instead); Fastify (faster, smaller ecosystem).
- **Consequences:** Architecture conventions (TD-008) must be enforced by the team rather than the framework.

## TD-008: Domain-Driven Design for the API

- **Status:** Accepted
- **Context:** The backend spans several domains (users, challenges, submissions, media) that will grow independently.
- **Decision:** Organise code by domain into entities, repositories and services.
- **Alternatives considered:** Layer-first MVC (`controllers/`, `models/`, `services/`) – simpler initially, but cross-domain coupling grows quickly.
- **Consequences:** More upfront structure; clear boundaries and easier testing per domain.
  > Note: the current `api/` folder layout (`controllers/`, `models/`, `routes/`, `services/`) is layer-first and should be migrated to domain-first.

## TD-009: PostgreSQL with Prisma

- **Status:** Superseded by TD-024
- **Context:** Relational data (users, challenges, test cases, submissions) with strong integrity requirements.
- **Decision:** PostgreSQL as the database, Prisma as ORM and migration tool.
- **Alternatives considered:** MongoDB (schema flexibility not needed); Drizzle / TypeORM / Knex (Prisma chosen for schema-first DX and generated types).
- **Consequences:** Prisma client must be regenerated on schema changes; migrations workflow in Docker to be defined (TD-015).

## TD-010: Piston for sandboxed code execution

- **Status:** Accepted
- **Context:** The platform must run untrusted user code in many languages, safely, and compare output against stored test cases.
- **Decision:** Self-hosted Piston as the execution engine, called from the API.
- **Alternatives considered:**
  - Running code in the API process/container: unacceptable security risk.
  - Hosted APIs (Judge0 cloud, Sphere Engine): recurring cost and external dependency.
  - Building a custom Docker-per-run sandbox: high effort to get isolation right.
- **Consequences:** Additional service to operate; execution limits, queueing and network isolation must be configured (TD-016).

## TD-011: MinIO for image storage

- **Status:** Accepted
- **Context:** Images should not live in the database or inside application containers.
- **Decision:** Self-hosted MinIO, an S3-compatible object store.
- **Alternatives considered:** Local filesystem volume (not portable, no access control); AWS S3 directly (cost, cloud dependency for local dev).
- **Consequences:** One more container; S3 compatibility means swapping to a cloud provider later is a configuration change.

## TD-012: Seed the database during the initial Docker build

- **Status:** Accepted
- **Context:** A fresh environment must have challenges and test cases available immediately.
- **Decision:** A seed script runs as part of the initial Docker build/startup.
- **Alternatives considered:** Manual seeding via CLI; admin UI for content entry (later).
- **Consequences:** Seed data must be idempotent so re-running is safe.

## TD-013: Docker Compose for local orchestration

- **Status:** Accepted
- **Context:** Six services must start together with consistent configuration.
- **Decision:** Docker Compose with a shared bridge network; config via `.env` / `.env.local`.
- **Alternatives considered:** Running services natively (inconsistent environments); Kubernetes (overkill for local dev).
- **Consequences:** Production deployment target still open (TD-019).

## TD-014: Frontend routing and server-state fetching

- **Status:** Accepted
- **Context:** Need a router and a strategy for fetching/caching API data. Options: React Router vs. TanStack Router; Redux thunks vs. RTK Query vs. TanStack Query.
- **Decision:** React Router for routing and RTK Query for server-state fetching.
- **Alternatives considered:** TanStack Router (more powerful but more complex); Redux thunks (manual caching and more boilerplate); TanStack Query (similar to RTK Query but not as tightly integrated with Redux).
- **Consequences:** Simplified server-state management, in line with the current knowledge and existing Redux setup.

---

## Open Decisions

## TD-014: Frontend routing and server-state fetching

- **Status:** Open
- **Context:** Need a router and a strategy for fetching/caching API data. Options: React Router vs. TanStack Router; Redux thunks vs. RTK Query vs. TanStack Query.

## TD-015: Database migrations in Docker and production

- **Status:** Open
- **Context:** In development, migrations are applied on demand with `npm run db:migrate` at the repo root, which runs `drizzle-kit migrate` in a throwaway `api` container. Still to decide: how migrations run on deploy (entrypoint script, init container, or CI step), and whether the API should refuse to start against an unmigrated database.

## TD-016: Code-execution limits and isolation

- **Status:** Open
- **Context:** Per-run CPU/time/memory limits, concurrency/queueing, and ensuring Piston has no outbound network access.

## TD-017: Authentication and authorisation

- **Status:** Proposed
- **Context:** Dependencies present (`jsonwebtoken`, `bcryptjs`) suggest JWT with bcrypt password hashing. To confirm: token storage (httpOnly cookie vs. header), refresh strategy, roles/permissions.

## TD-018: API conventions

- **Status:** Proposed
- **Context:** REST style, versioning, request validation with Zod (already a dependency), and a standard error-response shape.

## TD-019: CI/CD and deployment target

- **Status:** Open
- **Context:** Where containers are built and deployed beyond local development.

## TD-020: Testing strategy

- **Status:** Proposed
- **Context:** Jest is present in the API. To decide: coverage expectations, integration tests against a real Postgres, frontend testing (React Testing Library, Playwright).

## TD-021: File upload handling

- **Status:** Open
- **Context:** Accepted types and size limits; API proxying uploads (`multer` present) vs. pre-signed MinIO URLs.

## TD-022: Email

- **Status:** Open
- **Context:** `nodemailer` is present. Provider (SMTP, SES, Resend…) and use cases (verification, password reset).

## TD-023: Logging, monitoring and error tracking

- **Status:** Open

## TD-024: Drizzle ORM instead of Prisma

- **Status:** Accepted
- **Context:** TD-009 chose Prisma. The Prisma 8 setup proved fiddly to pin: the `prisma` CLI, `@prisma/cli-engine` and `@prisma/orm-postgres` are versioned independently and only specific combinations work together, and Prisma 8 is still a release candidate. We want to evaluate Drizzle instead.
- **Decision:** Remove Prisma from the repository. Use Drizzle ORM, with `drizzle-kit` for migrations, over the `pg` driver already present in the API.
- **Alternatives considered:** Staying on the Prisma 8 RC (version-pairing churn on every bump); Prisma 7 (stable, but we would rather evaluate Drizzle now); hand-written SQL over `pg` (loses type-safe query building).
- **Consequences:** The schema is authored in TypeScript (`api/db/schema.ts`) and `drizzle-kit` generates SQL migration files under `api/db/migrations/` that we review and commit; there is no client-generation step. PostgreSQL itself is unchanged. All `drizzle-kit` commands run inside the `api` container, driven by `db:*` scripts at the repo root.
