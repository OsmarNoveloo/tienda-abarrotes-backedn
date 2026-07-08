function errorHandler(err, req, res, next) {
  const status = err.status ?? 500
  const isProd = process.env.NODE_ENV === 'production'

  if (status >= 500) {
    console.error(err)
  } else {
    console.error(err.message)
  }

  const message = status >= 500 && isProd
    ? 'Error interno del servidor'
    : (err.message ?? 'Error interno del servidor')

  res.status(status).json({ error: message })
}

module.exports = errorHandler
