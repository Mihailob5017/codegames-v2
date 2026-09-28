# WHIL — What Have I Learned

A log tracking my progress while developing the application, documenting challenges, solutions, and new knowledge acquired along the way.

---

### 21.9.2026

#### Changing packages requires a rebuild, not just a restart

When you add, remove, or change a package, restarting the container is **not** enough. Two separate things go stale:

1. **The image** — `npm install` runs at build time, so the image's `node_modules` is frozen at whatever `package.json` said when it was built. Compose only rebuilds when you pass `--build`.
2. **The anonymous volume** — `- /api/node_modules` in `docker-compose.yml` creates a volume that is populated once and then **persists across container recreation**. It masks both the image's `node_modules` and the host's, so even a fresh build stays invisible behind it.

Clearing both:

```bash
docker compose down -v && docker compose up --build
```

`down -v` removes the volumes, `--build` rebuilds the images. Safe here because this project declares no named volumes, so there is no database state to lose.

**Nuance worth remembering:** this only applies when installing on the _host_. Running `npm install` _inside_ the container writes straight into the anonymous volume, so it takes effect immediately with no rebuild. Because `./api` is bind-mounted, the updated `package.json` and `package-lock.json` land back on the host too:

```bash
docker compose exec api npm install <pkg>
```

#### `esModuleInterop` — and where it has to live

`esModuleInterop` enables compatibility between CommonJS and ES modules, letting you use `import express from "express"` for packages that are exported with `module.exports`. Without it:

```
TS1259: Module '"@types/express/index"' can only be default-imported using the 'esModuleInterop' flag
```

The real lesson was **where it goes**. It is a compiler option and must sit inside `compilerOptions`. At the top level of `tsconfig.json` it is an unrecognized key and is silently ignored:

```jsonc
{
  "esModuleInterop": true          // ✗ ignored — TS6258
}
{
  "compilerOptions": {
    "esModuleInterop": true        // ✓
  }
}
```

TypeScript will tell you this directly if you ask: `npx tsc --showConfig`.

#### Env file precedence — it's the file order, not the line order

~~The order of variables inside the `.env` file matters.~~ That was wrong. What matters is the order of **files** in the `env_file:` list. Later files override earlier ones:

```yaml
env_file:
  - .env # defaults (committed)
  - .env.local # personal overrides (gitignored) — wins
```

I originally had these reversed, so the committed `.env` was overriding my gitignored `.env.local` — defeating the whole point of having a `.local` file.

#### The two env mechanisms that both read `.env`

This was the big one. Compose uses env files in **two unrelated ways**:

| mechanism              | what it sets                                   | reads `.env` | reads `.env.local` |
| ---------------------- | ---------------------------------------------- | ------------ | ------------------ |
| `env_file:`            | variables inside the **container**             | yes          | yes                |
| `${VAR}` interpolation | variables inside **docker-compose.yml itself** | yes          | **no**             |

Interpolation only reads the shell environment and the root `.env`. This is why my port mapping kept using `5000` while the app inside the container ran on `5001` — two different systems reading two different sources.

Fix is to point interpolation at both files explicitly (last one wins, same as `env_file`):

```bash
docker compose --env-file .env --env-file .env.local up
```

Two gotchas:

- Compose **hard-fails** if an `--env-file` is missing (`couldn't find env file: ...`). Since `.env.local` is gitignored, a fresh clone breaks unless something creates it first.
- `COMPOSE_ENV_FILES` does the same job as an environment variable, but it **cannot be set inside `.env`** — Compose has to know which files to read before it can read them. It only works from the real shell.

Rather than typing those flags every time, I wrapped them in a `./dc` script at the project root, and pointed the npm scripts at it.

#### Port mapping is `HOST:CONTAINER`

```yaml
ports:
  - "${PORT:-5000}:${PORT:-5000}"
```

The **left** side is the host (external) port, the **right** side is the container (internal) port. I had this backwards. Proved it with an asymmetric mapping — a container listening on `3000`, published as `"8099:3000"`:

```
curl localhost:8099  ->  HTTP 200        (left = host)
curl localhost:3000  ->  refused         (right = container)
```

`${PORT:-5000}` means "use `PORT`, or `5000` if unset". Using the same variable on both sides keeps the two halves from drifting — if the app listens on a port the mapping doesn't target, the container looks perfectly healthy in `docker ps` while being completely unreachable from the host.

#### `dotenv` does nothing inside Docker

