// Database configuration lives in its own module rather than in
// `app.config.js`. `app.config.js` owns process-wide runtime concerns and is
// required by every entry point, including the Sequelize CLI, while this module
// owns only what a database connection needs. Keeping them apart means HTTP
// settings are never loaded to run a migration, and credentials are never
// needed to boot the server.
//
// Requiring `app.config.js` here is also what loads the environment, because
// that file is the project's single dotenv boundary. This module must never
// call dotenv itself, or a command-line entry point would resolve a different
// environment than the running application.
const { appConfig } = require('./app.config');

const { nodeEnv } = appConfig;

const DATABASE_URL_VARIABLE = 'DATABASE_URL';
const POSTGRES_DIALECT = 'postgres';
const DEFAULT_POSTGRES_PORT = 5432;
const SUPPORTED_DATABASE_PROTOCOLS = ['postgres:', 'postgresql:'];

// Supabase's connection pooler is reached directly on the PostgreSQL port and
// terminates TLS with a certificate that Node cannot verify against a public
// certificate authority, so the socket still has to be encrypted while
// verification stays disabled. This is the setting Supabase documents for this
// pooler, and it is deliberately the only place in the project that configures
// SSL: Sequelize forwards these options to the `pg` driver through
// `dialectOptions`, which is the only path the driver actually reads.
const databaseSsl = Object.freeze({
  require: true,
  rejectUnauthorized: false,
});

// The pooler multiplexes many clients over a small number of real server
// connections, and a serverless deployment can create bursts of short-lived
// clients. The pool is therefore kept deliberately small and returns
// connections quickly, to stay well inside Supabase's connection allowance.
// Durations are milliseconds.
const databasePool = Object.freeze({
  max: 5,
  min: 0,
  idle: 10000,
  acquire: 20000,
});

// The database stores `snake_case` and the application uses `camelCase`, as
// documented in `docs/architecture.md`. Declaring the mapping once here means
// every model inherits it instead of each model repeating it, and the
// column names stay `snake_case` without per-attribute `field` overrides.
const databaseDefine = Object.freeze({
  underscored: true,
});

// Production stays silent so that a chatty query or a slow statement cannot
// fill function logs with raw SQL. Development gets a single line per statement,
// which is enough to follow a request without adding a logging dependency.
// Test is silent so that assertions are not buried in query output.
const logDatabaseQuery = message => {
  console.log(`[sequelize] ${message}`);
};

// Silence is a function rather than `false`, because `sequelize-cli` replaces any
// `logging` value that is not a function with `console.log`. This way migrations
// stay quiet in production as well as the application does.
const ignoreDatabaseQuery = () => {};

const databaseLogging = nodeEnv === 'development' ? logDatabaseQuery : ignoreDatabaseQuery;

// The value is deliberately never included in an error. A malformed or
// misconfigured connection string can still contain a password, and this error
// may be logged or surfaced to a client.
const readDatabaseUrl = () => {
  const databaseUrl = (process.env[DATABASE_URL_VARIABLE] ?? '').trim();

  if (databaseUrl === '') {
    throw new Error(
      `${DATABASE_URL_VARIABLE} is not set. Copy .env.example to .env and set ` +
        `${DATABASE_URL_VARIABLE} to your PostgreSQL connection string before using ` +
        'database functionality.',
    );
  }

  return databaseUrl;
};

// Percent-escapes are decoded so that a password containing `@`, `/` or `:` still
// parses. A raw `%` is a malformed escape and `decodeURIComponent` would throw a
// `URIError` whose message says nothing useful, so it is reported with the same
// credential-free wording as the other validation failures.
const decodeUrlComponent = (value, description) => {
  try {
    return decodeURIComponent(value);
  } catch {
    throw new Error(
      `${DATABASE_URL_VARIABLE} is not a valid connection string: the ${description} ` +
        'contains an invalid percent-escape. The value is not shown here because it may ' +
        'contain credentials.',
    );
  }
};

const parseDatabaseUrl = databaseUrl => {
  let parsedUrl;

  try {
    parsedUrl = new URL(databaseUrl);
  } catch {
    throw new Error(
      `${DATABASE_URL_VARIABLE} is not a valid connection string. Expected the form ` +
        'postgresql://USER:PASSWORD@HOST:PORT/DATABASE. The value is not shown here ' +
        'because it may contain credentials.',
    );
  }

  if (!SUPPORTED_DATABASE_PROTOCOLS.includes(parsedUrl.protocol)) {
    throw new Error(
      `${DATABASE_URL_VARIABLE} must use a PostgreSQL connection string, but the ` +
        `protocol was "${parsedUrl.protocol}". This project connects to PostgreSQL only.`,
    );
  }

  // The leading slash is part of the URL pathname syntax, not the database name.
  const database = decodeUrlComponent(parsedUrl.pathname.replace(/^\//, ''), 'database name');

  if (database === '') {
    throw new Error(
      `${DATABASE_URL_VARIABLE} must name a database, but no database appears in the ` +
        'path portion of the connection string.',
    );
  }

  return {
    database,
    username: decodeUrlComponent(parsedUrl.username, 'username'),
    password: decodeUrlComponent(parsedUrl.password, 'password'),
    host: parsedUrl.hostname,
    port: parsedUrl.port === '' ? DEFAULT_POSTGRES_PORT : Number(parsedUrl.port),
    // `sslmode=disable` is honoured for a local development database, where the
    // socket genuinely is not encrypted. Anything else keeps the encrypted
    // default.
    sslDisabled: parsedUrl.searchParams.get('sslmode') === 'disable',
  };
};

// `sequelize-cli` builds its connection from a single options object, and so
// does this project, so one factory serves both entry points and the two cannot
// drift apart. Credentials are read per call rather than at module load, so a
// process that never touches the database is never asked for them.
const createDatabaseConnectionConfig = () => {
  const parsedUrl = parseDatabaseUrl(readDatabaseUrl());

  return {
    dialect: POSTGRES_DIALECT,
    host: parsedUrl.host,
    port: parsedUrl.port,
    username: parsedUrl.username,
    password: parsedUrl.password,
    database: parsedUrl.database,
    dialectOptions: parsedUrl.sslDisabled ? {} : { ssl: databaseSsl },
    define: databaseDefine,
    pool: databasePool,
    logging: databaseLogging,
  };
};

module.exports = { createDatabaseConnectionConfig };
