# AI Study Backend

Backend service for the **AI Study Companion** platform.

The platform owns the study workflow and the structured study experience; AI supplies the
intelligence. The backend is therefore not a chat proxy — it owns users, study materials,
generated artifacts, study sessions and progress, and treats AI providers as replaceable
integrations behind one interface.

**Status: the repository foundation and the database architecture are done.** The service
boots, exposes a health endpoint, ships lint/format tooling, a test suite, and a ready-to-use
Sequelize/PostgreSQL layer whose migrations and seeders are still empty. No study feature exists
yet, and no domain model or table has been created. See
[Current implementation](#current-implementation) and [Roadmap](#roadmap).

---

## Table of contents

- [Requirements](#requirements)
- [Development setup](#development-setup)
- [Environment configuration](#environment-configuration)
- [Available scripts](#available-scripts)
- [Repository structure](#repository-structure)
- [Current implementation](#current-implementation)
- [Architecture](#architecture)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [License](#license)

---

## Requirements

- Node.js **20 or newer** (developed on Node 24)
- npm 10 or newer
- PostgreSQL — Supabase, reached through its **session pooler** on port `5432`. Not required to
  boot the HTTP server, but required for any database functionality and for migrations.

## Development setup

```bash
git clone https://github.com/open-source-collabs/AI-Study-Backend.git
cd AI-Study-Backend
npm install
cp .env.example .env
npm run dev
```

The service then listens on <http://localhost:3000>. Verify it:

```bash
curl http://localhost:3000/health
```

```json
{
  "success": true,
  "service": "ai-study-backend",
  "status": "ok",
  "uptimeInSeconds": 12.34
}
```

`npm run start` runs the same server without the file watcher.

## Environment configuration

`src/config/app.config.js` loads `.env` with [dotenv](https://github.com/motdotla/dotenv) and
reads it once. It is the only place allowed to touch `process.env`; application code consumes
the normalized `appConfig` object instead. Any entry point that needs configuration — including
database tooling that never starts the HTTP server — gets the same values by requiring that
module, so none of them depends on `src/app.js` having run first.

| Variable       | Required              | Default       | Description                                                                                |
| -------------- | --------------------- | ------------- | ------------------------------------------------------------------------------------------ |
| `NODE_ENV`     | No                    | `development` | `development`, `test` or `production`.                                                     |
| `PORT`         | No                    | `3000`        | TCP port the HTTP server binds to.                                                         |
| `DATABASE_URL` | For any database work | —             | PostgreSQL connection string for Supabase, e.g. `postgresql://USER:PASSWORD@HOST:PORT/DB`. |

`PORT` must be an integer between 1 and 65535. An unusable value (garbage, a fraction, or out of
range) logs a warning and falls back to `3000` rather than failing at startup.

`DATABASE_URL` is read by `src/config/database.config.js`, never by `app.config.js`. It is
validated when database functionality starts, so a missing or malformed value fails with a message
that names the variable and never echoes it. `?sslmode=disable` is honoured for a local development
database; every other connection is required to be encrypted.

The server boots without a database, because no feature needs one yet. Anything that does need it —
`initializeDatabase()`, migrations, seeders — requires `DATABASE_URL` first.

How to configure:

1. Copy `.env.example` to `.env` and edit your local copy.
2. `.env` is git-ignored — never commit it.
3. `.env.example` must only ever contain variable **names** and safe placeholders. A new group
   of variables is added to it in the phase that starts reading them.

Never commit API keys, passwords, database credentials, JWT secrets or provider tokens. In
deployment, supply them through the platform's secret store rather than a committed file.

## Available scripts

| Script                                         | Description                                  |
| ---------------------------------------------- | -------------------------------------------- |
| `npm start`                                    | Start the server with Node.                  |
| `npm run dev`                                  | Start the server with nodemon (auto-reload). |
| `npm test`                                     | Run the test suite (Node's built-in runner). |
| `npm run lint`                                 | Lint the whole repository with ESLint.       |
| `npm run lint:fix`                             | Lint and apply fixable ESLint problems.      |
| `npm run format`                               | Format the repository with Prettier.         |
| `npm run format:check`                         | Verify formatting without writing files.     |
| `npm run db:migrate`                           | Apply every pending migration.               |
| `npm run db:migrate:status`                    | List applied and pending migrations.         |
| `npm run db:migrate:generate -- --name <name>` | Create a new, empty migration file.          |
| `npm run db:migrate:undo`                      | Roll the last migration back.                |
| `npm run db:seed:all`                          | Run every seeder.                            |
| `npm run db:seed:undo`                         | Roll the last seeder back.                   |
| `npm run db:seed:generate -- --name <name>`    | Create a new, empty seeder file.             |

The tests cover configuration behaviour and module boundaries only, and **none of them needs a live
database**: `DATABASE_URL` is faked with a non-routable host. That keeps `npm test` deterministic and
offline.

## Repository structure

The folder skeleton under `src/` is scaffolded upfront, so the tree below is complete; `test/` is the
one folder added later, by the phase that introduced tests. Most folders currently hold only a
`.gitkeep`: their implementation lands in the phase that owns it, so a folder being present does not
mean the feature exists yet. See the [Roadmap](#roadmap) for what is actually implemented.

```text
AI-Study-Backend/
├── src/
│   ├── config/
│   │   ├── app.config.js       # Runtime configuration, read once at startup
│   │   └── database.config.js # Sequelize connection options from DATABASE_URL
│   ├── controllers/            # HTTP request/response handling        (empty)
│   ├── database/
│   │   ├── config/
│   │   │   └── config.js       # sequelize-cli adapter over database.config.js
│   │   ├── migrations/         # Schema migrations (source of truth)  (empty)
│   │   └── seeders/            # Reference-data seeders                 (empty)
│   ├── docs/                   # Runtime-served API documentation      (empty)
│   ├── enums/
│   │   └── http-statuses.js    # Single source of truth for HTTP status codes
│   ├── errors/
│   │   └── app.error.js        # AppError, base class for operational errors
│   ├── events/                 # In-process event bus                  (empty)
│   ├── middleware/
│   │   ├── async-handler.middleware.js  # Wraps async controllers, forwards rejections
│   │   └── error.middleware.js          # notFoundMiddleware + global errorMiddleware
│   ├── models/
│   │   └── index.js            # Sequelize instance, model registry, initializeDatabase
│   ├── routes/                 # Express routers per domain           (empty)
│   ├── schemas/                # Joi schemas, no I/O                   (empty)
│   ├── scrapers/
│   │   └── README.md           # Purpose and open questions; no logic yet
│   ├── services/               # Business logic, no transport concerns (empty)
│   ├── sse/                    # Server-sent events for live updates    (empty)
│   ├── utils/                  # Generic dependency-free helpers        (empty)
│   └── app.js                  # Single entry point: app creation + server start
├── checkpoints/                # Study-session resume data; purpose README
├── docs/
│   └── architecture.md         # Engineering conventions (naming, errors, keys, statuses)
├── test/                       # Focused tests; no live database required
├── .env.example                # Committed template, names only
├── .gitignore
├── .prettierignore
├── .sequelizerc                # Points sequelize-cli at src/database/* and src/models
├── eslint.config.js            # ESLint flat config
├── package.json
├── package-lock.json
├── prettier.config.js
├── vercel.json                 # Minimal @vercel/node serverless config
└── README.md
```

## Current implementation

Everything listed below exists in the code today. The empty scaffolded folders above are
deliberately **not** listed here — they contain no behaviour yet.

- **Single entry point** — `src/app.js` creates the Express app and starts the HTTP server.
- **Configuration boundary** — `src/config/app.config.js` loads `.env` and resolves `NODE_ENV` and
  `PORT` from the environment once at module load, then exposes them as a frozen `appConfig`. It is
  the only module that loads the environment or reads `process.env`; `PORT` is validated as a usable
  TCP port and falls back to `3000`.
- **Base middleware stack** — security headers (`helmet`), CORS, JSON and URL-encoded body
  parsing (1 MB limit), `x-powered-by` disabled.
- **Health endpoint** — `GET /health`.
- **Centralized HTTP statuses** — `src/enums/http-statuses.js`.
- **Base error type** — `AppError` in `src/errors/app.error.js`, plus the derived
  `ValidationError`, `AuthenticationError`, `AuthorizationError`, `NotFoundError` and
  `ConflictError`.
- **Async error forwarding** — `asyncHandler` in `src/middleware/async-handler.middleware.js`.
- **Global error handling** — `notFoundMiddleware` and `errorMiddleware` in
  `src/middleware/error.middleware.js`. Unknown routes return a JSON `404`; unexpected errors
  return a generic JSON `500` and are logged server-side.
- **Database configuration** — `src/config/database.config.js` turns `DATABASE_URL` into Sequelize
  options: dialect, TLS, a small pool, `underscored: true` column mapping and query logging that is
  silent outside `development`. A missing or malformed value fails with a credential-free message.
- **Sequelize and model boundary** — `src/models/index.js` owns the single `Sequelize` instance, the
  `sequelize.models` registry, `loadModels()`, `defineAssociations()`, `initializeDatabase()` and
  `closeDatabase()`. **No domain model exists yet**, and `sequelize.sync()` is never used.
- **Migration tooling** — `.sequelizerc` plus `src/database/config/config.js` let `sequelize-cli`
  find `src/database/migrations` and `src/database/seeders` without importing `src/app.js`.
  Migrations and seeders are wired but empty.
- **Tests** — `npm test` runs Node's built-in test runner over `test/`: configuration behaviour,
  missing-`DATABASE_URL` behaviour, model-boundary guarantees and a guard that no committed file
  carries a credentialed connection string. No live database is required.
- **Tooling** — ESLint flat config, Prettier config, npm scripts, `.sequelizerc` (sequelize-cli
  paths) and `vercel.json` (serverless deploy config).

## Architecture

The service is a layered Express application. Requests flow one way only:

```text
HTTP request
  -> middleware (validation, auth)   [planned]
  -> route
  -> controller   (HTTP in/out only)
  -> service      (business logic only)
  -> model / external integration   [planned]
```

Database access sits underneath the service layer and is reachable only through Sequelize:

```text
Express application
  -> Sequelize
    -> PostgreSQL (Supabase, through the session pooler)
```

Errors always travel back the same way: any layer throws an `AppError` and calls `next(error)`,
and the global `errorMiddleware` produces the response.

Conventions that must be followed when code is added — meaningful function names over generic
CRUD names, `snake_case` `<entity>_id` keys, no hardcoded status codes, no I/O inside business
services, uploads and email behind their own layers — are specified in
[`docs/architecture.md`](docs/architecture.md). Read it before adding a feature.

## Roadmap

Each phase is developed and merged separately. A phase's **status** below is only
[Implemented](#current-implementation) once its code is in `main`; everything else is still to do.

| Phase | Scope                                                    | Status                                    |
| ----- | -------------------------------------------------------- | ----------------------------------------- |
| 0     | Repository foundation, entry point, conventions, tooling | Implemented                               |
| 1     | Database layer, models and migrations                    | Architecture only — no model or table yet |
| 2     | Authentication and authorization                         | Planned                                   |
| 3     | Users and profiles                                       | Planned                                   |
| 4     | Study material upload and text extraction                | Planned                                   |
| 5     | Provider-independent AI integration                      | Planned                                   |
| 6     | AI-generated summaries                                   | Planned                                   |
| 7     | Flashcards                                               | Planned                                   |
| 8     | Quizzes                                                  | Planned                                   |
| 9     | Note-grounded Q&A                                        | Planned                                   |
| 10    | Study sessions and progress tracking                     | Planned                                   |
| 11    | Real-time updates (SSE) and background events            | Planned                                   |
| 12    | Email and notification layer                             | Planned                                   |

Phase 1 owns the schema. Its plumbing (configuration, connection, model boundary, migration and
seeder tooling, tests) is in place, but the first migration arrives with the first entity that needs
a table — not before.

## Contributing

1. Work on a feature branch off `main`:
   `git switch -c feature/<short-description>`.
2. Keep each phase or feature in its own focused branch and open one pull request for it.
3. Before pushing, run:

   ```bash
   npm run format
   npm run lint
   ```

4. Keep the diff limited to the feature. Unrelated refactors, reformatting of untouched files
   and dependency churn belong in their own change.
5. Do not commit `.env` or any credential. Only variable names go into `.env.example`.
6. Follow [`docs/architecture.md`](docs/architecture.md). If a rule genuinely blocks your
   feature, change the rule in that document in the same pull request rather than silently
   diverging.
7. Do not implement features from later phases. Phase separation is deliberate; it keeps
   reviews small and the architecture reviewable.

## License

[MIT](LICENSE)
