const crypto = require('crypto')
const supabase = require('../config/supabase')
const { getLocalISOString } = require('../utils/dateUtils')
const { getMetodoPagoTarjetaId } = require('../utils/metodosPago')
const { HttpError, dbError, externalError } = require('../utils/httpErrors')
const { abonarCredito, pagarDeudaCliente, crearVentaPorAbono, validarPagoCredito } = require('../utils/creditosAbonos')

const MP_API = 'https://api.mercadopago.com'

function getToken() {
  return process.env.MP_ACCESS_TOKEN
}

function getDeviceId() {
  return process.env.MP_DEVICE_ID
}

async function registrarTransaccion({ intentId, ventaId, monto, estado, detalle }) {
  try {
    await supabase.from('terminal_transacciones').insert([{
      intent_id: intentId,
      venta_id: ventaId ?? null,
      device_id: getDeviceId(),
      monto,
      estado: estado ?? 'created',
      detalle: detalle ?? null,
      creado_en: getLocalISOString(),
      actualizado_en: getLocalISOString(),
    }])
  } catch (err) {
    console.error('terminal_transacciones insert:', err.message)
  }
}

async function sincronizarTransaccion(intentId, { estado, paymentId, detalle }) {
  try {
    await supabase.from('terminal_transacciones').update({
      estado,
      payment_id: paymentId ?? null,
      detalle: detalle ?? null,
      actualizado_en: getLocalISOString(),
    }).eq('intent_id', intentId)
  } catch (err) {
    console.error('terminal_transacciones update:', err.message)
  }
}

// Referencia de cobros de crédito: abn-k{creditoId}-u{usuarioId}-{ts} (un crédito)
// o abn-c{clienteId}-u{usuarioId}-{ts} (toda la deuda del cliente). Así el backend sabe a qué
// aplicar el pago sin depender de que el frontend siga abierto cuando la terminal lo apruebe.
const REF_ABONO = /^abn-([kc])(\d+)-u(\d+)-\d+$/

function parseReferenciaAbono(ref) {
  const match = REF_ABONO.exec(String(ref ?? ''))
  if (!match) return null
  return { tipo: match[1] === 'k' ? 'credito' : 'cliente', id: Number(match[2]), usuarioId: Number(match[3]) }
}

async function eliminarVenta(ventaId) {
  await supabase.from('venta_pagos').delete().eq('venta_id', ventaId)
  await supabase.from('ventas').delete().eq('id', ventaId)
}

// Aplica el abono de un cobro con terminal una sola vez por orden. El candado es
// terminal_transacciones.venta_id: quien logra ligarle la venta del abono es quien aplica;
// si el webhook y el polling llegan a la vez, el segundo deshace su venta y no duplica nada.
async function aplicarAbonoTerminal(order, payment, { tipo, id, usuarioId }) {
  let ventaId = null
  let ventaLigada = false
  try {
    const { data: transaccion } = await supabase
      .from('terminal_transacciones')
      .select('venta_id')
      .eq('intent_id', order.id)
      .maybeSingle()

    if (transaccion?.venta_id) return { ok: true, ya_aplicado: true }

    const monto = Number(payment.paid_amount ?? payment.amount)
    if (!transaccion) {
      await registrarTransaccion({ intentId: order.id, monto, estado: order.status, detalle: order })
    }

    const metodoPagoId = await getMetodoPagoTarjetaId()
    ventaId = await crearVentaPorAbono({
      usuarioId,
      monto,
      observacion: 'Pago de crédito con terminal',
      metodoPagoId,
      referencia: String(payment.id),
    })

    const { data: candado, error: candadoErr } = await supabase
      .from('terminal_transacciones')
      .update({ venta_id: ventaId, actualizado_en: getLocalISOString() })
      .eq('intent_id', order.id)
      .is('venta_id', null)
      .select('id')

    if (candadoErr) throw candadoErr
    if (!candado?.length) {
      await eliminarVenta(ventaId)
      return { ok: true, ya_aplicado: true }
    }
    ventaLigada = true

    const params = { monto, usuarioId, observacion: `Cobro con terminal (pago ${payment.id})`, metodoPagoId }
    const resultado = tipo === 'credito'
      ? await abonarCredito({ creditoId: id, ...params })
      : await pagarDeudaCliente({ clienteId: id, ...params })

    const creditos = resultado.abonos ?? 1
    await supabase
      .from('ventas')
      .update({ observacion: `Pago de crédito con terminal — ${resultado.clienteNombre} (${creditos} crédito${creditos === 1 ? '' : 's'})` })
      .eq('id', ventaId)

    return { ok: true }
  } catch (err) {
    console.error('aplicarAbonoTerminal:', err.message)
    // Se libera el candado para poder reintentar; el cobro queda en terminal_transacciones
    // como 'processed' sin venta ligada, así se puede rastrear.
    if (ventaId) {
      if (ventaLigada) {
        await supabase.from('terminal_transacciones').update({ venta_id: null }).eq('intent_id', order.id).eq('venta_id', ventaId)
      }
      await eliminarVenta(ventaId)
    }
    return { ok: false, error: err.expose ? err.message : 'No se pudo registrar el abono del cobro con terminal' }
  }
}

