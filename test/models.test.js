const assert = require('node:assert/strict');
const path = require('node:path');
const { describe, it } = require('node:test');

// Fixture only: no real host, account or password is used here.
process.env.DATABASE_URL = 'postgresql://db.example.test:5432/test_database';

const {
  sequelize,
  models,
  loadModels,
  defineAssociations,
  closeDatabase,
} = require('../src/models/index.js');

const APP_ENTRY_POINT = path.join(path.sep, 'src', 'app.js');

describe('sequelize model boundary', () => {
  it('exposes a PostgreSQL instance built from the database configuration', () => {
    assert.equal(sequelize.getDialect(), 'postgres');
    assert.equal(sequelize.options.database, 'test_database');
    assert.equal(sequelize.options.pool.max, 5);
    assert.equal(sequelize.options.define.underscored, true);
    assert.equal(sequelize.options.dialectOptions.ssl.require, true);
  });

  it('registers no domain model before the phase that introduces one', async () => {
    await loadModels();
    defineAssociations();

    assert.deepEqual(Object.keys(models), []);
    assert.equal(sequelize.models, models);
  });

  it('never relies on sequelize.sync(), because migrations own the schema', async () => {
    let syncCalls = 0;
    const originalSync = sequelize.sync;

    sequelize.sync = (...arguments_) => {
      syncCalls += 1;

      return originalSync.apply(sequelize, arguments_);
    };

    try {
      await loadModels();
      defineAssociations();
    } finally {
      sequelize.sync = originalSync;
    }

    assert.equal(syncCalls, 0);
  });

  it('does not reach for the Express entry point', () => {
    const loadedModulePaths = Object.keys(require.cache);

    assert.equal(
      loadedModulePaths.some(modulePath => modulePath.endsWith(APP_ENTRY_POINT)),
      false,
    );
  });

  it('closes cleanly even though no connection was ever opened', async () => {
    await closeDatabase();
  });
});
