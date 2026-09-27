# Architecture & Conventions

This document records the engineering conventions of **AI Study Backend**. Conventions that
are not yet backed by an implementation are marked as **Planned** so that it stays obvious
what exists today and what does not.

The project is developed in isolated, separately reviewed phases. A later phase must not
retroactively rewrite these rules; it must follow them.

The full folder skeleton under `src/` (plus `checkpoints/`) is scaffolded **upfront**, so the
directory layout is complete and stable from the start. This is structure only: every folder's
actual implementation still lands in the phase that owns it. A folder existing does **not** mean
the feature exists yet — an empty folder carries no behaviour, and the **Planned** markers below
still describe what is actually implemented today.

---

## 1. Application entry point

There is exactly **one** entry point: `src/app.js`.

`src/app.js` owns application creation and basic server initialisation: environment loading,
security headers, CORS, body parsing, a health endpoint, and the registration of the
not-found and global error middlewares.

Rules:

- Do **not** add a second entry point such as `src/server.js` purely to split responsibilities.
- Do **not** wire the database, queues, schedulers or AI provider clients into `src/app.js`.
  Those layers get their own modules and are connected in a later phase.
- Bootstrap logic should be small and declarative. When it grows, extract named setup modules
  instead of turning `src/app.js` into a monolith.

---

## 2. Naming conventions

### Functions and methods

Generic CRUD names are forbidden. A name must describe the domain action it performs.

| Forbidden               | Required                 |
| ----------------------- | ------------------------ |
| `getAll()`              | `getAllStudyMaterials()` |
| `getOne()`              | `getStudyMaterialById()` |
| `create()`              | `createStudyMaterial()`  |
| `update()`              | `updateStudyMaterial()`  |
| `remove()` / `delete()` | `deleteStudyMaterial()`  |

The same rule applies to query helpers: prefer `findStudyMaterialsOwnedByUser()` over
`findByUser()`.

### Files and folders

- Folders use `kebab-case` and are named after the domain they own
  (`study-materials`, `flashcards`, `study-sessions`).
- The top-level layer folders are scaffolded upfront and stay put; the domain folders inside them
  are created by the phase that fills them.
- Files are named `<kind>.<name>.<ext>` with an explicit kind suffix:
  - `study-material.controller.js`
  - `study-material.service.js`
  - `study-material.schema.js`
  - `study-material.route.js`
  - `async-handler.middleware.js`
  - `app.error.js`
  - `http-statuses.js`

### JavaScript style

CommonJS modules, 2-space indentation, single quotes, semicolons, trailing commas.
ESLint and Prettier are the source of truth — never hand-format against them.

---

## 3. Database conventions (Planned)

Introduced in the database/model phase, not before.

### Primary and foreign keys

Keys are `<entity>_id` in `snake_case`. They are never bare `id` in relationships and never
abbreviated (`u_id`, `sess_id`).

| Entity         | Key                 |
| -------------- | ------------------- |
| User           | `user_id`           |
| Study material | `study_material_id` |
| Summary        | `summary_id`        |
| Flashcard      | `flashcard_id`      |
| Quiz           | `quiz_id`           |
| Study session  | `study_session_id`  |

### Column names

Every column is `snake_case`. Timestamps are `created_at`, `updated_at`, `deleted_at`, and
`deleted_at` is reserved for soft deletion semantics.

- JavaScript attributes stay `camelCase` and are mapped with Sequelize `underscored: true`
  and `field` overrides. The mapping is one-way: the database is `snake_case`, the
  application is `camelCase`.
- Money, duration and score columns must declare an explicit unit in the name
  (`duration_seconds`, `score_percent`).
- Provider-specific columns belong in a separate table keyed by the platform entity, so the
  platform model never depends on one AI vendor.

---

## 4. HTTP status codes

Status codes are never hardcoded in routes, controllers, services or middleware. They are
read from the single source of truth `src/enums/http-statuses.js`:

```js
const { HTTP_STATUS } = require('../enums/http-statuses');

response.status(HTTP_STATUS.CREATED).json({ ... });
```

Available constants: `OK`, `CREATED`, `BAD_REQUEST`, `UNAUTHORIZED`, `FORBIDDEN`,
`NOT_FOUND`, `CONFLICT`, `INTERNAL_SERVER_ERROR`.

The module is the only place a numeric status may appear. Adding a status means adding it
there once, never duplicating it in a second file.