// Se llama tanto desde el webhook como desde consultarIntento (polling del frontend),
// porque el webhook depende de que Mercado Pago pueda alcanzar la URL pública del servidor.
// La referencia (payment.id) evita aplicar el pago dos veces si ambos caminos disparan casi a la vez.
// Para cobros de crédito regresa { ok, error? } para que el frontend sepa si el abono quedó registrado.
async function aplicarPagoSiCorresponde(order) {
  const payment = order.transactions?.payments?.[0]
  if (order.status !== 'processed' || !payment?.id) return null

  const referenciaAbono = parseReferenciaAbono(order.external_reference)
  if (referenciaAbono) return aplicarAbonoTerminal(order, payment, referenciaAbono)

  try {
    const ventaId = order.external_reference
    // Solo se auto-aplica cuando la referencia es un id de venta real (numérico)
    if (!ventaId || !/^\d+$/.test(String(ventaId))) return null

    // Lo crítico es marcar la venta como pagada — el dinero ya se cobró en la terminal.
    // Esto NUNCA debe depender de que se pueda resolver o insertar el detalle del método de pago.
    await supabase
      .from('ventas')
      .update({ estado: 'PAGADA' })
      .eq('id', Number(ventaId))
      .eq('estado', 'PENDIENTE')

    const { data: pagoExistente } = await supabase
      .from('venta_pagos')
      .select('id')
      .eq('referencia', String(payment.id))
      .maybeSingle()

    if (pagoExistente) return

    const metodoPagoId = await getMetodoPagoTarjetaId()
    if (!metodoPagoId) {
      console.error('aplicarPagoSiCorresponde: no se encontró metodo_pago_id para tarjeta, no se registra el detalle del pago (la venta ya quedó PAGADA)')
      return
    }

    await supabase.from('venta_pagos').insert([{
      venta_id: Number(ventaId),
      metodo_pago_id: metodoPagoId,
      monto: Number(payment.paid_amount ?? payment.amount),
      referencia: String(payment.id),
      creado_en: getLocalISOString(),
    }])
  } catch (err) {
    console.error('aplicarPagoSiCorresponde:', err.message)
  }
  return null
}

