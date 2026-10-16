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

## TD-019: CI/CD and deployment target

- **Status:** Accepted
- **Context:** Where containers are built and deployed beyond local development.
- **Decision:** GitHub Actions runs two parallel jobs, `api` and `web`, on every pull request into `main` (a protected branch) and on every push to `main`. `api` runs typecheck, lint and tests with coverage; `web` runs the build (which typechecks), lint and tests with coverage. npm downloads are cached per lockfile. The push trigger exists so the merged result is checked once more and the README status badges reflect `main`.
- **Alternatives considered:** Running on every push to every branch (noisy, and burns CI minutes on work in progress); no CI, relying on local checks (easy to skip). Git hooks (TD-026) run as well, but as a fast local convenience, not a replacement: CI stays the authoritative gate.
- **Consequences:** Only code that compiles, passes lint and passes tests reaches `main`. Feedback arrives when a PR is opened, not on each commit to a working branch. The deployment target is still open.

## TD-023: Logging, monitoring and error tracking

- **Status:** Accepted (logging); monitoring and error tracking deferred to Phase 6
- **Context:** The API runs in Docker and has no real users, so nobody reports problems: the logs are how failures are found. Every request and every error needs a log line that can be traced back to its request. Errors often arrive wrapped (Drizzle puts the real `pg` error on `.cause`, TD-024), so the log has to show the whole cause chain. Requests carry tokens and cookies that must never be written to a log file.
- **Decision:** `pino` for application logs and `pino-http` for request logs, configured once in `api/config/logger.config.ts`.
  - **Request logs:** `pino-http` logs every request, at a level picked from the response by `customLogLevel`: `error` for 5xx or a thrown error, `warn` for 4xx, `info` otherwise.
  - **Error logs:** the error middleware logs through `req.log`, so each error line carries its request's context; 5xx at `error`, 4xx at `warn`. The `errWithCause` serializer writes the full `cause` chain, which is where the original `pg` error and driver message end up (TD-027).
  - **Redaction:** `req.headers.authorization` and `req.headers.cookie` are replaced before a line is written.
  - **Destinations:** in development, `pino-pretty` to the console; in every non-test environment, rotating files through `pino-roll` under `logs/info/` (info and above) and `logs/error/` (errors only), rotated daily and kept for 7 days. In tests the logger is `silent`.
  - **Level:** `debug` in every non-test environment.
  - **Rule:** no `console.log` in application code; everything goes through `logger` or `req.log`.
- **Alternatives considered:** `console.log` (no levels, no structure, no redaction); `winston` (popular, but slower and more configuration for the same result); `morgan` (request logs only, so a second library would still be needed for application logs).
- **Consequences:**
  - Logs are JSON lines, so they can be searched and shipped to a log tool later; `pino-pretty` exists only for reading them in development.
  - **Outside development nothing goes to stdout**, so `docker logs api` is empty and the files live inside the container, lost when it is replaced unless `logs/` is a volume. Containers usually log to stdout and let the platform collect the logs. Kept as is for now; revisit when choosing a deployment target (TD-019, Phase 7).
  - `debug` in production is noisy; revisit together with the destination.
  - Only headers are redacted. Once authentication exists (TD-017), passwords and tokens in request bodies need redacting too.
  - Error responses do not yet carry a request id, so a client report cannot be matched to a log line (Phase 6).
  - Monitoring (metrics) and error tracking (grouping, alerting) are not covered by logs; both are Phase 6.

## TD-024: Drizzle ORM instead of Prisma

- **Status:** Accepted
- **Context:** TD-009 chose Prisma. The Prisma 8 setup proved fiddly to pin: the `prisma` CLI, `@prisma/cli-engine` and `@prisma/orm-postgres` are versioned independently and only specific combinations work together, and Prisma 8 is still a release candidate. We want to evaluate Drizzle instead.
- **Decision:** Remove Prisma from the repository. Use Drizzle ORM, with `drizzle-kit` for migrations, over the `pg` driver already present in the API.
- **Alternatives considered:** Staying on the Prisma 8 RC (version-pairing churn on every bump); Prisma 7 (stable, but we would rather evaluate Drizzle now); hand-written SQL over `pg` (loses type-safe query building).
- **Consequences:** The schema is authored in TypeScript (`api/db/schema.ts`) and `drizzle-kit` generates SQL migration files under `api/db/migrations/` that we review and commit; there is no client-generation step. PostgreSQL itself is unchanged. All `drizzle-kit` commands run inside the `api` container, driven by `db:*` scripts at the repo root.

## TD-025: Cross-cutting concerns get their own folder

- **Status:** Accepted
- **Context:** Error handling had spread over five layer-named locations (`shared/`, `types/`, `helpers/contants.ts`, and two files in `middleware/`). Following one error from `throw` to response meant opening all of them, and `helpers/contants.ts` mixed error mappings with route constants. Authentication (TD-017) will raise the same question.
- **Decision:** A cross-cutting concern with more than one file gets its own folder named after the concern, laid out like a domain (TD-008): `api/error/` holds `AppError`, the error catalogue, the types, the normalisation and the Express middleware, with tests next to each file. Domains import from it; it never imports from a domain. `shared/`, `helpers/` and `types/` remain for small utilities that belong to no single concern.
- **Alternatives considered:** Keeping layer folders (`middleware/`, `types/`, `helpers/`) for shared code: familiar, but it scatters one concern across folders and contradicts TD-008. A single `error.middleware.ts`: fewer files, but it mixes pure mapping logic with Express wiring and grows with every new error source.
- **Consequences:** Error handling is found in one place and its internals can change without touching callers, which import only `AppError` and the two handlers. The top-level `middleware/` folder is gone; future middleware lives with its concern (for example `auth/auth.middleware.ts`).