I had `import "dotenv/config"` in `index.ts`. It never worked, for two independent reasons:

1. **Wrong directory.** dotenv resolves `.env` relative to the process working directory. `WORKDIR` is `/api`, but the env files live at the project root, which isn't mounted into the container. Hence the `injected env (0) from .env` in the logs — zero variables.
2. **It wouldn't override anyway.** Compose injects `env_file` values before Node starts, and dotenv does not overwrite variables that are already set unless you pass `override: true`.

Since this app only runs through Docker, Compose's `env_file` already does the job and the package was removed entirely. Also dropped `@types/dotenv`, which was pinned at v6 types for a v18 package — modern dotenv ships its own types.

#### Bind mounts can go stale when a file's inode changes

Hit a confusing one where the container was running code I had already deleted:

```
HOST      index.ts line 1: import ExpressServer from "./config/express.config";
CONTAINER index.ts line 1: import "dotenv/config";
```

Cause: the edit was made with `sed -i`, which despite the name does not write in place — it writes a new file and renames it over the old one, giving it a **new inode**. Docker Desktop's file-share layer tracks the original inode, so the swap went unnoticed. Two symptoms: the container kept serving old contents, and nodemon's watcher never fired.

`docker compose restart api` remounts and resyncs. If nodemon ever stops reacting to edits, this is the signature — and `legacyWatch` (polling) sidesteps it entirely, since polling ignores inodes.

#### Misc

- `nodemon` with no arguments falls back to `"main"` in `package.json` and runs it with plain `node` — it will not run TypeScript, and by default only watches `js,mjs,cjs,json`. Needs a `nodemon.json` with `"exec": "ts-node index.ts"` and `"ext": "ts,json"`.
- `docker compose up` reuses an existing image when the service has an `image:` tag, even if the `Dockerfile` changed. Always `--build` after editing a Dockerfile.
- An `Exited (143)` status is just `SIGTERM` — a normal `Ctrl+C` shutdown, not a crash.
- Inside the Compose network, containers reach each other by **service name**, not `localhost` — `http://api:5001`, since `localhost` in a container refers to that container itself.

### 28.9.2026

#### ADRs are append-only — supersede, don't rewrite

I switched the ORM from Prisma to Drizzle, which meant walking back TD-009, a decision already marked `Accepted`. My first instinct was that changing an accepted decision is just bad practice and I had made a mess of the log.

That is not quite the lesson. The ADR format already has an answer for changing your mind, and my own document states it at the top: _"Decisions are never edited once accepted; if one changes, add a new record and mark the old one `Superseded`."_ The thing you must not do is **edit or delete** the old record, because the value of the log is the reasoning as it stood at the time, not the current answer. Deleting TD-009 would have destroyed the only record of _why_ Prisma looked right, which is exactly what stops me re-litigating the same choice in six months.

So the resolution was mechanical rather than shameful:

- TD-009 keeps every word; only its status becomes `Superseded by TD-024`.
- TD-024 is a new record saying what changed and why.

Reversing a decision is normal. Losing the trail is the actual failure.

#### `localhost` means something different in every process that reads it

This was the real bug of the day, and I had already written down the rule that would have caught it. From the 21.9 entry:

> Inside the Compose network, containers reach each other by **service name**, not `localhost`.

I knew that for HTTP between services. What I missed is that it applies to **any** hostname in **any** string, including one buried in the middle of a connection URL where it does not read like a hostname at all:

```
DATABASE_URL=postgresql://user:pass@localhost:5432/codegames
                                    ^^^^^^^^^ this is a hostname
```

`env_file: - .env` copies that value into the container verbatim — no rewriting, no interpolation. So one unchanged string resolved three different ways depending on which process read it:

| where it runs              | `localhost:5432` resolves to                               | result                                            |
| -------------------------- | ---------------------------------------------------------- | ------------------------------------------------- |
| my host shell              | the Fedora system Postgres (`systemctl status postgresql`) | connects to the **wrong server**, then fails auth |
| inside the `api` container | the api container's own loopback, nothing listening        | `ECONNREFUSED`                                    |
| inside `api`, as `db:5432` | the `db` service                                           | correct                                           |

The nastiest row is the first. It did not fail with "no such host" or "connection refused" — it **successfully connected to a completely different database server** that happens to run on my laptop, and then failed with:

```
Ident authentication failed for user "mixailo146"
```

That error points at credentials, so I went looking at the password. The password was fine; the _host_ was wrong. An authentication error is not proof that you reached the machine you meant to reach — it only proves you reached _a_ Postgres.

