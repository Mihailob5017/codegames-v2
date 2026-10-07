# Learning Roadmap

This project exists to learn backend engineering in depth. It will have few or no real users, so the usual "wait until you need it" rule doesn't apply: enterprise patterns are built **on purpose**, because building them is the point.

Tick items off as they're done, and write a [WHIL](WHIL.md) entry for each lesson.

---

## Principles

1. **Build it by hand first, then use the library.** Write your own rate limiter or retry loop before reaching for a package, so you know what the package does for you.
2. **Break it on purpose.** Stop the database mid-request, make a dependency slow, fill a queue. Then check whether the app degrades gracefully or falls over.
3. **Simulate the users you don't have.** Load tests with [k6](https://k6.io/) make performance work measurable: generate load, find the bottleneck, fix it, measure again.
4. **Write a WHIL entry for every lesson.**
5. **Record a TD for every decision** in [Technical Decisions](Technical%20Decisions.md). Explaining *why* is half of senior backend work.

---

## Where the app's features meet backend topics

| Feature | Backend topic it teaches |
| --- | --- |
| Running user code (Piston) | job queues and workers, timeouts, sandboxing, circuit breakers |
| Scores and leaderboards | Redis sorted sets, caching and cache invalidation |
| Email (nodemailer) | background jobs, retries, idempotency (never send an email twice) |
| Images (MinIO) | object storage, presigned upload URLs |
| Live submission results | WebSockets or server-sent events |
| Users and admins | authentication, roles and permissions, security |

---

## Phase 1: Foundations

- [x] Centralised error middleware: `normalizeError` → `AppError` → response
- [x] Structured logging with pino and pino-http
- [ ] Finish the error middleware: the Zod case `return`, Postgres `23505` → 409, body-parser errors
- [ ] Error handler logs through `req.log`; `listen()` uses the logger
- [ ] Test suite passing again
- [ ] CI with GitHub Actions: typecheck, lint and tests on every push (TD-019)
- [ ] Integration tests against a real Postgres (Testcontainers), not only mocks (TD-020)
- [ ] Record the logging decision (TD-023) and the error contract (TD-018)

## Phase 2: Security

- [ ] Helmet: learn what each header prevents
- [ ] CORS limited to the frontend's origin
- [ ] Request body size limit (`express.json({ limit })`)
- [ ] `trust proxy`, so client IPs are correct behind a proxy
- [ ] Authentication: access and refresh tokens, token rotation, logout and revocation, password hashing (TD-017)
- [ ] Authorisation with roles; protect `/admin`
- [ ] Rate limiting: a hand-written token bucket first, then `express-rate-limit` with a Redis store
- [ ] Check the app against the [OWASP Top 10](https://owasp.org/www-project-top-ten/)

## Phase 3: Data

- [ ] Schema design: users, roles, games, submissions
- [ ] Migration workflow for Docker and production (TD-015)
- [ ] Constraints: unique, foreign keys, checks
- [ ] Indexes, measured with `EXPLAIN ANALYZE` and k6
- [ ] Transactions and isolation levels: reproduce a race condition on score updates, then fix it
- [ ] Find and fix an N+1 query
- [ ] Pagination: offset vs cursor
- [ ] Soft deletes

## Phase 4: Asynchronous work and scale

- [ ] Redis: cache-aside caching and invalidation
- [ ] Leaderboard with Redis sorted sets
- [ ] Job queue (BullMQ): submission → queue → worker runs Piston → result
- [ ] Email sending as a background job with retries
- [ ] Real-time submission results over WebSockets or SSE

## Phase 5: Reliability

- [ ] Liveness and readiness checks (readiness runs `SELECT 1` against the database)
- [ ] Graceful shutdown that closes the server, the database pool and the queue
- [ ] Timeouts on every outgoing call
- [ ] Retries with exponential backoff
- [ ] Idempotency keys for unsafe requests
- [ ] Circuit breaker around Piston
- [ ] Code-execution limits: CPU, memory, run time, no network (TD-016)

## Phase 6: Observability

- [x] Structured logs
- [ ] Request id in error responses and the `X-Request-Id` header
- [ ] Metrics: Prometheus + Grafana
- [ ] Tracing: OpenTelemetry + Jaeger, following one request through API, queue, worker and database
- [ ] Run the whole observability stack in Docker Compose

## Phase 7: API and delivery

- [ ] OpenAPI documentation generated from the Zod schemas
- [ ] API conventions: pagination, filtering, versioning (TD-018)
- [ ] Multi-stage Docker builds
- [ ] Secrets handling
- [ ] Optional: deployment to a VPS

---

## Hard to change later vs. easy to add later

Even in a learning project, some things are much cheaper to get right early.

- **Hard to change later:** the authentication model, the database schema and migrations, the error contract, request ids, logging, API versioning.
- **Easy to add later:** a Redis-backed rate limiter, caching, metrics and tracing, queues, splitting into multiple services.
