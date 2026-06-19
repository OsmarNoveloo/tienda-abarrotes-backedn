const supabase = require('../config/supabase')
const { getLocalISOString } = require('../utils/dateUtils')

async function getAll(req, res, next) {
  try {
    const limit = parseInt(req.query.limit ?? '50')
    const { data, error } = await supabase
      .from('ventas')
      .select('*')
      .order('fecha_venta', { ascending: false })
      .limit(limit)

    if (error) return next(error)
    res.json(data ?? [])
  } catch (err) {
    next(err)
  }
}

async function getById(req, res, next) {
  try {
    const { id } = req.params
    const [{ data: venta, error: vErr }, { data: detalle, error: dErr }, { data: pagos, error: pErr }] =
      await Promise.all([
        supabase.from('ventas').select('*').eq('id', id).single(),
        supabase.from('venta_detalle').select('*').eq('venta_id', id),
        supabase.from('venta_pagos').select('*').eq('venta_id', id),
      ])

    if (vErr) return next(vErr)
    if (dErr) return next(dErr)
    if (pErr) return next(pErr)

    res.json({ ...venta, detalle: detalle ?? [], pagos: pagos ?? [] })
  } catch (err) {
    next(err)
  }
}

async function create(req, res, next) {
  try {
    const { detalle, pagos, ...ventaData } = req.body

    const { data: venta, error: vErr } = await supabase
      .from('ventas')
      .insert([{ ...ventaData, fecha_venta: getLocalISOString() }])
      .select()
      .single()

    if (vErr) return next(vErr)

    if (detalle?.length) {
      const { error: dErr } = await supabase
        .from('venta_detalle')
        .insert(detalle.map((d) => ({ ...d, venta_id: venta.id })))
      if (dErr) return next(dErr)
    }

    if (pagos?.length) {
      const { error: pErr } = await supabase
        .from('venta_pagos')
        .insert(pagos.map((p) => ({ ...p, venta_id: venta.id, creado_en: getLocalISOString() })))
      if (pErr) return next(pErr)
    }

    res.status(201).json(venta)
  } catch (err) {
    next(err)
  }
}

async function cancelar(req, res, next) {
  try {
    const { id } = req.params
    const { data, error } = await supabase
      .from('ventas')
      .update({ estado: 'CANCELADA' })
      .eq('id', id)
      .select()
      .single()

    if (error) return next(error)
    res.json(data)
  } catch (err) {
    next(err)
  }
}

module.exports = { getAll, getById, create, cancelar }
