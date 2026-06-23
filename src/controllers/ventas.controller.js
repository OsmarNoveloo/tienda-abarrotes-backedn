const supabase = require('../config/supabase')
const { getLocalISOString } = require('../utils/dateUtils')

async function getAll(req, res, next) {
  try {
    const page = Math.max(1, parseInt(req.query.page ?? '1'))
    const pageSize = Math.max(1, parseInt(req.query.pageSize ?? '20'))
    const fechaDesde = req.query.fechaDesde
    const fechaHasta = req.query.fechaHasta
    const search = (req.query.search ?? '').trim().toLowerCase()
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1

    let query = supabase
      .from('ventas')
      .select('id,folio,fecha_venta,total,estado,usuario_id,observacion', { count: 'exact' })
      .order('fecha_venta', { ascending: false })
      .order('id', { ascending: false })

    if (fechaDesde) query = query.gte('fecha_venta', `${fechaDesde}T00:00:00`)
    if (fechaHasta) query = query.lte('fecha_venta', `${fechaHasta}T23:59:59`)

    if (search) {
      const { data: usuariosMatch } = await supabase
        .from('usuarios')
        .select('id')
        .ilike('nombre', `%${search}%`)
        .limit(1000)

      const usuarioIds = (usuariosMatch ?? []).map((u) => u.id)
      if (usuarioIds.length > 0) {
        query = query.or(`folio.ilike.%${search}%,usuario_id.in.(${usuarioIds.join(',')})`)
      } else {
        query = query.ilike('folio', `%${search}%`)
      }
    }

    const { data, error, count } = await query.range(from, to)
    if (error) return next(error)

    const usuarioIds = [...new Set((data ?? []).map((v) => v.usuario_id).filter(Boolean))]
    let usuarioMap = new Map()
    if (usuarioIds.length) {
      const { data: usuarios } = await supabase.from('usuarios').select('id,nombre').in('id', usuarioIds)
      usuarioMap = new Map((usuarios ?? []).map((u) => [u.id, u.nombre]))
    }

    const items = (data ?? []).map((row) => ({
      id: row.id,
      folio: row.folio,
      fecha_venta: row.fecha_venta,
      total: Number(row.total),
      estado: row.estado,
      usuario_nombre: usuarioMap.get(row.usuario_id) ?? 'Sin usuario',
      observacion: row.observacion ?? null,
    }))

    res.json({ items, total: count ?? 0 })
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
        supabase.from('venta_detalle').select('*, productos(nombre)').eq('venta_id', id),
        supabase.from('venta_pagos').select('*').eq('venta_id', id),
      ])

    if (vErr) return next(vErr)
    if (dErr) return next(dErr)
    if (pErr) return next(pErr)

    const mappedDetalle = (detalle ?? []).map((d) => ({
      cantidad: d.cantidad,
      precio_unitario: d.precio_unitario,
      subtotal: d.subtotal,
      producto_id: d.producto_id,
      nombre: d.productos?.nombre ?? 'Producto eliminado',
    }))

    res.json({ ...venta, detalle: mappedDetalle, pagos: pagos ?? [] })
  } catch (err) {
    next(err)
  }
}

async function create(req, res, next) {
  try {
    const { detalle, pagos, movimientos, credito, ...ventaData } = req.body

    const { data: venta, error: vErr } = await supabase
      .from('ventas')
      .insert([{ ...ventaData, fecha_venta: ventaData.fecha_venta ?? getLocalISOString() }])
      .select()
      .single()

    if (vErr) return next(vErr)

    await Promise.all([
      detalle?.length
        ? supabase.from('venta_detalle').insert(detalle.map((d) => ({ ...d, venta_id: venta.id })))
            .then(({ error }) => { if (error) console.error('venta_detalle:', error.message) })
        : Promise.resolve(),
      pagos?.length
        ? supabase.from('venta_pagos').insert(pagos.map((p) => ({ ...p, venta_id: venta.id, creado_en: getLocalISOString() })))
            .then(({ error }) => { if (error) console.error('venta_pagos:', error.message) })
        : Promise.resolve(),
      movimientos?.length
        ? supabase.from('inventario_movimientos').insert(movimientos.map((m) => ({ ...m, referencia_id: venta.id })))
            .then(({ error }) => { if (error) console.warn('inventario_movimientos:', error.message) })
        : Promise.resolve(),
      credito
        ? supabase.from('creditos_ventas').insert([{ ...credito, venta_id: venta.id }])
            .then(({ error }) => { if (error) console.warn('creditos_ventas:', error.message) })
        : Promise.resolve(),
    ])

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
