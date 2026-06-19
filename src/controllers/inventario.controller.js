const supabase = require('../config/supabase')
const { getLocalISOString } = require('../utils/dateUtils')

async function getMovimientos(req, res, next) {
  try {
    const limit = parseInt(req.query.limit ?? '100')
    const { data, error } = await supabase
      .from('inventario_movimientos')
      .select(`
        id, producto_id, usuario_id, tipo, cantidad,
        costo_unitario, referencia_tipo, referencia_id,
        observacion, fecha_movimiento,
        productos(nombre), usuarios(nombre)
      `)
      .order('fecha_movimiento', { ascending: false })
      .limit(limit)

    if (error) return next(error)

    const mapped = (data ?? []).map((row) => ({
      id: row.id,
      producto_id: row.producto_id,
      producto_nombre: row.productos?.nombre ?? 'Sin nombre',
      usuario_id: row.usuario_id,
      usuario_nombre: row.usuarios?.nombre ?? 'Sin usuario',
      tipo: row.tipo,
      cantidad: row.cantidad,
      costo_unitario: row.costo_unitario,
      referencia_tipo: row.referencia_tipo,
      referencia_id: row.referencia_id,
      observacion: row.observacion,
      fecha_movimiento: row.fecha_movimiento,
    }))

    res.json(mapped)
  } catch (err) {
    next(err)
  }
}

async function createMovimiento(req, res, next) {
  try {
    const { data, error } = await supabase
      .from('inventario_movimientos')
      .insert([{ ...req.body, fecha_movimiento: getLocalISOString() }])
      .select()
      .single()

    if (error) return next(error)
    res.status(201).json(data)
  } catch (err) {
    next(err)
  }
}

async function getStockActual(req, res, next) {
  try {
    const { data, error } = await supabase
      .from('vista_stock_actual')
      .select('*')
      .order('producto_nombre')

    if (error) return next(error)
    res.json(data ?? [])
  } catch (err) {
    next(err)
  }
}

async function getStockPage(req, res, next) {
  try {
    const page = Math.max(1, parseInt(req.query.page ?? '1'))
    const pageSize = Math.max(1, parseInt(req.query.pageSize ?? '20'))
    const search = (req.query.search ?? '').trim()
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1

    let query = supabase
      .from('vista_stock_actual')
      .select('*', { count: 'exact' })
      .order('producto_nombre')
      .range(from, to)

    if (search) {
      query = query.or(`producto_nombre.ilike.%${search}%,codigo_barras.ilike.%${search}%`)
    }

    const { data, error, count } = await query
    if (error) return next(error)
    res.json({ items: data ?? [], total: count ?? 0 })
  } catch (err) {
    next(err)
  }
}

async function getStockBajoCount(req, res, next) {
  try {
    const { count, error } = await supabase
      .from('vista_stock_actual')
      .select('*', { count: 'exact', head: true })
      .eq('stock_bajo', true)

    if (error) return next(error)
    res.json({ count: count ?? 0 })
  } catch (err) {
    next(err)
  }
}

module.exports = { getMovimientos, createMovimiento, getStockActual, getStockPage, getStockBajoCount }
