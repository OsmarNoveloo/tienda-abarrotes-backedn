const supabase = require('../config/supabase')
const { getLocalISOString } = require('../utils/dateUtils')

const MP_API = 'https://api.mercadopago.com'

function getToken() {
  return process.env.MP_ACCESS_TOKEN
}

function getDeviceId() {
  return process.env.MP_DEVICE_ID
}

async function crearIntento(req, res, next) {
  try {
    const { venta_id, monto, descripcion } = req.body

    if (!venta_id || !monto) {
      return res.status(400).json({ error: 'venta_id y monto son requeridos' })
    }

    const body = {
      amount: Number(monto),
      additional_info: {
        external_reference: String(venta_id),
        print_on_terminal: true,
      },
      description: descripcion ?? 'Compra tienda abarrotes',
      payment: {
        installments: 1,
        installments_cost: 'seller',
      },
    }

    const response = await fetch(
      `${MP_API}/point/integration-api/devices/${getDeviceId()}/payment-intents`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${getToken()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      }
    )

    const data = await response.json()

    if (!response.ok) {
      return res.status(response.status).json(data)
    }

    res.status(201).json(data)
  } catch (err) {
    next(err)
  }
}

async function consultarIntento(req, res, next) {
  try {
    const { intentId } = req.params

    const response = await fetch(
      `${MP_API}/point/integration-api/payment-intents/${intentId}`,
      {
        headers: { Authorization: `Bearer ${getToken()}` },
      }
    )

    const data = await response.json()

    if (!response.ok) {
      return res.status(response.status).json(data)
    }

    res.json(data)
  } catch (err) {
    next(err)
  }
}

async function cancelarIntento(req, res, next) {
  try {
    const { intentId } = req.params

    const response = await fetch(
      `${MP_API}/point/integration-api/devices/${getDeviceId()}/payment-intents/${intentId}`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${getToken()}` },
      }
    )

    if (response.status === 204) {
      return res.json({ ok: true, message: 'Intento cancelado' })
    }

    const data = await response.json()
    res.status(response.status).json(data)
  } catch (err) {
    next(err)
  }
}

async function webhook(req, res) {
  // MP requiere respuesta rápida
  res.sendStatus(200)

  try {
    const { type, data } = req.body

    if (type !== 'point_integration_ipn') return

    const intentId = data?.id
    if (!intentId) return

    const response = await fetch(
      `${MP_API}/point/integration-api/payment-intents/${intentId}`,
      {
        headers: { Authorization: `Bearer ${getToken()}` },
      }
    )

    if (!response.ok) return

    const intent = await response.json()

    // Solo procesamos intentos terminados con pago confirmado
    if (intent.state !== 'FINISHED' || !intent.payment?.id) return

    const ventaId = intent.additional_info?.external_reference
    if (!ventaId) return

    await Promise.all([
      supabase.from('venta_pagos').insert([{
        venta_id: Number(ventaId),
        metodo: 'TARJETA',
        monto: Number(intent.amount),
        referencia: String(intent.payment.id),
        creado_en: getLocalISOString(),
      }]),
      supabase
        .from('ventas')
        .update({ estado: 'PAGADA' })
        .eq('id', Number(ventaId))
        .eq('estado', 'PENDIENTE'),
    ])
  } catch (err) {
    console.error('webhook MP error:', err.message)
  }
}

module.exports = { crearIntento, consultarIntento, cancelarIntento, webhook }
