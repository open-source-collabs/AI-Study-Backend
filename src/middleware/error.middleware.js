const { appConfig } = require('../config/app.config');
const { HTTP_STATUS } = require('../enums/http-statuses');
const { AppError, NotFoundError } = require('../errors/app.error');

const isProduction = appConfig.nodeEnv === 'production';

const GENERIC_ERROR_MESSAGE = 'Internal server error';

// Node accepts any integer in this range as a response status. Anything outside
// it, or anything that is not an integer, cannot be sent and must never reach
// `response.status`.
const MIN_SENDABLE_STATUS_CODE = 100;
const MAX_SENDABLE_STATUS_CODE = 999;

const isSendableStatusCode = statusCode =>
  Number.isInteger(statusCode) &&
  statusCode >= MIN_SENDABLE_STATUS_CODE &&
  statusCode <= MAX_SENDABLE_STATUS_CODE;

const notFoundMiddleware = (request, response, next) => {
  const { method, originalUrl } = request;
  next(new NotFoundError(`Route ${method} ${originalUrl} does not exist`));
};

// The only place in the application that turns an error into an HTTP response.
// It classifies the error and decides what may be shown. Nothing below may
// throw: a throw here hands the request to Express's default handler, which
// answers with an HTML page containing a stack trace and absolute file paths.
//
// The four-parameter signature is what marks this as an error handler in
// Express. Dropping the unused-looking `next` would silently demote it to
// ordinary middleware and stop every error from being handled here.
const errorMiddleware = (error, request, response, next) => {
  // The status line and headers are already on the wire, so no body can be
  // written. Delegating lets Express close the connection instead of throwing
  // ERR_HTTP_HEADERS_SENT from inside the error handler itself.
  if (response.headersSent) {
    return next(error);
  }

  // Only a known operational error may drive the response. An operational error
  // carrying an unusable status is a defect at its throw site, so it is reported
  // as unexpected rather than forwarded as though it could be trusted.
  const isReportedOperationalError =
    error instanceof AppError &&
    error.isOperational === true &&
    isSendableStatusCode(error.statusCode);

  if (!isReportedOperationalError) {
    console.error(error);
  }

  const statusCode = isReportedOperationalError
    ? error.statusCode
    : HTTP_STATUS.INTERNAL_SERVER_ERROR;
  const message = isReportedOperationalError ? error.message : GENERIC_ERROR_MESSAGE;

  const errorBody = { success: false, message };

  if (!isProduction && !isReportedOperationalError) {
    errorBody.stack = error.stack;
  }

  response.status(statusCode).json(errorBody);
};

module.exports = { notFoundMiddleware, errorMiddleware };