async function crearIntento(req, res, next) {
  try {
    const { venta_id, monto, descripcion, referencia, abono } = req.body

    if (!monto) {
      return res.status(400).json({ error: 'monto es requerido' })
    }

    let externalReference
    if (abono) {
      const creditoId = abono.credito_id ? Number(abono.credito_id) : null
      const clienteId = abono.cliente_id ? Number(abono.cliente_id) : null
      if (!creditoId && !clienteId) throw new HttpError(400, 'abono requiere credito_id o cliente_id')
      if (!req.user?.id) throw new HttpError(401, 'No hay sesión activa para registrar el abono')

      await validarPagoCredito({ creditoId, clienteId, monto })
      externalReference = creditoId
        ? `abn-k${creditoId}-u${req.user.id}-${Date.now()}`
        : `abn-c${clienteId}-u${req.user.id}-${Date.now()}`
    } else {
      externalReference = venta_id
        ? String(venta_id)
        : (referencia ? String(referencia).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64) : `pago-${Date.now()}`)
    }

    const body = {
      type: 'point',
      external_reference: externalReference,
      description: descripcion ?? 'Compra tienda abarrotes',
      expiration_time: 'PT10M',
      transactions: {
        payments: [{ amount: Number(monto).toFixed(2) }],
      },
      config: {
        point: {
          terminal_id: getDeviceId(),
          print_on_terminal: 'no_ticket',
        },
      },
    }

    const response = await fetch(`${MP_API}/v1/orders`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${getToken()}`,
        'Content-Type': 'application/json',
        'X-Idempotency-Key': crypto.randomUUID(),
      },
      body: JSON.stringify(body),
    })

    const data = await response.json()

    if (!response.ok) {
      return res.status(response.status).json(data)
    }

    await registrarTransaccion({
      intentId: data.id,
      ventaId: venta_id ? Number(venta_id) : null,
      monto: Number(monto),
      estado: data.status ?? 'created',
      detalle: data,
    })

    res.status(201).json(data)
  } catch (err) {
    next(err instanceof HttpError ? err : externalError('Mercado Pago', err))
  }
}

async function consultarIntento(req, res, next) {
  try {
    const { intentId } = req.params

    const response = await fetch(`${MP_API}/v1/orders/${intentId}`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    })

    const data = await response.json()

    if (!response.ok) {
      return res.status(response.status).json(data)
    }

    await sincronizarTransaccion(intentId, {
      estado: data.status,
      paymentId: data.transactions?.payments?.[0]?.id ?? null,
      detalle: data,
    })
    const aplicacion = await aplicarPagoSiCorresponde(data)

    res.json(aplicacion ? { ...data, aplicacion } : data)
  } catch (err) {
    next(externalError('Mercado Pago', err))
  }
}

// Para ventas que quedaron en PENDIENTE aunque el cobro sí se haya completado en la terminal
// (ej. se cerró la app antes de que el polling detectara "processed"). Vuelve a consultar el
// intento en Mercado Pago y aplica el pago si ya está procesado.
async function reconciliarVenta(req, res, next) {
  try {
    const { ventaId } = req.params

    const { data: venta, error: ventaErr } = await supabase
      .from('ventas')
      .select('id,estado')
      .eq('id', ventaId)
      .maybeSingle()

    if (ventaErr) return next(dbError('consultar la venta', ventaErr))
    if (!venta) return res.status(404).json({ error: 'Venta no encontrada' })

    if (venta.estado !== 'PENDIENTE') {
      return res.json({ ok: true, ventaEstado: venta.estado, mensaje: 'La venta ya no está pendiente' })
    }

    const { data: transaccion, error: tErr } = await supabase
      .from('terminal_transacciones')
      .select('intent_id')
      .eq('venta_id', ventaId)
      .order('creado_en', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (tErr) return next(dbError('consultar la transacción de terminal', tErr))
    if (!transaccion) return res.status(404).json({ error: 'No se encontró un cobro con terminal para esta venta' })

    const response = await fetch(`${MP_API}/v1/orders/${transaccion.intent_id}`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    })
    const data = await response.json()

    if (!response.ok) return res.status(response.status).json(data)

    await sincronizarTransaccion(transaccion.intent_id, {
      estado: data.status,
      paymentId: data.transactions?.payments?.[0]?.id ?? null,
      detalle: data,
    })
    await aplicarPagoSiCorresponde(data)

    const { data: ventaActualizada } = await supabase.from('ventas').select('id,estado').eq('id', ventaId).maybeSingle()

    res.json({ ok: true, estadoOrden: data.status, ventaEstado: ventaActualizada?.estado ?? venta.estado })
  } catch (err) {
    next(externalError('Mercado Pago', err))
  }
}

async function cancelarIntento(req, res, next) {
  try {
    const { intentId } = req.params

    const response = await fetch(`${MP_API}/v1/orders/${intentId}/cancel`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${getToken()}` },
    })

    const data = await response.json().catch(() => null)

    if (!response.ok) {
      return res.status(response.status).json(data ?? { error: 'No se pudo cancelar el intento' })
    }

    await sincronizarTransaccion(intentId, { estado: data?.status ?? 'canceled', detalle: data })

    res.json({ ok: true, message: 'Intento cancelado', data })
  } catch (err) {
    next(externalError('Mercado Pago', err))
  }
}

async function getTransacciones(req, res, next) {
  try {
    const page = Math.max(1, parseInt(req.query.page ?? '1'))
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize ?? '30')))
    const estado = req.query.estado
    const ventaId = req.query.venta_id ? Number(req.query.venta_id) : null
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1

    let query = supabase
      .from('terminal_transacciones')
      .select('id,intent_id,venta_id,device_id,monto,estado,payment_id,creado_en,actualizado_en', { count: 'exact' })
      .order('creado_en', { ascending: false })
      .range(from, to)

    if (estado) query = query.eq('estado', estado)
    if (ventaId) query = query.eq('venta_id', ventaId)

    const { data, error, count } = await query
    if (error) return next(dbError('consultar las transacciones de terminal', error))

    res.json({ items: data ?? [], total: count ?? 0 })
  } catch (err) {
    next(err)
  }
}

async function webhook(req, res) {
  // MP requiere respuesta rápida
  res.sendStatus(200)

  try {
    const { type, data } = req.body

    if (type !== 'order') return

    const orderId = data?.id
    if (!orderId) return

    const response = await fetch(`${MP_API}/v1/orders/${orderId}`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    })

    if (!response.ok) return

    const order = await response.json()
    const payment = order.transactions?.payments?.[0]

    await sincronizarTransaccion(orderId, {
      estado: order.status,
      paymentId: payment?.id ?? null,
      detalle: order,
    })

    await aplicarPagoSiCorresponde(order)
  } catch (err) {
    console.error('webhook MP error:', err.message)
  }
}

module.exports = { crearIntento, consultarIntento, cancelarIntento, reconciliarVenta, getTransacciones, webhook }
