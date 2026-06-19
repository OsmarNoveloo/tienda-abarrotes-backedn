const supabase = require('../config/supabase')
const { getLocalISOString } = require('../utils/dateUtils')

async function getAll(req, res, next) {
  try {
    const { data, error } = await supabase
      .from('proveedores')
      .select('*')
      .order('nombre')

    if (error) return next(error)
    res.json(data ?? [])
  } catch (err) {
    next(err)
  }
}

async function create(req, res, next) {
  try {
    const { data, error } = await supabase
      .from('proveedores')
      .insert([{ ...req.body, creado_en: getLocalISOString() }])
      .select()
      .single()

    if (error) return next(error)
    res.status(201).json(data)
  } catch (err) {
    next(err)
  }
}

async function update(req, res, next) {
  try {
    const { id } = req.params
    const { data, error } = await supabase
      .from('proveedores')
      .update(req.body)
      .eq('id', id)
      .select()
      .single()

    if (error) return next(error)
    res.json(data)
  } catch (err) {
    next(err)
  }
}

async function remove(req, res, next) {
  try {
    const { id } = req.params
    const { error } = await supabase
      .from('proveedores')
      .update({ activo: false })
      .eq('id', id)

    if (error) return next(error)
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
}

async function getPagos(req, res, next) {
  try {
    const { id } = req.params
    const { data, error } = await supabase
      .from('proveedor_pagos')
      .select('*')
      .eq('proveedor_id', id)
      .order('fecha', { ascending: false })

    if (error) return next(error)
    res.json(data ?? [])
  } catch (err) {
    next(err)
  }
}

async function createPago(req, res, next) {
  try {
    const { id } = req.params
    const { data, error } = await supabase
      .from('proveedor_pagos')
      .insert([{ ...req.body, proveedor_id: Number(id), creado_en: getLocalISOString() }])
      .select()
      .single()

    if (error) return next(error)
    res.status(201).json(data)
  } catch (err) {
    next(err)
  }
}

async function getPedidos(req, res, next) {
  try {
    const { id } = req.params
    const { data, error } = await supabase
      .from('proveedor_pedidos')
      .select('*')
      .eq('proveedor_id', id)
      .order('fecha', { ascending: false })

    if (error) return next(error)
    res.json(data ?? [])
  } catch (err) {
    next(err)
  }
}

async function createPedido(req, res, next) {
  try {
    const { id } = req.params
    const { data, error } = await supabase
      .from('proveedor_pedidos')
      .insert([{ ...req.body, proveedor_id: Number(id), creado_en: getLocalISOString() }])
      .select()
      .single()

    if (error) return next(error)
    res.status(201).json(data)
  } catch (err) {
    next(err)
  }
}

module.exports = { getAll, create, update, remove, getPagos, createPago, getPedidos, createPedido }
