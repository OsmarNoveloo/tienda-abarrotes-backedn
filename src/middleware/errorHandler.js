function errorHandler(err, req, res, next) {
  const status = err.status ?? 500
  const isProd = process.env.NODE_ENV === 'production'

  if (status >= 500) {
    console.error(err)
  } else {
    console.error(err.message)
  }

  // Solo se expone el mensaje real en producción si el error fue creado a propósito
  // (err.expose === true, ver src/utils/httpErrors.js). Un error inesperado (bug no
  // previsto) sigue mostrando el mensaje genérico para no filtrar detalles internos.
  const canExpose = !isProd || status < 500 || err.expose === true
  const message = canExpose ? (err.message || 'Error interno del servidor') : 'Error interno del servidor'

  res.status(status).json({ error: message })
}

module.exports = errorHandler