---

## 5. Error architecture

`src/errors/app.error.js` exports `AppError`, the base class for every error the application
raises on purpose.

```
AppError
├── ValidationError
├── AuthenticationError
├── AuthorizationError
├── NotFoundError
└── ConflictError
```

Rules:

- A new error type is a new class extending `AppError`, defaulting `statusCode` to the status
  that matches its semantics. It does not get its own file unless it carries real logic.
- Unexpected failures are never converted into `AppError` at the throw site. They are allowed
  to bubble up to the global error handler, which reports them as
  `HTTP_STATUS.INTERNAL_SERVER_ERROR` with a generic message and logs the original error.
- Error messages are safe to return to clients. They must never contain SQL, stack traces,
  file paths, tokens or provider payloads.
- The global error handler is `src/middleware/error.middleware.js`. It is the only place that
  turns an error into an HTTP response.

---

## 6. Async request flow

Controllers are `async` and are always wrapped in `asyncHandler`. This removes repetitive
`try/catch` from every controller.

```
async controller
  -> asyncHandler          (src/middleware/async-handler.middleware.js)
  -> next(error)
  -> errorMiddleware       (src/middleware/error.middleware.js)
```

Rules:

- A controller never catches an error just to log it and rethrow it. That is `asyncHandler`'s job.
- A controller may catch an error only to translate it into a domain `AppError`.
- Middleware order in `src/app.js` is: security/CORS, body parsers, routes, `notFoundMiddleware`,
  `errorMiddleware`. The two terminal middlewares are always last.

---

## 7. Validation (Planned)

Request and response payload validation uses [Joi](https://joi.dev/) inside `src/schemas/`.

Rules:

- Validation runs in a validation middleware, before any controller or service logic.
- A schema module exports Joi schemas only. It never performs I/O, database access or business
  rules.
- Schemas are named after the domain entity: `auth.schema.js`, `user.schema.js`,
  `study-material.schema.js`, `summary.schema.js`, `flashcard.schema.js`, `quiz.schema.js`.
- A schema is created in the phase that introduces its entity, never in advance.

---

## 8. Service responsibilities (Planned)

Services hold business logic. They must stay free of transport and infrastructure concerns.

A service must **not**:

- read `request`/`response` objects or build HTTP responses;
- validate raw request payloads (that is the validator layer);
- perform multipart parsing or write files to disk;
- issue raw SQL or manage database sessions;
- send email or call a notification provider directly;
- choose a specific AI vendor SDK.

A service should depend on other services for those concerns:

| Concern                                          | Owner                                                                                              |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| Study workflow rules                             | `StudyMaterialService`, `SummaryService`, `FlashcardService`, `QuizService`, `StudySessionService` |
| File upload mechanics, storage keys, signed URLs | `FileStorageService`                                                                               |
| Email delivery                                   | `EmailService`                                                                                     |
| AI provider calls behind one interface           | provider-agnostic AI integration layer                                                             |

Controllers are the only layer allowed to convert a service result into an HTTP response.

---

## 9. File storage (Planned)

Uploads never happen inside a business service.

Flow: route (multipart middleware) -> upload/storage layer -> `FileStorageService` returns a
storage key, path or URL -> the business service receives and stores that reference.

Business logic must work with a storage reference, so it stays testable and independent of
where bytes are kept (local disk, S3-compatible object storage, ...).

---

## 10. Email (Planned)

Email is a delivery concern and is never sent inline from a business service.

```
UserService -> EmailService -> Email provider
```

`UserService` decides _that_ a message must be sent and passes the payload. `EmailService`
decides _how_ and _through which provider_ it is delivered.

---

## 11. Utilities (Planned)

Generic, reusable, dependency-free helpers live in `src/utils/` and are named as verbs, for
example `normalizeEmail()`.

A helper belongs in `src/utils/` only when at least two consumers need it. A helper used once
stays next to its single consumer.

---

## 12. Environment and secrets

- `.env` is git-ignored and must never be committed.
- `.env.example` carries variable **names** and safe placeholder values only. It gains a new
  group of variables in the phase that starts reading them.
- API keys, passwords, database credentials, JWT secrets and provider tokens live in the local
  `.env` or in the deployment platform's secret store. They must not appear in source files,
  logs, README, or commit messages.
- The repository never logs a secret value. Log keys and identifiers, not credentials.
