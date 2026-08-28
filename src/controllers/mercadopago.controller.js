const crypto = require('crypto')
const supabase = require('../config/supabase')
const { getLocalISOString } = require('../utils/dateUtils')

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

// Se llama tanto desde el webhook como desde consultarIntento (polling del frontend),
// porque el webhook depende de que Mercado Pago pueda alcanzar la URL pública del servidor.
// La referencia (payment.id) evita aplicar el pago dos veces si ambos caminos disparan casi a la vez.
async function aplicarPagoSiCorresponde(order) {
  try {
    const payment = order.transactions?.payments?.[0]
    if (order.status !== 'processed' || !payment?.id) return

    const ventaId = order.external_reference
    if (!ventaId) return

    const { data: pagoExistente } = await supabase
      .from('venta_pagos')
      .select('id')
      .eq('referencia', String(payment.id))
      .maybeSingle()

    if (pagoExistente) return

    await Promise.all([
      supabase.from('venta_pagos').insert([{
        venta_id: Number(ventaId),
        metodo: 'TARJETA',
        monto: Number(payment.paid_amount ?? payment.amount),
        referencia: String(payment.id),
        creado_en: getLocalISOString(),
      }]),
      supabase
        .from('ventas')
        .update({ estado: 'PAGADA' })
        .eq('id', Number(ventaId))
        .eq('estado', 'PENDIENTE'),
    ])
  } catch (err) {
    console.error('aplicarPagoSiCorresponde:', err.message)
  }
}

async function crearIntento(req, res, next) {
  try {
    const { venta_id, monto, descripcion } = req.body

    if (!venta_id || !monto) {
      return res.status(400).json({ error: 'venta_id y monto son requeridos' })
    }

    const body = {
      type: 'point',
      external_reference: String(venta_id),
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
      ventaId: Number(venta_id),
      monto: Number(monto),
      estado: data.status ?? 'created',
      detalle: data,
    })

    res.status(201).json(data)
  } catch (err) {
    next(err)
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

    sincronizarTransaccion(intentId, {
      estado: data.status,
      paymentId: data.transactions?.payments?.[0]?.id ?? null,
      detalle: data,
    })
    aplicarPagoSiCorresponde(data)

    res.json(data)
  } catch (err) {
    next(err)
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
    next(err)
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
    if (error) return next(error)

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

module.exports = { crearIntento, consultarIntento, cancelarIntento, getTransacciones, webhook }
