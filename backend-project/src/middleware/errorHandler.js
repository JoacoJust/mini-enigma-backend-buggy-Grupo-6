function notFound(req, res, next) {
  res.status(404).json({ error: `Ruta no encontrada: ${req.originalUrl}` });
}

function errorHandler(err, req, res, next) {
  console.error(err);

  res.status(err.statusCode || 500).json({
    error: err.message,
    stack: err.stack,
  });
}

module.exports = { notFound, errorHandler };
