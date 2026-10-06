# Review Guidelines

Instructions for an AI reviewer (Claude, GPT, or any other model) checking **uncommitted changes** in this repository before they are committed, and then writing tests for them.

**How to invoke:** _"Before I commit this code, review it using `docs/Review Guidelines.md`."_

Read this whole file before starting. Follow the phases in order. Where this file and the code disagree with [Architecture](./Architecture.md) or [Technical Decisions](./Technical%20Decisions.md), those documents describe the intended design. Flag the drift; do not silently pick a side.

---

## Ground rules

1. **Verify, don't assume.** Run the commands below before claiming anything works or is broken. Label each finding **confirmed** (you ran or reproduced it) or **suspected** (reasoned from reading only).
2. **Review the whole change, not just the diff.** Read the files the diff touches and the code that calls them. A bug often sits in the caller.
3. **Be specific.** Every finding needs `file:line`, what is wrong, the concrete consequence, and the fix.
4. **Don't pad.** If a category has no findings, say "none". Praise only what is genuinely good and useful to keep doing.
5. **Respect deferrals.** Do not raise items listed under [Known deferrals](#known-deferrals) unless the change makes them worse.
6. **Never stage, commit, push, or write to the development database.** The author commits.
7. **Don't change production code.** Report problems; do not fix them unless the author asks. During the testing phase, only test files may be created or edited.

---

## Phase 1: Establish scope

```bash
git status --short
git diff --cached          # staged
git diff                   # unstaged
git ls-files --others --exclude-standard   # untracked (new files)
```

Review **staged, unstaged and untracked** changes together. State at the top of the report which files were reviewed. Skip generated files (`package-lock.json`, `db/migrations/meta/*`) except to check they changed together with their source.

---

## Phase 2: Verify it works

Run from the repo root and record each result in the report:

| Check                     | Command                                |
| ------------------------- | -------------------------------------- |
| API typecheck             | `npx --prefix api tsc --noEmit -p api` |
| Web typecheck + build     | `npm --prefix web run build`           |
| Web lint                  | `npm --prefix web run lint`            |
| All tests                 | `npm test`                             |
| Coverage (with threshold) | `npm run test:coverage`                |

If a change adds or modifies an HTTP endpoint and the stack is running (`docker compose ps`), exercise it with `curl`, including at least one invalid request. Use only read-only requests or data you create and delete yourself. Don't run migrations or seeds against the dev database.

Any failing command is a 🔴 Blocker unless it also fails on the last commit (`git stash` is **not** allowed; compare with `git show HEAD:<file>` instead, and note it as pre-existing).

---

## Phase 3: Review against the checklist

### A. Does the code work?

- **Every path is handled:** happy path, invalid input, not found, conflict, empty result, boundary values.
  - A lookup that finds nothing must return **404**, not crash on `undefined`. The result of `const [row] = await db.select()…` may be `undefined`.
  - A unique-constraint violation (Postgres code `23505`) must return **409**, not 500.
- **Async correctness:** every promise is awaited or deliberately handled. No floating promises.
- **One response per request:** every `res.status(...).json(...)` inside a branch is followed by `return`. No code runs after a response is sent.
- **Types tell the truth:**
  - No `any`, no unchecked `!`, no `as` casts used to silence the compiler.
  - Avoid `Partial<T>` for things that are actually fully defined.
  - Types come from the source (`z.infer`, Drizzle `$inferSelect`/`$inferInsert`) rather than being written out by hand.
- **Runs outside `tsc`:** the API is executed with Node type-stripping (`db:seed`) and ts-node, so type-only imports **must** use `import type` or `{ type X }`. Relative imports keep their `.ts` extension in `api/`.
- **Schema changes are complete:**
  - `db/schema.ts`, the generated `.sql`, the snapshot and `_journal.json` change together.
  - A new `NOT NULL` column on an existing table has a default or a backfill.
  - `db/seed.ts` still matches the schema and is still safe to re-run (TD-012).
- **Config changes are complete:**
  - A new env var is added to the Zod schema in `api/config/env.config.ts` **and** to every `.env.example`.
  - Code reads config from the exported `env`, never from `process.env` (the only exception is `config/drizzle.config.ts`).

### B. Is the architecture set up for growth?

The API follows **domain-first DDD** (TD-008). Check that new code fits it:

- **Folder per domain** (`api/<domain>/`), with files named `<domain>.<layer>.ts`.
- **Layers and their responsibilities:**

  | Layer      | File              | Does                                            | Must not                                                                   |
  | ---------- | ----------------- | ----------------------------------------------- | -------------------------------------------------------------------------- |
  | Route      | `*.route.ts`      | Map method + path to controller                 | Contain logic                                                              |
  | Validation | `*.validation.ts` | Zod schemas for body, params **and** query      | Touch the DB                                                               |
  | Controller | `*.controller.ts` | Translate HTTP ↔ service call; pick status code | Import `db`; contain business rules                                        |
  | Service    | `*.service.ts`    | Business rules; throw domain errors             | Touch `req`/`res`; return raw DB rows to callers that send them to clients |
  | Repository | `*.repository.ts` | All Drizzle queries for the domain              | Contain business rules                                                     |

  A service that calls `db` directly is 🟠 Important drift: move the queries into a repository before more code depends on them.

- **Dependencies point inward:** domains don't import each other's internals. Anything shared lives in `shared/`, `helpers/`, `middleware/` or `types/`.
- **Errors are centralised:**
  - Services throw typed errors (e.g. `NotFoundError`, `ConflictError`, `ValidationError`), and `middleware/error.middleware.ts` maps them to status codes.
  - Repeating `try/catch` + `res.status(500)` in every controller is drift. So is signalling errors with ad-hoc strings such as `{ cause: "invalid-id" }`.
  - Express 5 forwards rejected async handlers to the error middleware on its own.
- **API conventions (TD-018):**
  - REST nouns: `POST /users`, `GET /users/:id`, `DELETE /users/:id`. Avoid verbs in paths such as `/create-user`.
  - Resource ids go in **path params**, not query strings.
  - Status codes: `201` create, `200` read/update, `204` delete with no body, `400` invalid input, `404` missing, `409` conflict, `500` unexpected.
  - One error shape across the API.
  - Every route is under the `/api/v1` prefix.
- **Responses are DTOs:** an explicit allowlist of fields, typed precisely. Never return a DB row directly, and never return `password` or any other secret, **including from create/update endpoints**.
- **Single source of truth:** route paths, config, error messages and types are defined once and imported, not copied.
- **Frontend (when `web/` changes):**
  - CSS Modules with BEM naming (TD-004).
  - Redux Toolkit slices for global state, and RTK Query for server state (TD-005, TD-014).
  - React Router for routing.
  - Components stay thin, with logic in custom hooks.
  - Monaco is lazy-loaded (TD-006).
- **Not over-engineered either:** flag abstractions with a single trivial use, or config for cases that don't exist yet.
- If the change needs a decision that isn't recorded, recommend adding a TD record.

### C. Does it follow best practices?

- **Security:**
  - All external input (body, params, query, headers) is validated with Zod at the boundary.
  - Unknown keys are stripped, so clients can't set `isAdmin`, `isVerified`, `score` or `id`.
  - No secrets, real passwords, or real personal data (emails, names) in code, seeds, tests or fixtures. Use `@example.com`.
  - No stack traces or internal error messages in responses.
  - Queries only go through the Drizzle query builder, or the `sql` template with bound parameters. Never build SQL by concatenating strings.
  - New `/admin` routes are reachable without auth until TD-017 lands. Mention this once per review, not per route.
- **Unbounded queries:** list endpoints need pagination or a hard limit before the table can grow.
- **Clean code:**
  - No debug `console.log`. Logging goes through one place (the error middleware for now; TD-023).
  - No commented-out code, no empty or placeholder files, no typos in names.
  - Functions do one thing. Comments explain _why_, not _what_.
- **Consistency:**
  - Matches the surrounding code: Prettier with **tabs**, existing import style, existing naming.
  - The same thing is done the same way everywhere. Two styles for one pattern is a finding.
- **Dependencies:**
  - Every new package is justified and placed correctly (`dependencies` vs `devDependencies`).
  - The lockfile changed with it.
  - Remember that Docker images need a rebuild (see WHIL, 21.9.2026).
- **Commit hygiene:**
  - The change is one logical unit, with no unrelated edits mixed in.
  - Nothing that should be ignored is included (`.env`, `coverage/`, `dist/`).
  - The suggested commit message follows the repo style: `[feature|fix|config|refactor|test|docs] summary`.

### D. Tests in the change

- New or changed behaviour has tests, and a bug fix comes with a test that would have caught it.
- Existing tests that the change makes wrong are updated, not deleted.

### E. Anything else

- **Docs:** update `docs/Architecture.md`, `docs/Technical Decisions.md` or `.env.example` if behaviour or setup changed.
- **Performance:** look for N+1 queries, work repeated inside loops, and large payloads.
- **Developer experience:** check that root scripts still work and that error messages tell the developer what to do.

---

## Phase 4: Report

Use this exact structure:

```markdown
## Review: <one-line summary of the change>

**Verdict:** ✅ Ready to commit | ⚠️ Ready after fixes | ❌ Not ready
**Reviewed:** <files, staged/unstaged/untracked>

### Verification

| Check         | Result                  |
| ------------- | ----------------------- |
| API typecheck | ✅ / ❌ (error summary) |
| ...           | ...                     |

### 🔴 Blockers: must fix before committing

1. **<title>** ([file.ts:42](path/file.ts#L42)), confirmed/suspected
   <what is wrong> → <consequence> → <fix, with a short code snippet if it helps>

### 🟠 Important: fix now or in the very next commit

### 🟡 Minor: style, naming, small cleanups

### 💡 Suggestions: optional improvements

### ✅ What's good

### Suggested commit message
```

Severity definitions:

- 🔴 **Blocker:**
  - A failing build, typecheck or test.
  - A crash or wrong result on a realistic input.
  - Data loss.
  - A security hole.
  - Secrets or real personal data in the change.
- 🟠 **Important:** will cause a bug soon, breaks the architecture rules above, or will be expensive to undo once more code depends on it.
- 🟡 **Minor:** naming, formatting, small inconsistencies.
- 💡 **Suggestion:** a judgement call. The author may reasonably decline.

---

## Phase 5: Gate

- **Any 🔴 Blocker → stop here.** Do not write tests. Hand the report back.
- **No blockers → continue to Phase 6.** Mention any 🟠 items again in the final summary.

---

## Phase 6: Write tests

### Stack and conventions

- **Vitest** in both packages. Import `describe/it/expect/vi` explicitly; globals are off.
  - **API:** `supertest` for HTTP tests.
  - **Web:** `@testing-library/react`, `jsdom` and `@testing-library/jest-dom` (set up in `web/src/test/setup.ts`).
- Test files sit next to the code: `admin.service.ts` → `admin.service.test.ts`.
- Prettier with tabs: `npx prettier --write --use-tabs <files>`.

### What to test, by layer

| Layer                                  | Approach                                                                                                                                                                                                                                                                                                                               |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Validation                             | Every field: `min-1`, `min`, `max`, `max+1`; missing; wrong type; exact error messages; unknown keys stripped; trimming. Use `it.each` tables.                                                                                                                                                                                         |
| Service                                | Business rules and the errors it throws. Mock the **repository** (or `db` module until repositories exist) with `vi.mock`; assert on results and thrown errors, not on how many times a query helper was called.                                                                                                                       |
| HTTP (route + controller + middleware) | Through the real Express app: `new ExpressServer(env).getApp()` + `supertest`. Mock only the service/repository layer. Assert status code, response body shape, error shape, and that secrets (`password`) are **absent**. Use **literal paths** (`"/api/v1/admin/users/1"`), not the route constants: the URL is the public contract. |
| Middleware                             | A throwaway Express app with routes that fail in controlled ways (see `middleware/error.middleware.test.ts`).                                                                                                                                                                                                                          |
| Config                                 | `vi.stubEnv` + `vi.resetModules()` + dynamic import (see `config/env.config.test.ts`).                                                                                                                                                                                                                                                 |
| React components                       | Render, then query by role, label or text the way a user would; interact with `@testing-library/user-event` (install it if needed). No snapshot tests and no testing of internal state.                                                                                                                                                |

Never connect to the development database from tests. Integration tests against a real Postgres are a future decision (TD-020).

### How to write them

- **One behaviour per test**, named as a sentence: `it("responds 404 when the user does not exist")`.
- **Arrange / Act / Assert**, separated by blank lines.
- **Factories for fixtures:** `const validUser = (overrides = {}) => ({ ...defaults, ...overrides })`. No shared mutable fixtures.
- **Mock at the boundaries only:** DB, network, time, env. Never mock the unit under test, and prefer real Zod schemas over mocked validation.
- **Deterministic:**
  - No real clocks or randomness (`vi.useFakeTimers()`).
  - Free ports for servers (see `config/express.config.test.ts`).
  - No ordering dependencies between tests. `restoreMocks` and `unstubEnvs` are on globally.
- **Don't lock in bugs.** If the review flagged behaviour as wrong, don't assert the wrong behaviour. Add `it.todo("<intended behaviour>")` and mention it in the summary.

### Prove the tests are meaningful

Coverage alone doesn't show that tests catch bugs. For each important behaviour you tested, **temporarily break the production code** (e.g. delete a `return`, flip a status code, drop a validation rule, remove a field from the DTO allowlist). Run the tests, confirm at least one fails, then **restore the file exactly** (`git diff` must show no production changes afterwards). Report the list of mutations and whether each one was caught. If a mutation survives, strengthen the tests.

### Finish

1. `npm test` and `npm run test:coverage` pass. Thresholds: API 90%, web 80%. Coverage is a floor; don't write tests just to touch lines.
2. `npx --prefix api tsc --noEmit -p api` passes, since test files are typechecked too.
3. `git diff` shows **only** new or changed test files.
4. Final summary:
   - the tests added, grouped by file, with a one-line description each;
   - mutation results;
   - coverage numbers;
   - any `it.todo` items, plus the 🟠 items still open from the review.

---

## Known deferrals

These are deliberately postponed. Do not report them unless the change makes them worse.

- **Password hashing** (bcrypt) and **authentication/authorisation** are planned under TD-017. Plaintext storage of passwords is expected for now. _Returning_ a password in an API response is still a finding.
- **Integration tests against a real Postgres:** TD-020.
- **Logging/monitoring stack:** TD-023. Until then, `console.error` in the error middleware is the accepted logger.

Update this list as decisions are made.

---

## Repo quick reference

- **Structure:** `api/` (Express 5, Drizzle, Zod 4, ESM with `.ts` imports), `web/` (React 19, Vite) and `docs/`.
- **Root scripts:**
  - `npm test`, `npm run test:api`, `npm run test:web`, `npm run test:coverage`
  - `npm run db:*` (runs inside Docker)
- **Database:** Postgres in Docker, published to the host on `localhost:5433`.
- **Error handling:** `api/middleware/error.middleware.ts`, registered last in `api/config/express.config.ts`.
- **Test helpers to reuse:** the `ExpressServer#getApp()` + supertest pattern in `admin/admin.route.test.ts`, which also captures errors raised after a response was sent (`pipelineErrors`).
