// `sequelize-cli` reads this file and builds its connection from it, as
// configured in `.sequelizerc`.
//
// This file is a thin adapter on purpose. Every decision about the connection
// lives in `src/config/database.config.js`, so the CLI cannot drift away from
// the application. Requiring `app.config.js` (which that module does) is what
// loads the environment here as well, which keeps a single dotenv boundary
// across every entry point, including command-line tooling.
//
// There is one connection string, not one per environment, so all three keys
// deliberately share the same options object and Sequelize reads only the key
// matching NODE_ENV. Resolving the options at load time means a missing
// DATABASE_URL fails immediately with a clear message instead of surfacing as a
// confusing connection error later.
const { createDatabaseConnectionConfig } = require('../../config/database.config');

const connectionConfig = createDatabaseConnectionConfig();

module.exports = {
  development: connectionConfig,
  test: connectionConfig,
  production: connectionConfig,
};
