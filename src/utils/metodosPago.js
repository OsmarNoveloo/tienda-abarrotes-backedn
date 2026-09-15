const supabase = require('../config/supabase')

let tarjetaIdCache = null

// Se resuelve por nombre en vez de fijar el id a mano, para no depender de cómo haya
// quedado sembrado el catálogo metodos_pago en cada ambiente.
async function getMetodoPagoTarjetaId() {
  if (tarjetaIdCache !== null) return tarjetaIdCache

  const { data, error } = await supabase
    .from('metodos_pago')
    .select('id')
    .ilike('nombre', '%tarjeta%')
    .limit(1)
    .maybeSingle()

  if (error || !data) {
    console.error('getMetodoPagoTarjetaId:', error?.message ?? 'No se encontró método de pago "tarjeta" en el catálogo')
    return null
  }

  tarjetaIdCache = data.id
  return tarjetaIdCache
}

module.exports = { getMetodoPagoTarjetaId }
