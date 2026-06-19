const supabase = require('../config/supabase')
const { getLocalISOString } = require('../utils/dateUtils')

async function getStats(req, res, next) {
  try {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayISO = getLocalISOString(today)

    const [
      { data: ventasData, error: vErr },
      { count: productosActivos, error: pErr },
      { count: stockBajo, error: sErr },
    ] = await Promise.all([
      supabase.from('ventas').select('id,total').eq('estado', 'PAGADA').gte('fecha_venta', todayISO),
      supabase.from('productos').select('id', { count: 'exact', head: true }).eq('activo', true),
      supabase.from('vista_stock_actual').select('*', { count: 'exact', head: true }).eq('stock_bajo', true),
    ])

    if (vErr) return next(vErr)
    if (pErr) return next(pErr)
    if (sErr) return next(sErr)

    const ventasHoy = (ventasData ?? []).length
    const ingresoHoy = (ventasData ?? []).reduce((acc, v) => acc + Number(v.total), 0)

    res.json({ ventasHoy, ingresoHoy, productosActivos: productosActivos ?? 0, stockBajo: stockBajo ?? 0 })
  } catch (err) {
    next(err)
  }
}

async function getUltimasVentas(req, res, next) {
  try {
    const limit = parseInt(req.query.limit ?? '5')
    const { data, error } = await supabase
      .from('ventas')
      .select('id,folio,total,usuario_id,fecha_venta')
      .order('fecha_venta', { ascending: false })
      .order('id', { ascending: false })
      .limit(limit)

    if (error) return next(error)

    const usuarioIds = [...new Set((data ?? []).map((v) => v.usuario_id).filter(Boolean))]
    const ventaIds = (data ?? []).map((v) => v.id)

    const [{ data: usuarios }, { data: detalleData }, ] = await Promise.all([
      usuarioIds.length
        ? supabase.from('usuarios').select('id,nombre').in('id', usuarioIds)
        : Promise.resolve({ data: [] }),
      ventaIds.length
        ? supabase.from('venta_detalle').select('venta_id,cantidad,producto_id').in('venta_id', ventaIds)
        : Promise.resolve({ data: [] }),
    ])

    const usuarioMap = new Map((usuarios ?? []).map((u) => [u.id, u.nombre]))
    const productoIds = [...new Set((detalleData ?? []).map((d) => d.producto_id).filter(Boolean))]

    let productosMap = new Map()
    if (productoIds.length) {
      const { data: productosData } = await supabase
        .from('productos')
        .select('id,nombre')
        .in('id', productoIds)
      productosMap = new Map((productosData ?? []).map((p) => [p.id, p.nombre]))
    }

    const detalleMap = new Map()
    for (const d of detalleData ?? []) {
      const lista = detalleMap.get(d.venta_id) ?? []
      lista.push({ nombre: productosMap.get(d.producto_id) ?? 'Producto', cantidad: Number(d.cantidad) })
      detalleMap.set(d.venta_id, lista)
    }

    const result = (data ?? []).map((v) => ({
      id: v.id,
      folio: v.folio,
      total: v.total,
      usuario_nombre: usuarioMap.get(v.usuario_id) ?? 'Sin usuario',
      fecha_venta: v.fecha_venta,
      productos: detalleMap.get(v.id) ?? [],
    }))

    res.json(result)
  } catch (err) {
    next(err)
  }
}

module.exports = { getStats, getUltimasVentas }
