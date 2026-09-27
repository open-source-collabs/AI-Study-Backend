const { appConfig } = require('../config/app.config');
const { HTTP_STATUS } = require('../enums/http-statuses');
const { AppError } = require('../errors/app.error');

const isProduction = appConfig.nodeEnv === 'production';

const notFoundMiddleware = (request, response, next) => {
  const { method, originalUrl } = request;
  next(new AppError(`Route ${method} ${originalUrl} does not exist`, HTTP_STATUS.NOT_FOUND));
};

const errorMiddleware = (error, request, response, next) => {
  const isOperationalError = error instanceof AppError && error.isOperational === true;
  const statusCode = isOperationalError ? error.statusCode : HTTP_STATUS.INTERNAL_SERVER_ERROR;
  const message = isOperationalError ? error.message : 'Internal server error';

  if (!isOperationalError) {
    console.error(error);
  }

  const errorBody = { success: false, message };

  if (!isProduction && !isOperationalError) {
    errorBody.stack = error.stack;
  }

  response.status(statusCode).json(errorBody);
};

module.exports = { notFoundMiddleware, errorMiddleware };
