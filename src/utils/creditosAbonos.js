const supabase = require('../config/supabase')
const { getLocalISOString } = require('./dateUtils')
const { HttpError, dbError } = require('./httpErrors')

// Margen para diferencias de redondeo entre el monto enviado y el saldo guardado
const TOLERANCIA = 0.01

const redondear = (valor) => Number(Number(valor).toFixed(2))

function generateAbonoFolio() {
  const now = new Date()
  const pad = (value) => String(value).padStart(2, '0')
  const rand = Math.floor(Math.random() * 1000).toString().padStart(3, '0')
  return `ABN-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}-${rand}`
}

async function getNombreCliente(clienteId) {
  const { data } = await supabase.from('clientes').select('nombre').eq('id', clienteId).maybeSingle()
  return data?.nombre ?? 'Cliente'
}

// Registra el abono/liquidación también como venta (PAGADA, sin productos) para que
// cuente en el total de ventas y el dashboard, ya que es dinero que sí entró a la cuenta.
// Si se pasa metodoPagoId también se guarda en venta_pagos (ej. tarjeta), con la referencia
// del pago en la terminal para poder rastrearlo.
async function crearVentaPorAbono({ usuarioId, monto, observacion, metodoPagoId, referencia }) {
  const { data: cajaAbierta } = await supabase
    .from('caja_sesiones')
    .select('id')
    .eq('estado', 'ABIERTA')
    .order('fecha_apertura', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { data: venta, error: ventaErr } = await supabase.from('ventas').insert([{
    caja_sesion_id: cajaAbierta?.id ?? null,
    usuario_id: usuarioId,
    folio: generateAbonoFolio(),
    subtotal: monto,
    descuento: 0,
    impuesto: 0,
    total: monto,
    estado: 'PAGADA',
    observacion,
    fecha_venta: getLocalISOString(),
  }]).select('id').single()

  if (ventaErr) throw ventaErr

  if (metodoPagoId) {
    const { error: pagoErr } = await supabase.from('venta_pagos').insert([{
      venta_id: venta.id,
      metodo_pago_id: metodoPagoId,
      monto,
      referencia: referencia ?? null,
      creado_en: getLocalISOString(),
    }])
    if (pagoErr) console.error('crearVentaPorAbono venta_pagos:', pagoErr.message)
  }

  return venta.id
}

// El saldo se actualiza solo si sigue siendo el mismo que se leyó (control optimista):
// si dos peticiones intentan abonar al mismo crédito a la vez, solo una lo aplica y la
// otra no deja un abono duplicado.
async function descontarSaldo(credito, monto) {
  const saldoAnterior = Number(credito.saldo_pendiente)
  const nuevoSaldo = redondear(Math.max(saldoAnterior - monto, 0))
  const nuevoEstado = nuevoSaldo <= 0 ? 'PAGADO' : 'ABONANDO'

  const { data, error } = await supabase
    .from('creditos_ventas')
    .update({ saldo_pendiente: nuevoSaldo, estado: nuevoEstado })
    .eq('id', credito.id)
    .eq('saldo_pendiente', credito.saldo_pendiente)
    .select('id')

  if (error) throw dbError('actualizar el saldo del crédito', error)
  if (!data?.length) return null

  return { nuevoSaldo, nuevoEstado, saldoAnterior }
}

async function revertirSaldo(credito) {
  await supabase
    .from('creditos_ventas')
    .update({ saldo_pendiente: credito.saldo_pendiente, estado: credito.estado })
    .eq('id', credito.id)
}

async function abonarCredito({ creditoId, monto, usuarioId, observacion, metodoPagoId }) {
  const montoNum = redondear(monto)
  if (!(montoNum > 0)) throw new HttpError(400, 'El monto debe ser mayor a 0')

  const { data: credito, error } = await supabase
    .from('creditos_ventas')
    .select('id,saldo_pendiente,estado,cliente_id')
    .eq('id', creditoId)
    .maybeSingle()

  if (error) throw dbError('consultar el crédito', error)
  if (!credito) throw new HttpError(404, 'Crédito no encontrado')
  if (credito.estado === 'CANCELADO') throw new HttpError(400, 'El crédito está cancelado')
  if (credito.estado === 'PAGADO' || Number(credito.saldo_pendiente) <= 0) {
    throw new HttpError(409, 'El crédito ya está liquidado')
  }
  if (montoNum > Number(credito.saldo_pendiente) + TOLERANCIA) {
    throw new HttpError(400, `El abono ($${montoNum.toFixed(2)}) es mayor al saldo pendiente ($${Number(credito.saldo_pendiente).toFixed(2)})`)
  }

  const resultado = await descontarSaldo(credito, montoNum)
  if (!resultado) throw new HttpError(409, 'El crédito se modificó mientras se registraba el abono. Actualiza e intenta de nuevo.')

  const { data: abono, error: abonoErr } = await supabase
    .from('abonos_credito')
    .insert([{
      credito_id: credito.id,
      usuario_id: usuarioId,
      monto: montoNum,
      fecha_abono: getLocalISOString(),
      metodo_pago_id: metodoPagoId ?? null,
      observacion: observacion ?? null,
    }])
    .select()
    .single()

  if (abonoErr) {
    await revertirSaldo(credito)
    throw dbError('registrar el abono', abonoErr)
  }

  return {
    abono,
    montoAplicado: montoNum,
    nuevoEstado: resultado.nuevoEstado,
    clienteNombre: await getNombreCliente(credito.cliente_id),
  }
}

// Reparte el monto entre los créditos pendientes del cliente, del más antiguo al más nuevo.
async function pagarDeudaCliente({ clienteId, monto, usuarioId, observacion, metodoPagoId }) {
  const montoNum = redondear(monto)
  if (!(montoNum > 0)) throw new HttpError(400, 'El monto debe ser mayor a 0')

  const { data: creditos, error } = await supabase
    .from('creditos_ventas')
    .select('id,saldo_pendiente,estado')
    .eq('cliente_id', clienteId)
    .not('estado', 'in', '("PAGADO","CANCELADO")')
    .gt('saldo_pendiente', 0)
    .order('fecha_credito', { ascending: true })
    .order('id', { ascending: true })

  if (error) throw dbError('consultar créditos del cliente', error)
  if (!creditos?.length) throw new HttpError(409, 'El cliente no tiene créditos pendientes')

  const deudaTotal = creditos.reduce((acc, c) => acc + Number(c.saldo_pendiente), 0)
  if (montoNum > deudaTotal + TOLERANCIA) {
    throw new HttpError(400, `El pago ($${montoNum.toFixed(2)}) es mayor a la deuda del cliente ($${deudaTotal.toFixed(2)})`)
  }

  let restante = montoNum
  const aplicados = []

  for (const credito of creditos) {
    if (restante <= 0.001) break
    const abonoMonto = redondear(Math.min(restante, Number(credito.saldo_pendiente)))
    const resultado = await descontarSaldo(credito, abonoMonto)
    // Si otro pago modificó este crédito al mismo tiempo, se salta para no aplicarle de más
    if (!resultado) continue
    aplicados.push({ credito, monto: abonoMonto })
    restante = redondear(restante - abonoMonto)
  }

  if (!aplicados.length) throw new HttpError(409, 'Los créditos se modificaron mientras se registraba el pago. Actualiza e intenta de nuevo.')

  const fecha = getLocalISOString()
  const { error: abonoErr } = await supabase.from('abonos_credito').insert(aplicados.map(({ credito, monto: m }) => ({
    credito_id: credito.id,
    usuario_id: usuarioId,
    monto: m,
    fecha_abono: fecha,
    metodo_pago_id: metodoPagoId ?? null,
    observacion: observacion ?? null,
  })))

  if (abonoErr) {
    for (const { credito } of aplicados) await revertirSaldo(credito)
    throw dbError('registrar los abonos', abonoErr)
  }

  return {
    abonos: aplicados.length,
    montoAplicado: redondear(montoNum - restante),
    montoSinAplicar: restante,
    clienteNombre: await getNombreCliente(clienteId),
  }
}

// Se valida antes de mandar el cobro a la terminal, para no cobrarle al cliente
// más de lo que debe ni cobrar un crédito que ya está liquidado.
async function validarPagoCredito({ creditoId, clienteId, monto }) {
  const montoNum = redondear(monto)
  if (!(montoNum > 0)) throw new HttpError(400, 'El monto debe ser mayor a 0')

  let query = supabase
    .from('creditos_ventas')
    .select('saldo_pendiente')
    .not('estado', 'in', '("PAGADO","CANCELADO")')
    .gt('saldo_pendiente', 0)
  query = creditoId ? query.eq('id', creditoId) : query.eq('cliente_id', clienteId)

  const { data, error } = await query
  if (error) throw dbError('consultar la deuda', error)

  const deuda = (data ?? []).reduce((acc, c) => acc + Number(c.saldo_pendiente), 0)
  if (deuda <= 0) throw new HttpError(409, creditoId ? 'El crédito ya está liquidado' : 'El cliente no tiene créditos pendientes')
  if (montoNum > deuda + TOLERANCIA) {
    throw new HttpError(400, `El monto ($${montoNum.toFixed(2)}) es mayor a la deuda pendiente ($${deuda.toFixed(2)})`)
  }
}

module.exports = { abonarCredito, pagarDeudaCliente, crearVentaPorAbono, validarPagoCredito }
