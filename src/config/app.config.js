const DEFAULT_PORT = 3000;
const MIN_TCP_PORT = 1;
const MAX_TCP_PORT = 65535;
const DEFAULT_NODE_ENV = 'development';

// This module is the only place allowed to read `process.env`. `dotenv` is
// loaded by `src/app.js` before this module is required, so the environment is
// already populated when these values are resolved, exactly once, at startup.
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