Worth recording why the host cannot reach the container's database at all: the `db` service has no `ports:` mapping, so 5432 exists only inside the Compose network.

```
$ docker compose ps
api  ->  0.0.0.0:5000->5000/tcp    # published to the host
db   ->  5432/tcp                  # container-only, no host mapping
```

That is deliberate, but it means "localhost:5432 works on my machine" was never going to be the containerised database — there was no arrangement of credentials that could have made that URL correct.

#### `environment:` overrides `env_file:`, one key at a time

The fix is that the two can coexist. `environment:` wins for the keys it names, and every other key still falls through from `env_file:`:

```yaml
api:
  env_file:
    - .env # PORT, NODE_ENV, POSTGRES_* still all come from here
  environment:
    # only this one key is overridden
    DATABASE_URL: postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@db:5432/${POSTGRES_DB}
```

So `.env` keeps the host-shaped URL for anything I run locally, and the container gets the Compose-shaped one. Proved it from inside:

```bash
$ docker compose exec api sh -c 'echo $DATABASE_URL'
postgresql://mixailo146:***@db:5432/codegames    # not the .env value
```

Note that this line uses `${VAR}` interpolation, which per the 21.9 table reads the shell and the root `.env` — **not** `env_file`. The two mechanisms are still unrelated; this one line just happens to touch both.

#### An env var only does something if some process reads it

The `db` service had this, and I assumed it was load-bearing:

```yaml
db:
  environment:
    DATABASE_URL: postgresql://...@db:5432/${POSTGRES_DB}?schema=public
```

The `postgres:17` image never reads `DATABASE_URL`. It initialises itself from `POSTGRES_USER`, `POSTGRES_PASSWORD` and `POSTGRES_DB`, and ignores anything else handed to it. That line did nothing — and it did nothing in the most misleading way possible, because while my real `DATABASE_URL` was broken, a correct-looking one sat a few lines away in the same file. Deleted.

(The `?schema=public` suffix was a Prisma-ism too. `pg` and Drizzle ignore it.)

#### "Latest of everything" is not a valid version set

Prisma 8 ships as several independently versioned packages, and the failure taught me to distrust the layer an error names. The symptom:

```
Failed to parse syntax of config file at ".../prisma.config.ts"
```

The syntax was fine. An old CLI (`prisma@6`) was being handed a config format from a newer generation — an outdated **parser**, reporting itself as a **syntax** problem. Same shape as the auth error above: the message named the wrong layer.

With the CLI updated, a second mismatch surfaced, because the CLI bundles its own copy of the toolchain and it has to match the one the app depends on:

| `@prisma/orm-postgres` | matching `prisma` CLI |
| ---------------------- | --------------------- |
| rc.11                  | rc.15                 |
| rc.12                  | rc.17                 |
| rc.13                  | none released yet     |

`npm install x@latest y@latest` produced a pair that could not work together. The lesson generalises past Prisma: when a tool vendors an engine, the valid version sets are **pairs**, and "newest of each" is not necessarily one of them. Part of why Drizzle appealed — `drizzle-orm` and `drizzle-kit` are two ordinary packages with no bundled engine between them.

#### `docker compose run` vs `exec`

For the root `db:*` scripts I needed one-off commands in the api service. Two options, and they are not interchangeable:

|                                     | needs the stack running | starts dependencies       | container              |
| ----------------------------------- | ----------------------- | ------------------------- | ---------------------- |
| `docker compose exec api <cmd>`     | **yes**                 | no                        | reuses the running one |
| `docker compose run --rm api <cmd>` | no                      | yes, honours `depends_on` | fresh, then discarded  |

`run` is right for migrations: it starts `db` and waits for the healthcheck, so `npm run db:migrate` works from a cold stop. `exec` is right for `db:psql`, where I want a shell inside a container that is already up.

One catch: `run` does **not** publish the service's `ports:` by default. Usually that is what I want, since it avoids clashing with an already-running stack, but Drizzle Studio needs a reachable port, so that script passes `-p 4983:4983` explicitly.

#### Correction to the 21.9 entry

~~the package was removed entirely~~ — `dotenv` is back in `api/package.json`. It arrived with the Prisma scaffold, which loaded env inside its own config file. Now that Prisma is gone nothing imports it, so it is an unused dependency rather than a working one. The reasoning in the 21.9 entry still holds: inside Docker, Compose has already injected the variables before Node starts, so the package has nothing to contribute.
