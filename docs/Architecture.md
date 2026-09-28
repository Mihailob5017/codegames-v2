# Architecture

This document describes _how the system is built_: its segments, their responsibilities, and how they interact.
The reasoning behind individual technology choices lives in [Technical Decisions](./Technical%20Decisions.md).

## 1. Overview

The application is split into two independently deployable segments, orchestrated with Docker Compose. Both are written in TypeScript.

| Segment            | Responsibility                                                                               |
| ------------------ | -------------------------------------------------------------------------------------------- |
| **Web** (frontend) | User interface, including the in-browser code editor                                         |
| **API** (backend)  | All non-code-execution business logic, persistence, and orchestration of supporting services |

Supporting services:

| Service        | Role                                                          |
| -------------- | ------------------------------------------------------------- |
| **PostgreSQL** | Primary database (challenges, test cases, users, submissions) |
| **Piston**     | Sandboxed, multi-language code-execution engine               |
| **MinIO**      | S3-compatible object storage for images                       |

```
┌──────────┐   HTTP    ┌──────────┐        ┌────────────┐
│   Web    │ ────────▶ │   API    │ ─────▶ │ PostgreSQL │
│ (React)  │           │ (Express)│        └────────────┘
└──────────┘           │          │ ─────▶ ┌────────────┐
                       │          │        │   Piston   │
                       │          │        └────────────┘
                       │          │ ─────▶ ┌────────────┐
                       └──────────┘        │   MinIO    │
                                           └────────────┘
```

The Web segment talks only to the API. Piston, PostgreSQL and MinIO are internal services reachable only from the API.

## 2. Frontend (Web)

- **Stack:** React + Vite + TypeScript.
- **UI:** traditional component-based UI; styling with CSS Modules using BEM class naming.
- **State:** Redux slices for global state; custom hooks encapsulate data access and component logic.
- **Editor:** `@monaco-editor/react` provides the embedded code editor.

## 3. Backend (API)

- **Stack:** Express + TypeScript.
- **Structure:** Domain-Driven Design. Code is organised by domain into
  - _Entities_ – core business objects and their invariants
  - _Repositories_ – persistence abstractions over Drizzle ORM
  - _Services_ – application and domain logic
- **Persistence:** PostgreSQL accessed through Drizzle ORM.
- **Migrations:** the schema lives in `api/db/schema.ts`; `drizzle-kit` generates reviewable SQL into `api/db/migrations/`. Both run inside the `api` container via the root `db:generate` / `db:migrate` scripts.
- **Seeding:** `api/db/seed.ts` populates the database (users now; challenges, test cases, etc. later). Run on demand with `npm run db:seed`; it is idempotent, so re-running it is safe.

## 4. Key Flows

### 4.1 Code submission

1. The user writes code in the Monaco editor and submits it.
2. The API loads the challenge's test cases from PostgreSQL.
3. The API sends the code and test inputs to Piston, which executes them in an isolated sandbox.
4. The API compares Piston's output with the expected results and returns a verdict to the Web client.

### 4.2 Image upload

1. The Web client sends the image to the API.
2. The API stores the object in MinIO and persists its reference in PostgreSQL.

## 5. Infrastructure

- All services run as containers via **Docker Compose** on a shared bridge network.
- Environment configuration is supplied through `.env` / `.env.local` files.
- Only Web and API expose ports to the host; PostgreSQL, Piston and MinIO are reachable only on the internal network.
