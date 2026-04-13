const validateRequest = (schema) => (req, res, next) => {
  const result = schema.safeParse({
    body: req.body,
    params: req.params,
    query: req.query,
    headers: req.headers,
  });

  if (!result.success) {
    const error = new Error("Validation failed");
    error.statusCode = 400;
    error.details = result.error.flatten();
    return next(error);
  }

  req.validated = result.data;
  return next();
};

module.exports = validateRequest;
