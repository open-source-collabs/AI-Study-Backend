// Wraps an async handler so that a rejected promise is forwarded to `next`
// instead of becoming an unhandled rejection. Its only job is that
// translation: it performs no validation, no logging, no response formatting
// and no business logic, and it never swallows an error.
//
// Express 5 already forwards rejections from handlers it invokes, so this
// wrapper is a deliberate, explicit contract rather than a workaround. It keeps
// the intent visible at every route, gives one named place to change if that
// behaviour is ever relied upon differently, and makes the pattern survive a
// future framework downgrade unchanged.
//
// A synchronous throw from the wrapped function is caught by Express itself, so
// the catch below only ever sees rejected promises.
const asyncHandler = asyncRouteHandler => (request, response, next) => {
  Promise.resolve(asyncRouteHandler(request, response, next)).catch(next);
};

module.exports = { asyncHandler };
