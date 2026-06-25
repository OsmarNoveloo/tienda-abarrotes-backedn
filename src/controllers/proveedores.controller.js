const supabase = require('../config/supabase')
const { getLocalISOString } = require('../utils/dateUtils')

async function getAll(req, res, next) {
  try {
    const page = Math.max(1, parseInt(req.query.page ?? '1'))
    const pageSize = Math.max(1, parseInt(req.query.pageSize ?? '20'))
    const search = (req.query.search ?? '').trim()
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1

    let query = supabase
      .from('proveedores')
      .select('*', { count: 'exact' })
      .order('activo', { ascending: false })
      .order('nombre')
      .range(from, to)

    if (search) {
      query = query.or(`nombre.ilike.%${search}%,telefono.ilike.%${search}%,email.ilike.%${search}%`)
    }

    const { data, error, count } = await query
    if (error) return next(error)
    res.json({ items: data ?? [], total: count ?? 0 })
  } catch (err) {
    next(err)
  }
}

async function getSemana(req, res, next) {
  try {
    const { from, to } = req.query
    const usuarioId = req.query.usuario_id ? parseInt(req.query.usuario_id) : null

    let pagosQuery = supabase.from('proveedor_pagos').select('*').gte('fecha', from).lte('fecha', to)
    if (usuarioId) pagosQuery = pagosQuery.eq('usuario_id', usuarioId)

    const [pagosRes, pedidosRes] = await Promise.all([
      pagosQuery,
      supabase.from('proveedor_pedidos').select('*').gte('fecha', from).lte('fecha', to),
    ])
    if (pagosRes.error) return next(pagosRes.error)
    if (pedidosRes.error) return next(pedidosRes.error)
    res.json({ pagos: pagosRes.data ?? [], pedidos: pedidosRes.data ?? [] })
  } catch (err) {
    next(err)
  }
}

async function updatePedido(req, res, next) {
  try {
    const { pedidoId } = req.params
    const { data, error } = await supabase
      .from('proveedor_pedidos')
      .update({ pedido: req.body.pedido })
      .eq('id', pedidoId)
      .select()
      .single()
    if (error) return next(error)
    res.json(data)
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
      .insert([{ ...req.body, proveedor_id: Number(id), usuario_id: req.user.id, creado_en: getLocalISOString() }])
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

module.exports = { getAll, getSemana, create, update, remove, getPagos, createPago, getPedidos, createPedido, updatePedido }
