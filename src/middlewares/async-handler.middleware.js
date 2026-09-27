const asyncHandler = asyncRouteHandler => (request, response, next) => {
  Promise.resolve(asyncRouteHandler(request, response, next)).catch(next);
};

module.exports = { asyncHandler };