## TD-026: Pre-commit hooks with Husky and lint-staged

- **Status:** Accepted
- **Context:** CI (TD-019) only reports lint and formatting problems after a push. A local pre-commit hook catches them earlier. The repo holds two separate npm projects (`api/`, `web/`) with different ESLint versions and their own configs, while git hooks belong to the whole repository.
- **Decision:** Husky and lint-staged are installed as dev dependencies of the root `package.json`, its first dependencies. Husky's `prepare` script sets `core.hooksPath` on `npm install`, and `.husky/pre-commit` runs `npx lint-staged`. Each package has its own `.lintstagedrc.json`, `.prettierrc.json` and `.prettierignore`; lint-staged uses the config closest to each staged file and runs its commands from that folder, so ESLint and Prettier find their package's config. The hook runs `eslint --fix` and `prettier --write` on staged files only.
- **Alternatives considered:** A hand-written hook in `.githooks/` via `git config core.hooksPath` (each clone must run the config command by hand, and partly staged files are hard to handle safely); running tests or the typecheck in the hook (too slow, and CI runs them anyway); a single root lint-staged config (ESLint and Prettier would run from the root and miss the package configs).
- **Consequences:** Lint errors block a commit and formatting is fixed before it lands. The hook can be skipped with `--no-verify`, so CI stays the authoritative gate. A one-off formatting commit aligned the existing code with the Prettier configs.

## TD-027: Error response contract

- **Status:** Accepted
- **Context:** Clients need one predictable error shape across the whole API, whether the error is thrown on purpose, comes from Zod, from Postgres, from body parsing, or from a bug. Errors from the database and from libraries carry internal details (table names, row values, driver messages) that must not reach a client. Error handling lives in `api/error/` (TD-025).
- **Decision:** Every error response is produced by `toResponseBody()` and has this shape:

  ```ts
  {
  	code: ErrorCode;       // stable machine-readable code, e.g. "CONFLICT"
  	statusCode: number;    // the HTTP status, repeated in the body
  	response: string;      // fixed client-facing text for the code, from ERRORS
  	message: string;       // what went wrong in this case, set by the thrower
  	details?: unknown;     // structured extras, only for 4xx
  	timestamp: Date;       // serialised as an ISO string
  }
  ```

  - **Codes:** `VALIDATION_ERROR` (400), `NOT_FOUND` (404), `CONFLICT` (409), `CONTENT_TOO_LARGE` (413), `INTERNAL_ERROR` (500), defined once in `error.constants.ts`. Clients branch on `code`, never on the text fields.
  - **Throwing:** application code throws `new AppError(code, { message, details?, cause? })`. Controllers do not catch errors; Express 5 forwards rejected handlers to `errorHandler`.
  - **Normalising:** `normalizeError()` turns anything thrown into an `AppError`, in this order: an `AppError` passes through; a `ZodError` becomes `VALIDATION_ERROR` with `details` listing each issue's `path` and `message`; a `pg` `DatabaseError`, bare or wrapped on `.cause`, is mapped by its SQLSTATE code (`23505` to `CONFLICT`, `23503` and `23502` to `VALIDATION_ERROR`, anything else to `INTERNAL_ERROR`); an error carrying a 4xx `status` or `statusCode` (body-parser) is mapped through `HTTP_STATUS_TO_CODE`; everything else becomes `INTERNAL_ERROR`.
  - **What never reaches the client:** stack traces, `cause`, and driver messages. Database errors get a static `message`; mapped 4xx database errors expose only `constraint` and `column` in `details`; `INTERNAL_ERROR` never has details. The original error stays on `cause` and is logged (TD-023).
  - **Unknown routes** return `NOT_FOUND` with the same shape, through `unknownRouteHandler`.
  - If headers were already sent, the error goes to Express's default handler instead.
- **Alternatives considered:** RFC 9457 Problem Details (`type`, `title`, `status`, `detail`, `instance`, served as `application/problem+json`): a standard that tools understand, but it needs a URI per error type, and a custom shape was simpler to learn with. A bare `{ error: string }`: nothing stable for clients to branch on. A `try/catch` in every controller: repeated code and shapes that drift apart.
- **Consequences:**
  - Adding an error type means one entry in `ERRORS` and nothing else.
  - `message` is sent to the client, so whoever throws an `AppError` must keep it free of internal details.
  - `statusCode` in the body duplicates the HTTP status; it is kept so the body stands on its own, for example when it is logged or stored.
  - The shape is part of the public API: removing or renaming a field is a breaking change, and moving to RFC 9457 later would need API versioning (TD-018).
  - There is no request id in the body yet, so a client cannot quote one when reporting a problem (Phase 6, TD-023).

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
- **Context:** REST style, versioning, pagination and filtering, and request validation with Zod (already a dependency). The error-response shape is decided in TD-027.

## TD-020: Testing strategy

- **Status:** Proposed
- **Context:** Jest is present in the API. To decide: coverage expectations, integration tests against a real Postgres, frontend testing (React Testing Library, Playwright).

## TD-021: File upload handling

- **Status:** Open
- **Context:** Accepted types and size limits; API proxying uploads (`multer` present) vs. pre-signed MinIO URLs.

## TD-022: Email

- **Status:** Open
- **Context:** `nodemailer` is present. Provider (SMTP, SES, Resend…) and use cases (verification, password reset).
