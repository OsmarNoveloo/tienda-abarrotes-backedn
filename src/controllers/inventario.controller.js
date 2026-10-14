const supabase = require('../config/supabase')
const { getLocalISOString } = require('../utils/dateUtils')
const { dbError } = require('../utils/httpErrors')

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

    if (error) return next(dbError('consultar los movimientos de inventario', error))

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

    if (error) return next(dbError('registrar el movimiento de inventario', error))
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

    if (error) return next(dbError('consultar el stock actual', error))
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
    if (error) return next(dbError('consultar el stock', error))
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

    if (error) return next(dbError('consultar el stock bajo', error))
    res.json({ count: count ?? 0 })
  } catch (err) {
    next(err)
  }
}

async function getStockPorCodigo(req, res, next) {
  try {
    const codigo = String(req.params.codigo ?? '').trim()
    if (!codigo) return res.status(400).json({ error: 'Código requerido' })

    const { data, error } = await supabase
      .from('vista_stock_actual')
      .select('*')
      .eq('codigo_barras', codigo)
      .limit(1)
      .maybeSingle()

    if (error) return next(dbError('buscar el producto por código', error))
    if (!data) return res.status(404).json({ error: `No hay producto con el código ${codigo}` })
    res.json(data)
  } catch (err) {
    next(err)
  }
}

// Registra varios productos de una sola vez.
// ENTRADA: suma la cantidad de cada producto (recepción de mercancía).
// CONTEO: la cantidad es lo contado físicamente; se registra la diferencia contra el stock
// del sistema como ENTRADA o SALIDA, porque vista_stock_actual no toma en cuenta los AJUSTE.
async function registrarLote(req, res, next) {
  try {
    const { modo, items, observacion } = req.body
    const usuarioId = req.user?.id ?? null
    const fecha = getLocalISOString()

    // Si un producto viene repetido se suman sus cantidades
    const cantidades = new Map()
    for (const { producto_id, cantidad } of items) {
      cantidades.set(producto_id, (cantidades.get(producto_id) ?? 0) + cantidad)
    }
    const productoIds = [...cantidades.keys()]

    const { data: stockData, error: stockErr } = await supabase
      .from('vista_stock_actual')
      .select('producto_id, stock_actual')
      .in('producto_id', productoIds)

    if (stockErr) return next(dbError('consultar el stock actual', stockErr))

    const stockPorProducto = new Map((stockData ?? []).map((s) => [s.producto_id, Number(s.stock_actual)]))
    const noEncontrados = productoIds.filter((id) => !stockPorProducto.has(id))
    if (noEncontrados.length) {
      return res.status(400).json({ error: `Productos no encontrados: ${noEncontrados.join(', ')}` })
    }

    const movimientos = []
    let sinCambios = 0

    for (const [producto_id, cantidad] of cantidades) {
      const stockAnterior = stockPorProducto.get(producto_id)
      let tipo = 'ENTRADA'
      let mover = cantidad

      if (modo === 'CONTEO') {
        const diferencia = Number((cantidad - stockAnterior).toFixed(3))
        if (diferencia === 0) {
          sinCambios++
          continue
        }
        tipo = diferencia > 0 ? 'ENTRADA' : 'SALIDA'
        mover = Math.abs(diferencia)
      }

      movimientos.push({
        producto_id,
        usuario_id: usuarioId,
        tipo,
        cantidad: mover,
        referencia_tipo: null,
        referencia_id: null,
        observacion: modo === 'CONTEO'
          ? `Conteo físico: sistema ${stockAnterior}, contado ${cantidad}${observacion ? ` — ${observacion}` : ''}`
          : (observacion || 'Recepción rápida por escaneo'),
        fecha_movimiento: fecha,
      })
    }

    if (movimientos.length) {
      const { error } = await supabase.from('inventario_movimientos').insert(movimientos)
      if (error) return next(dbError('registrar los movimientos de inventario', error))
    }

    res.status(201).json({ registrados: movimientos.length, sinCambios })
  } catch (err) {
    next(err)
  }
}

module.exports = {
  getMovimientos,
  createMovimiento,
  getStockActual,
  getStockPage,
  getStockBajoCount,
  getStockPorCodigo,
  registrarLote,
}
