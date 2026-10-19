const supabase = require('../config/supabase')
const { getLocalISOString } = require('../utils/dateUtils')
const { getMetodoPagoTarjetaId } = require('../utils/metodosPago')
const { getTicketData } = require('../utils/ticket')
const { buildTicketLines, DEFAULT_WIDTH } = require('../utils/ticketBuilder')
const { renderEscPos } = require('../utils/ticketEscpos')
const { renderTicketPdf } = require('../utils/ticketPdf')
const { HttpError, dbError, notFound } = require('../utils/httpErrors')
const { verificarCobroAntesDeCancelar } = require('./mercadopago.controller')

async function getAll(req, res, next) {
  try {
    const page = Math.max(1, parseInt(req.query.page ?? '1'))
    const pageSize = Math.max(1, parseInt(req.query.pageSize ?? '20'))
    const fechaDesde = req.query.fechaDesde
    const fechaHasta = req.query.fechaHasta
    const search = (req.query.search ?? '').trim().toLowerCase()
    const usuarioId = req.query.usuario_id ? parseInt(req.query.usuario_id) : null
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1

    let usuarioIdsForSearch = []
    if (search) {
      const { data: usuariosMatch } = await supabase
        .from('usuarios')
        .select('id')
        .ilike('nombre', `%${search}%`)
        .limit(1000)
      usuarioIdsForSearch = (usuariosMatch ?? []).map((u) => u.id)
    }

    const applyFilters = (q) => {
      if (fechaDesde) q = q.gte('fecha_venta', `${fechaDesde}T00:00:00`)
      if (fechaHasta) q = q.lte('fecha_venta', `${fechaHasta}T23:59:59`)
      if (usuarioId) q = q.eq('usuario_id', usuarioId)
      if (search) {
        if (usuarioIdsForSearch.length > 0) {
          q = q.or(`folio.ilike.%${search}%,usuario_id.in.(${usuarioIdsForSearch.join(',')})`)
        } else {
          q = q.ilike('folio', `%${search}%`)
        }
      }
      return q
    }

    const listQuery = applyFilters(
      supabase.from('ventas').select('id,folio,fecha_venta,total,estado,usuario_id,observacion', { count: 'exact' }),
    )
      .order('fecha_venta', { ascending: false })
      .order('id', { ascending: false })
      .range(from, to)

    const { data, error, count } = await listQuery
    if (error) return next(dbError('consultar ventas', error))

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

    // Suma y conteo de pagadas sobre todo el conjunto filtrado, no solo la página actual
    const totalRows = count ?? 0
    let sumTotal = 0
    let totalPagadas = 0
    const ventaIds = []
    const batchSize = 1000
    for (let start = 0; start < totalRows; start += batchSize) {
      const end = Math.min(start + batchSize, totalRows) - 1
      const { data: batch, error: batchErr } = await applyFilters(
        supabase.from('ventas').select('id,total,estado'),
      ).range(start, end)
      if (batchErr) return next(dbError('calcular los totales de ventas', batchErr))
      // Solo cuenta lo cobrado: las ventas a crédito se guardan como CANCELADA y su dinero
      // entra después como venta ABN- al abonar; las pendientes aún no se cobran.
      for (const row of batch ?? []) {
        if (row.estado !== 'PAGADA') continue
        sumTotal += Number(row.total)
        totalPagadas++
        ventaIds.push(row.id)
      }
    }

    let sumTarjeta = 0
    try {
      const metodoPagoTarjetaId = await getMetodoPagoTarjetaId()
      if (metodoPagoTarjetaId && ventaIds.length > 0) {
        for (let start = 0; start < ventaIds.length; start += batchSize) {
          const idsBatch = ventaIds.slice(start, start + batchSize)
          const { data: pagosBatch, error: pagosErr } = await supabase
            .from('venta_pagos')
            .select('monto')
            .eq('metodo_pago_id', metodoPagoTarjetaId)
            .in('venta_id', idsBatch)
          if (pagosErr) throw pagosErr
          for (const row of pagosBatch ?? []) sumTarjeta += Number(row.monto)
        }
      }
    } catch (err) {
      // No dejar caer todo /ventas si venta_pagos falla
      console.error('venta_pagos (tarjeta):', err.message)
      sumTarjeta = 0
    }

    res.json({ items, total: totalRows, sumTotal, totalPagadas, sumTarjeta })
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

    if (vErr) return next(dbError('consultar la venta', vErr))
    if (dErr) return next(dbError('consultar el detalle de la venta', dErr))
    if (pErr) return next(dbError('consultar los pagos de la venta', pErr))

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

// Borra todo lo que se alcanzó a guardar de una venta incompleta
async function deshacerVenta(ventaId) {
  await Promise.all([
    supabase.from('venta_detalle').delete().eq('venta_id', ventaId),
    supabase.from('venta_pagos').delete().eq('venta_id', ventaId),
    supabase.from('creditos_ventas').delete().eq('venta_id', ventaId),
    supabase.from('inventario_movimientos').delete().eq('referencia_tipo', 'VENTA').eq('referencia_id', ventaId),
  ])
  await supabase.from('ventas').delete().eq('id', ventaId)
}

async function create(req, res, next) {
  try {
    const { detalle, pagos, movimientos, credito, ...ventaData } = req.body

    // El POS reenvía las ventas de la cola offline; si la primera vez sí se guardó (solo se
    // perdió la respuesta) se regresa la misma venta en vez de duplicarla con su inventario.
    if (ventaData.folio) {
      const { data: existentes, error: folioErr } = await supabase
        .from('ventas')
        .select('*')
        .eq('folio', ventaData.folio)
        .limit(1)

      if (folioErr) return next(dbError('verificar el folio de la venta', folioErr))
      const existente = existentes?.[0]
      if (existente) {
        const mismaVenta = Number(existente.total) === Number(ventaData.total)
          && Number(existente.usuario_id) === Number(ventaData.usuario_id)
        if (mismaVenta) return res.status(200).json(existente)
        return next(new HttpError(409, `Ya existe otra venta con el folio ${ventaData.folio}`))
      }
    }

    const { data: venta, error: vErr } = await supabase
      .from('ventas')
      .insert([{ ...ventaData, fecha_venta: ventaData.fecha_venta ?? getLocalISOString() }])
      .select()
      .single()

    if (vErr) return next(dbError('registrar la venta', vErr))

    // Si falla cualquier parte (sobre todo el crédito o el inventario) se deshace la venta
    // completa: es mejor que el POS reintente a que quede una deuda o un stock sin registrar.
    const resultados = await Promise.all([
      detalle?.length
        ? supabase.from('venta_detalle').insert(detalle.map((d) => ({ ...d, venta_id: venta.id })))
        : null,
      pagos?.length
        ? supabase.from('venta_pagos').insert(pagos.map((p) => ({ ...p, venta_id: venta.id, creado_en: getLocalISOString() })))
        : null,
      movimientos?.length
        ? supabase.from('inventario_movimientos').insert(movimientos.map((m) => ({ ...m, referencia_id: venta.id })))
        : null,
      credito
        ? supabase.from('creditos_ventas').insert([{ ...credito, venta_id: venta.id }])
        : null,
    ])

    const partes = ['el detalle', 'los pagos', 'el inventario', 'el crédito']
    const fallo = resultados.findIndex((r) => r?.error)
    if (fallo !== -1) {
      await deshacerVenta(venta.id)
      return next(dbError(`guardar ${partes[fallo]} de la venta`, resultados[fallo].error))
    }

    res.status(201).json(venta)
  } catch (err) {
    next(err)
  }
}

// Regresa al inventario lo que salió por la venta. Se marca con referencia_tipo
// CANCELACION_VENTA para no regresarlo dos veces si se llama de nuevo.
async function revertirInventarioVenta(ventaId, usuarioId) {
  const { data: yaRevertido } = await supabase
    .from('inventario_movimientos')
    .select('id')
    .eq('referencia_tipo', 'CANCELACION_VENTA')
    .eq('referencia_id', ventaId)
    .limit(1)

  if (yaRevertido?.length) return

  const { data: salidas, error } = await supabase
    .from('inventario_movimientos')
    .select('producto_id,cantidad,costo_unitario,usuario_id')
    .eq('referencia_tipo', 'VENTA')
    .eq('referencia_id', ventaId)
    .eq('tipo', 'SALIDA')

  if (error) throw dbError('consultar el inventario de la venta', error)
  if (!salidas?.length) return

  const fecha = getLocalISOString()
  const { error: insertErr } = await supabase.from('inventario_movimientos').insert(salidas.map((m) => ({
    producto_id: m.producto_id,
    usuario_id: usuarioId ?? m.usuario_id,
    tipo: 'ENTRADA',
    cantidad: m.cantidad,
    costo_unitario: m.costo_unitario,
    referencia_tipo: 'CANCELACION_VENTA',
    referencia_id: ventaId,
    observacion: `Regreso por cancelación de venta ${ventaId}`,
    fecha_movimiento: fecha,
  })))

  if (insertErr) throw dbError('regresar el inventario de la venta', insertErr)
}

async function cancelar(req, res, next) {
  try {
    const id = Number(req.params.id)

    const { data: venta, error: ventaErr } = await supabase
      .from('ventas')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (ventaErr) return next(dbError('consultar la venta', ventaErr))
    if (!venta) return next(notFound('Venta'))
    if (venta.estado === 'CANCELADA') return res.json(venta)

    const bloqueo = await verificarCobroAntesDeCancelar(id)
    if (bloqueo) return next(new HttpError(409, bloqueo))

    // Solo cancela si nadie la cambió mientras tanto (ej. el webhook la marcó PAGADA)
    const { data: actualizada, error } = await supabase
      .from('ventas')
      .update({ estado: 'CANCELADA' })
      .eq('id', id)
      .eq('estado', venta.estado)
      .select()

    if (error) return next(dbError('cancelar la venta', error))
    if (!actualizada?.length) return next(new HttpError(409, 'La venta cambió de estado mientras se cancelaba. Actualiza e intenta de nuevo.'))

    await revertirInventarioVenta(id, req.user?.id)
    res.json(actualizada[0])
  } catch (err) {
    next(err)
  }
}

async function getTicketRaw(req, res, next) {
  try {
    const { id } = req.params
    const ticketData = await getTicketData(id)
    const lines = buildTicketLines(ticketData, DEFAULT_WIDTH)
    const buffer = await renderEscPos(lines)

    res.json({
      folio: ticketData.venta.folio ?? ticketData.venta.id,
      ancho_columnas: DEFAULT_WIDTH,
      escpos_base64: buffer.toString('base64'),
    })
  } catch (err) {
    next(err)
  }
}

async function getTicketPdf(req, res, next) {
  try {
    const { id } = req.params
    const ticketData = await getTicketData(id)
    const lines = buildTicketLines(ticketData, DEFAULT_WIDTH)

    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `inline; filename="ticket-${ticketData.venta.folio ?? id}.pdf"`)

    const doc = renderTicketPdf(lines, DEFAULT_WIDTH)
    doc.pipe(res)
  } catch (err) {
    next(err)
  }
}

module.exports = { getAll, getById, create, cancelar, getTicketRaw, getTicketPdf }
