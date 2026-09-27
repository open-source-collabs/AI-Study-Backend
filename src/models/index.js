// Central database and model boundary.
//
// This module owns the single Sequelize instance, the model registry, and the
// one-time loading of model definitions. Everything that needs the database
// imports from here instead of constructing a connection of its own, so the
// process shares one pool and model identity stays stable.
//
// Requiring this module is what initializes the database: the connection is
// built immediately, so a missing or malformed DATABASE_URL fails here with a
// clear message rather than on the first query. Nothing in the HTTP layer
// imports this module, so the server still starts without a database.
const fs = require('node:fs/promises');
const path = require('node:path');

const { Sequelize } = require('sequelize');

const { createDatabaseConnectionConfig } = require('../config/database.config');

// A model is a file in this directory whose name ends in `.model.js`. Nothing
// else in the directory is loaded, and `index.js` cannot match because of the
// leading filename guard.
const MODEL_FILE_PATTERN = /^[^.]+\.model\.js$/;

const sequelize = new Sequelize(createDatabaseConnectionConfig());

// `sequelize.define()` already files every model it creates under
// `sequelize.models`, keyed by model name, and that object keeps its identity for
// the life of the instance. It is therefore the registry: a second map here would
// be state that can drift from the one Sequelize itself uses.
const models = sequelize.models;

let modelsLoaded = false;

// A model file exports a factory that receives the shared instance and the data
// types and defines one model, for example:
//
//   const defineStudySession = (sequelize, DataTypes) =>
//     sequelize.define('StudySession', { /* columns */ });
//
//   module.exports = defineStudySession;
//
// Taking a factory rather than letting each file register itself directly keeps
// loading explicit, so a model is never defined twice by a stray re-import, and
// this module stays the single authority on the registry.
const loadModels = async () => {
  if (modelsLoaded) {
    return models;
  }

  const entries = await fs.readdir(__dirname, { withFileTypes: true });
  const modelFiles = entries
    .filter(entry => entry.isFile() && MODEL_FILE_PATTERN.test(entry.name))
    .map(entry => path.join(__dirname, entry.name))
    .sort();

  for (const modelFile of modelFiles) {
    const defineModel = require(modelFile);

    defineModel(sequelize, Sequelize.DataTypes);
  }

  modelsLoaded = true;

  return models;
};

// Associations are wired in exactly one place, after every model exists, so a
// model never has to require a sibling that may not be loaded yet. No model
// exists yet, so there is nothing to associate; each model introduced in a later
// phase has its relationships declared here.
const defineAssociations = () => {};

// The explicit initialization boundary for database functionality: load the
// model definitions, wire their associations, then confirm the database is
// actually reachable. It is a separate step from requiring this module because
// opening a connection is only appropriate when a caller actually needs one.
const initializeDatabase = async () => {
  await loadModels();
  defineAssociations();

  await sequelize.authenticate();

  return models;
};

// Releases the pool. A server needs a way to close its connections on shutdown,
// and the pool holds sockets open, so this exists as the counterpart to
// initialization.
const closeDatabase = async () => {
  await sequelize.close();
};

module.exports = {
  sequelize,
  models,
  loadModels,
  defineAssociations,
  initializeDatabase,
  closeDatabase,
};
