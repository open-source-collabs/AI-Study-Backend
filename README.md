# AI Study Backend

Backend service for the **AI Study Companion** platform.

The platform owns the study workflow and the structured study experience; AI supplies the
intelligence. The backend is therefore not a chat proxy — it owns users, study materials,
generated artifacts, study sessions and progress, and treats AI providers as replaceable
integrations behind one interface.

**Status: Phase 0 — repository foundation only.** The service currently boots, exposes a
health endpoint and ships lint/format tooling. No study feature exists yet. See
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
- PostgreSQL — _from the database phase onwards; not required yet_

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

Configuration is loaded from `.env` with [dotenv](https://github.com/motdotla/dotenv) at
startup, then read once by `src/config/app.config.js`. That module is the only place allowed to
touch `process.env`; application code consumes the normalized `appConfig` object instead.

| Variable   | Required | Default       | Description                            |
| ---------- | -------- | ------------- | -------------------------------------- |
| `NODE_ENV` | No       | `development` | `development`, `test` or `production`. |
| `PORT`     | No       | `3000`        | TCP port the HTTP server binds to.     |

`PORT` must be an integer between 1 and 65535. An unusable value (garbage, a fraction, or out of
range) logs a warning and falls back to `3000` rather than failing at startup.

How to configure:

1. Copy `.env.example` to `.env` and edit your local copy.
2. `.env` is git-ignored — never commit it.
3. `.env.example` must only ever contain variable **names** and safe placeholders. A new group
   of variables is added to it in the phase that starts reading them.

Never commit API keys, passwords, database credentials, JWT secrets or provider tokens. In
deployment, supply them through the platform's secret store rather than a committed file.

## Available scripts

| Script                 | Description                                  |
| ---------------------- | -------------------------------------------- |
| `npm start`            | Start the server with Node.                  |
| `npm run dev`          | Start the server with nodemon (auto-reload). |
| `npm run lint`         | Lint the whole repository with ESLint.       |
| `npm run lint:fix`     | Lint and apply fixable ESLint problems.      |
| `npm run format`       | Format the repository with Prettier.         |
| `npm run format:check` | Verify formatting without writing files.     |

There is **no test suite yet**; test infrastructure is scheduled for a later phase. Until it
lands, `npm run lint` plus a manual `GET /health` request is the verification baseline.

## Repository structure

The full folder skeleton is scaffolded upfront, so the tree below is complete. Most folders
currently hold only a `.gitkeep`: their implementation lands in the phase that owns it, so a
folder being present does not mean the feature exists yet. See the
[Roadmap](#roadmap) for what is actually implemented.

```text
AI-Study-Backend/
├── src/
│   ├── config/
│   │   └── app.config.js       # Runtime configuration, read once at startup
│   ├── controllers/            # HTTP request/response handling        (empty)
│   ├── database/
│   │   ├── config/             # Sequelize CLI config                  (empty)
│   │   ├── migrations/         # Sequelize migrations                  (empty)
│   │   └── seeders/            # Sequelize seeders                     (empty)
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
│   │   └── index.js            # Model registry, filled in the database phase
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
- **Configuration boundary** — `src/config/app.config.js` resolves `NODE_ENV` and `PORT` from the
  environment once at startup and exposes them as a frozen `appConfig`. It is the only module that
  reads `process.env`; `PORT` is validated as a usable TCP port and falls back to `3000`.
- **Base middleware stack** — security headers (`helmet`), CORS, JSON and URL-encoded body
  parsing (1 MB limit), `x-powered-by` disabled.
- **Health endpoint** — `GET /health`.
- **Centralized HTTP statuses** — `src/enums/http-statuses.js`.
- **Base error type** — `AppError` in `src/errors/app.error.js`.
- **Async error forwarding** — `asyncHandler` in `src/middleware/async-handler.middleware.js`.
- **Global error handling** — `notFoundMiddleware` and `errorMiddleware` in
  `src/middleware/error.middleware.js`. Unknown routes return a JSON `404`; unexpected errors
  return a generic JSON `500` and are logged server-side.
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

Errors always travel back the same way: any layer throws an `AppError` and calls `next(error)`,
and the global `errorMiddleware` produces the response.

Conventions that must be followed when code is added — meaningful function names over generic
CRUD names, `snake_case` `<entity>_id` keys, no hardcoded status codes, no I/O inside business
services, uploads and email behind their own layers — are specified in
[`docs/architecture.md`](docs/architecture.md). Read it before adding a feature.

## Roadmap

Each phase is developed and merged separately. **None of the items below is implemented yet.**

| Phase | Scope                                                               |
| ----- | ------------------------------------------------------------------- |
| 0     | Repository foundation, entry point, error/HTTP conventions, tooling |
| 1     | Database layer, models and migrations                               |
| 2     | Authentication and authorization                                    |
| 3     | Users and profiles                                                  |
| 4     | Study material upload and text extraction                           |
| 5     | Provider-independent AI integration                                 |
| 6     | AI-generated summaries                                              |
| 7     | Flashcards                                                          |
| 8     | Quizzes                                                             |
| 9     | Note-grounded Q&A                                                   |
| 10    | Study sessions and progress tracking                                |
| 11    | Real-time updates (SSE) and background events                       |
| 12    | Email and notification layer                                        |

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
