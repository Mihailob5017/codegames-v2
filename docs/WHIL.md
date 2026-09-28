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

Today I learned that in regards to the ADR document, once you commit to something, usually its bad practice to change it later on, I have done that by switching from Prisma to drizzle. Since I am a one man team, so far it shouldnt pose a problem, however its bad practice for the future.
