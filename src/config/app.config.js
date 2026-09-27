// Environment loading belongs to the configuration boundary, not to Express
// startup. Every consumer that needs configuration reaches the same loaded
// environment by requiring this module, so nothing depends on `src/app.js`
// having run first. This matters for entry points that never boot the HTTP
// server, such as database tooling invoked from the command line.
require('dotenv').config();

const DEFAULT_PORT = 3000;
const MIN_TCP_PORT = 1;
const MAX_TCP_PORT = 65535;
const DEFAULT_NODE_ENV = 'development';

// This module is the only place allowed to read `process.env`. Values are
// resolved once at load time, after `dotenv` has populated the environment.
const readNodeEnv = () => {
  const configuredNodeEnv = (process.env.NODE_ENV ?? '').trim();

  return configuredNodeEnv === '' ? DEFAULT_NODE_ENV : configuredNodeEnv;
};

const readPort = () => {
  const configuredPort = (process.env.PORT ?? '').trim();

  if (configuredPort === '') {
    return DEFAULT_PORT;
  }

  const port = Number(configuredPort);

  if (!Number.isInteger(port) || port < MIN_TCP_PORT || port > MAX_TCP_PORT) {
    console.warn(
      `PORT="${configuredPort}" is not a usable TCP port (expected an integer between ` +
        `${MIN_TCP_PORT} and ${MAX_TCP_PORT}); falling back to ${DEFAULT_PORT}.`,
    );

    return DEFAULT_PORT;
  }

  return port;
};

const appConfig = Object.freeze({
  nodeEnv: readNodeEnv(),
  port: readPort(),
});

module.exports = { appConfig };
