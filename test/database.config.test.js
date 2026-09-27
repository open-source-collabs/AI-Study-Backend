const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { describe, it } = require('node:test');

const REPOSITORY_ROOT = path.join(__dirname, '..');
const DATABASE_CONFIG_PATH = path.join(REPOSITORY_ROOT, 'src', 'config', 'database.config.js');
const MODELS_INDEX_PATH = path.join(REPOSITORY_ROOT, 'src', 'models', 'index.js');

// Fixtures only. No real host, account or password is used anywhere in this file.
const PLACEHOLDER_CREDENTIALS_URL =
  'postgresql://test_user:test_password@db.example.test:5432/test_database';

const { createDatabaseConnectionConfig } = require('../src/config/database.config');

// `dotenv` resolves `.env` from the working directory, so a probe executed in a
// fresh temporary directory is hermetic: the developer's real `.env` is neither
// read nor inherited. This is the only way to observe the missing-variable path.
const runDatabaseProbe = (script, environment = {}, omittedVariables = []) => {
  const workingDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-study-backend-'));
  const childEnvironment = { ...process.env, ...environment };

  for (const variable of omittedVariables) {
    delete childEnvironment[variable];
  }

  try {
    return execFileSync(process.execPath, ['-e', script], {
      cwd: workingDirectory,
      encoding: 'utf8',
      env: childEnvironment,
    });
  } finally {
    fs.rmSync(workingDirectory, { recursive: true, force: true });
  }
};

const withDatabaseUrl = databaseUrl => {
  const previousDatabaseUrl = process.env.DATABASE_URL;

  process.env.DATABASE_URL = databaseUrl;

  return () => {
    if (previousDatabaseUrl === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = previousDatabaseUrl;
    }
  };
};

const resolveConfigurationFor = databaseUrl => {
  const restoreDatabaseUrl = withDatabaseUrl(databaseUrl);

  try {
    return createDatabaseConnectionConfig();
  } finally {
    restoreDatabaseUrl();
  }
};

