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
startup.

| Variable   | Required | Default     | Description                            |
| ---------- | -------- | ----------- | -------------------------------------- |
| `NODE_ENV` | No       | `undefined` | `development`, `test` or `production`. |
| `PORT`     | No       | `3000`      | TCP port the HTTP server binds to.     |

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

Only the folders that the current phase justifies are present. Folders are added together
with the feature that owns them, not in advance.

```text
AI-Study-Backend/
├── docs/
│   └── architecture.md        # Engineering conventions (naming, errors, keys, statuses)
├── src/
│   ├── constants/
│   │   └── http-statuses.js   # Single source of truth for HTTP status codes
│   ├── errors/
│   │   └── app.error.js       # AppError, base class for operational errors
│   ├── middlewares/
│   │   ├── async-handler.middleware.js  # Wraps async controllers, forwards rejections
│   │   └── error.middleware.js          # notFoundMiddleware + global errorMiddleware
│   └── app.js                 # Single entry point: app creation + server start
├── .env                       # Local configuration (git-ignored)
├── .env.example               # Committed template, names only
├── .gitignore
├── .prettierignore
├── eslint.config.js           # ESLint flat config
├── package.json
├── package-lock.json
├── prettier.config.js
└── README.md
```

Planned folders — **not present yet**, each arrives with the phase that needs it:
`src/controllers/`, `src/routes/`, `src/services/`, `src/validators/`, `src/models/`,
`src/database/`, `src/utils/`, `src/events/`, `src/sse/`, `src/docs/`, `checkpoints/`.

## Current implementation

Everything listed below exists in the code today:

- **Single entry point** — `src/app.js` creates the Express app and starts the HTTP server.
- **Base middleware stack** — security headers (`helmet`), CORS, JSON and URL-encoded body
  parsing (1 MB limit), `x-powered-by` disabled.
- **Health endpoint** — `GET /health`.
- **Centralized HTTP statuses** — `src/constants/http-statuses.js`.
- **Base error type** — `AppError` in `src/errors/app.error.js`.
- **Async error forwarding** — `asyncHandler` in `src/middlewares/async-handler.middleware.js`.
- **Global error handling** — `notFoundMiddleware` and `errorMiddleware` in
  `src/middlewares/error.middleware.js`. Unknown routes return a JSON `404`; unexpected errors
  return a generic JSON `500` and are logged server-side.
- **Tooling** — ESLint flat config, Prettier config, npm scripts.

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
