// Errores con mensaje seguro para mostrar al usuario (err.expose = true).
// Los errores "inesperados" (bugs, excepciones no previstas) NO deben usar esto:
// deben seguir cayendo al mensaje genérico de errorHandler para no filtrar detalles internos.
class HttpError extends Error {
  constructor(status, message, { cause } = {}) {
    super(message)
    this.status = status
    this.expose = true
    if (cause) this.cause = cause
  }
}

// Para cuando falla una consulta/insert/update a Supabase — agrega contexto de qué
// operación se intentaba hacer, en vez de mostrar siempre "Error interno del servidor".
function dbError(context, error) {
  const detalle = error?.message ? `: ${error.message}` : ''
  return new HttpError(500, `Error de base de datos al ${context}${detalle}`, { cause: error })
}

// Para cuando falla una llamada a un servicio externo (Mercado Pago, etc.)
function externalError(servicio, error) {
  const detalle = error?.message ? `: ${error.message}` : ''
  return new HttpError(502, `No se pudo conectar con ${servicio}${detalle}`, { cause: error })
}

function notFound(entidad = 'Recurso') {
  return new HttpError(404, `${entidad} no encontrado`)
}

module.exports = { HttpError, dbError, externalError, notFound }