describe('database configuration', () => {
  it('builds a PostgreSQL connection from DATABASE_URL', () => {
    const connectionConfig = resolveConfigurationFor(PLACEHOLDER_CREDENTIALS_URL);

    assert.equal(connectionConfig.dialect, 'postgres');
    assert.equal(connectionConfig.host, 'db.example.test');
    assert.equal(connectionConfig.port, 5432);
    assert.equal(connectionConfig.username, 'test_user');
    assert.equal(connectionConfig.password, 'test_password');
    assert.equal(connectionConfig.database, 'test_database');
  });

  it('defaults the port to 5432 when the connection string omits it', () => {
    const connectionConfig = resolveConfigurationFor('postgresql://db.example.test/test_database');

    assert.equal(connectionConfig.port, 5432);
  });

  it('decodes percent-escaped credentials so a special character still parses', () => {
    const connectionConfig = resolveConfigurationFor(
      'postgresql://test%40user:p%40ss%2Fword@db.example.test:5432/test_database',
    );

    assert.equal(connectionConfig.username, 'test@user');
    assert.equal(connectionConfig.password, 'p@ss/word');
  });

  it('keeps the connection encrypted for the pooler by default', () => {
    const { dialectOptions } = resolveConfigurationFor(PLACEHOLDER_CREDENTIALS_URL);

    assert.equal(dialectOptions.ssl.require, true);
    assert.equal(dialectOptions.ssl.rejectUnauthorized, false);
  });

  it('drops encryption only when the connection string asks for it', () => {
    const { dialectOptions } = resolveConfigurationFor(
      `${PLACEHOLDER_CREDENTIALS_URL}?sslmode=disable`,
    );

    assert.equal(dialectOptions.ssl, undefined);
  });

  it('applies a conservative pool and snake_case column mapping', () => {
    const connectionConfig = resolveConfigurationFor(PLACEHOLDER_CREDENTIALS_URL);

    assert.equal(connectionConfig.pool.max, 5);
    assert.equal(connectionConfig.pool.min, 0);
    assert.equal(connectionConfig.pool.idle, 10000);
    assert.equal(connectionConfig.pool.acquire, 20000);
    assert.equal(connectionConfig.define.underscored, true);
  });

  it('refuses a connection string that does not address PostgreSQL', () => {
    assert.throws(
      () => resolveConfigurationFor('mysql://db.example.test:3306/test_database'),
      /must use a PostgreSQL connection string/,
    );
  });

  it('refuses a malformed connection string without echoing the value', () => {
    assert.throws(
      () => resolveConfigurationFor(PLACEHOLDER_CREDENTIALS_URL.replace('postgresql://', '://')),
      error => {
        assert.match(error.message, /is not a valid connection string/);
        assert.equal(error.message.includes('test_password'), false);

        return true;
      },
    );
  });

  it('refuses an invalid percent-escape without echoing the value', () => {
    assert.throws(
      () => resolveConfigurationFor('postgresql://test_user:100%pure@db.example.test/test_db'),
      error => {
        assert.match(error.message, /invalid percent-escape/);
        assert.equal(error.message.includes('100%pure'), false);

        return true;
      },
    );
  });

  it('refuses a connection string that names no database', () => {
    assert.throws(
      () => resolveConfigurationFor('postgresql://db.example.test:5432/'),
      /must name a database/,
    );
  });

  it('fails clearly when DATABASE_URL is missing, and takes no value to leak', () => {
    const report = JSON.parse(
      runDatabaseProbe(
        `const { createDatabaseConnectionConfig } = require(${JSON.stringify(DATABASE_CONFIG_PATH)});
         const report = {};

         try {
           createDatabaseConnectionConfig();
           report.connectionConfig = 'built';
         } catch (error) {
           report.connectionConfig = error.message;
         }

         try {
           require(${JSON.stringify(MODELS_INDEX_PATH)});
           report.models = 'loaded';
         } catch (error) {
           report.models = error.message;
         }

         process.stdout.write(JSON.stringify(report));`,
        {},
        ['DATABASE_URL'],
      ),
    );

    for (const outcome of Object.values(report)) {
      assert.notEqual(outcome, 'built');
      assert.notEqual(outcome, 'loaded');
      assert.match(outcome, /DATABASE_URL is not set/);
    }
  });

  it('keeps the database port independent of the application port', () => {
    const report = JSON.parse(
      runDatabaseProbe(
        `const { appConfig } = require(${JSON.stringify(path.join(REPOSITORY_ROOT, 'src', 'config', 'app.config.js'))});
         const { createDatabaseConnectionConfig } = require(${JSON.stringify(DATABASE_CONFIG_PATH)});
         process.stdout.write(
           JSON.stringify({
             applicationPort: appConfig.port,
             databasePort: createDatabaseConnectionConfig().port,
           }),
         );`,
        { PORT: '8080', DATABASE_URL: PLACEHOLDER_CREDENTIALS_URL },
      ),
    );

    assert.equal(report.applicationPort, 8080);
    assert.equal(report.databasePort, 5432);
  });

  it('stays silent outside development, including under the Sequelize CLI', () => {
    const output = runDatabaseProbe(
      `const { createDatabaseConnectionConfig } = require(${JSON.stringify(DATABASE_CONFIG_PATH)});
       createDatabaseConnectionConfig().logging('SELECT 1');
       process.stdout.write('probe finished');`,
      { NODE_ENV: 'production', DATABASE_URL: PLACEHOLDER_CREDENTIALS_URL },
    );

    assert.equal(output, 'probe finished');
  });

  it('logs statements in development, where they are useful', () => {
    const output = runDatabaseProbe(
      `const { createDatabaseConnectionConfig } = require(${JSON.stringify(DATABASE_CONFIG_PATH)});
       createDatabaseConnectionConfig().logging('SELECT 1');
       process.stdout.write('probe finished');`,
      { NODE_ENV: 'development', DATABASE_URL: PLACEHOLDER_CREDENTIALS_URL },
    );

    assert.match(output, /\[sequelize] SELECT 1/);
  });
});
