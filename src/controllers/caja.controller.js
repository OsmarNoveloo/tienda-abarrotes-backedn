const supabase = require('../config/supabase')
const { getLocalISOString } = require('../utils/dateUtils')
const { getMetodoPagoTarjetaId } = require('../utils/metodosPago')
const { HttpError, dbError } = require('../utils/httpErrors')

const redondear = (valor) => Number(Number(valor).toFixed(2))

// Totales de una sesión de caja calculados desde las ventas PAGADAS (incluye abonos ABN-).
// Lo cobrado con tarjeta sale de venta_pagos; el resto se considera efectivo.
async function calcularTotalesCaja(cajaSesionId, { usuarioId } = {}) {
  let query = supabase
    .from('ventas')
    .select('id,total')
    .eq('estado', 'PAGADA')
    .eq('caja_sesion_id', cajaSesionId)
  if (usuarioId) query = query.eq('usuario_id', usuarioId)

  const { data: ventas, error } = await query
  if (error) throw dbError('consultar las ventas de la caja', error)

  const ventaIds = (ventas ?? []).map((v) => v.id)
  const totalVentas = (ventas ?? []).reduce((acc, v) => acc + Number(v.total), 0)

  let totalTarjeta = 0
  let unidades = 0
  if (ventaIds.length) {
    const metodoTarjetaId = await getMetodoPagoTarjetaId()
    const [pagosRes, detalleRes] = await Promise.all([
      metodoTarjetaId
        ? supabase.from('venta_pagos').select('monto').eq('metodo_pago_id', metodoTarjetaId).in('venta_id', ventaIds)
        : Promise.resolve({ data: [] }),
      supabase.from('venta_detalle').select('cantidad').in('venta_id', ventaIds),
    ])
    if (pagosRes.error) throw dbError('consultar los pagos con tarjeta', pagosRes.error)
    if (detalleRes.error) throw dbError('consultar las unidades vendidas', detalleRes.error)
    totalTarjeta = (pagosRes.data ?? []).reduce((acc, p) => acc + Number(p.monto), 0)
    unidades = (detalleRes.data ?? []).reduce((acc, d) => acc + Number(d.cantidad), 0)
  }

  return {
    numVentas: ventaIds.length,
    unidades,
    totalVentas: redondear(totalVentas),
    totalTarjeta: redondear(totalTarjeta),
    totalEfectivo: redondear(totalVentas - totalTarjeta),
  }
}

async function getCajaActual(req, res, next) {
  try {
    const { data, error } = await supabase
      .from('caja_sesiones')
      .select('*')
      .eq('estado', 'ABIERTA')
      .order('fecha_apertura', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) return next(dbError('consultar la caja actual', error))
    if (!data) return res.json(null)

    const { data: usuario } = await supabase
      .from('usuarios')
      .select('nombre')
      .eq('id', data.empleado_apertura_id)
      .single()

    res.json({ ...data, usuario_nombre: usuario?.nombre ?? 'Sin usuario' })
  } catch (err) {
    next(err)
  }
}

async function abrirCaja(req, res, next) {
  try {
    const { empleado_apertura_id, monto_apertura } = req.body

    const { data: abierta, error: abiertaErr } = await supabase
      .from('caja_sesiones')
      .select('id')
      .eq('estado', 'ABIERTA')
      .limit(1)
      .maybeSingle()

    if (abiertaErr) return next(dbError('verificar si hay una caja abierta', abiertaErr))
    if (abierta) return next(new HttpError(409, 'Ya hay una caja abierta. Ciérrala antes de abrir otra.'))

    const { data, error } = await supabase
      .from('caja_sesiones')
      .insert([{
        empleado_apertura_id,
        monto_apertura,
        estado: 'ABIERTA',
        fecha_apertura: getLocalISOString(),
      }])
      .select()
      .single()

    if (error) return next(dbError('abrir la caja', error))
    res.status(201).json(data)
  } catch (err) {
    next(err)
  }
}

async function cerrarCaja(req, res, next) {
  try {
    const id = Number(req.params.id)
    const { empleado_cierre_id, efectivo_contado, observaciones } = req.body

    // Se cierra con la condición de que siga ABIERTA: si dos personas cierran a la vez,
    // solo una genera el corte.
    const { data: cerrada, error: cerrarErr } = await supabase
      .from('caja_sesiones')
      .update({ empleado_cierre_id, estado: 'CERRADA', fecha_cierre: getLocalISOString() })
      .eq('id', id)
      .eq('estado', 'ABIERTA')
      .select()

    if (cerrarErr) return next(dbError('cerrar la caja', cerrarErr))
    if (!cerrada?.length) return next(new HttpError(409, 'La caja ya está cerrada'))

    const caja = cerrada[0]

    try {
      const totales = await calcularTotalesCaja(id)
      const efectivoEsperado = redondear(Number(caja.monto_apertura) + totales.totalEfectivo)
      const huboConteo = efectivo_contado !== undefined && efectivo_contado !== null
      const efectivoContado = huboConteo ? redondear(efectivo_contado) : efectivoEsperado

      const { error: corteErr } = await supabase.from('cortes_caja').insert([{
        caja_sesion_id: id,
        usuario_id: empleado_cierre_id,
        fecha_corte: getLocalISOString(),
        total_ventas: totales.totalVentas,
        total_efectivo: totales.totalEfectivo,
        total_tarjeta: totales.totalTarjeta,
        total_entradas: 0,
        total_salidas: 0,
        efectivo_esperado: efectivoEsperado,
        efectivo_contado: efectivoContado,
        diferencia: redondear(efectivoContado - efectivoEsperado),
        observacion: [observaciones, huboConteo ? null : 'Sin conteo de efectivo'].filter(Boolean).join(' | ') || null,
      }])

      if (corteErr) throw dbError('registrar el corte de caja', corteErr)
    } catch (err) {
      // Sin corte la caja no debe quedar cerrada
      await supabase
        .from('caja_sesiones')
        .update({ empleado_cierre_id: null, estado: 'ABIERTA', fecha_cierre: null })
        .eq('id', id)
      throw err
    }

    res.json(caja)
  } catch (err) {
    next(err)
  }
}

async function getCortes(req, res, next) {
  try {
    const limit = parseInt(req.query.limit ?? '20')
    const { data, error } = await supabase
      .from('cortes_caja')
      .select('*')
      .order('id', { ascending: false })
      .limit(limit)

    if (error) return next(dbError('consultar los cortes de caja', error))
    if (!data?.length) return res.json([])

    const usuarioIds = [...new Set(data.map((c) => c.usuario_id))]
    const { data: usuarios } = await supabase
      .from('usuarios')
      .select('id,nombre')
      .in('id', usuarioIds)

    const usuarioMap = new Map((usuarios ?? []).map((u) => [u.id, u.nombre]))
    const mapped = data.map((row) => ({
      ...row,
      usuario_nombre: usuarioMap.get(row.usuario_id) ?? 'Sin usuario',
    }))

    res.json(mapped)
  } catch (err) {
    next(err)
  }
}

async function recalcularCorte(req, res, next) {
  try {
    const { id } = req.params
    const { caja_sesion_id } = req.body

    const [{ data: corte, error: corteErr }, { data: sesion, error: sesionErr }] = await Promise.all([
      supabase.from('cortes_caja').select('efectivo_esperado,efectivo_contado,diferencia').eq('id', id).single(),
      supabase.from('caja_sesiones').select('monto_apertura').eq('id', caja_sesion_id).single(),
    ])
    if (corteErr) return next(dbError('consultar el corte de caja', corteErr))
    if (sesionErr) return next(dbError('consultar la sesión de caja', sesionErr))

    const totales = await calcularTotalesCaja(caja_sesion_id)
    const efectivoEsperado = redondear(Number(sesion.monto_apertura ?? 0) + totales.totalEfectivo)

    // Si en el corte original no se contó el efectivo (contado = esperado), se mantiene así;
    // si sí se contó, se respeta lo contado y se recalcula la diferencia.
    const sinConteo = Number(corte.diferencia) === 0
      && Number(corte.efectivo_contado) === Number(corte.efectivo_esperado)
    const efectivoContado = sinConteo ? efectivoEsperado : Number(corte.efectivo_contado)

    const { data, error: updateErr } = await supabase
      .from('cortes_caja')
      .update({
        total_ventas: totales.totalVentas,
        total_efectivo: totales.totalEfectivo,
        total_tarjeta: totales.totalTarjeta,
        efectivo_esperado: efectivoEsperado,
        efectivo_contado: efectivoContado,
        diferencia: redondear(efectivoContado - efectivoEsperado),
        observacion: `Recalculado — ${totales.numVentas} ventas, ${totales.unidades} unidades`,
      })
      .eq('id', id)
      .select()
      .single()

    if (updateErr) return next(dbError('recalcular el corte de caja', updateErr))
    res.json(data)
  } catch (err) {
    next(err)
  }
}

async function getResumenCaja(req, res, next) {
  try {
    const { id } = req.params
    const usuarioId = req.query.usuario_id ? parseInt(req.query.usuario_id) : null

    let ventasQuery = supabase
      .from('ventas')
      .select('id,total,estado')
      .eq('caja_sesion_id', id)

    if (usuarioId) ventasQuery = ventasQuery.eq('usuario_id', usuarioId)

    const { data: ventasData, error: ventasErr } = await ventasQuery

    if (ventasErr) return next(dbError('consultar el resumen de caja', ventasErr))

    const ventas = ventasData ?? []
    const ventasPagadas = ventas.filter((v) => v.estado === 'PAGADA')
    const montoTotalDia = ventas.reduce((acc, v) => acc + Number(v.total), 0)

    const totales = await calcularTotalesCaja(id, { usuarioId })

    res.json({
      ventasHoy: ventasPagadas.length,
      montoHoy: totales.totalVentas,
      montoTotalDia,
      unidadesVendidasHoy: totales.unidades,
      totalEfectivo: totales.totalEfectivo,
      totalTarjeta: totales.totalTarjeta,
    })
  } catch (err) {
    next(err)
  }
}

module.exports = { getCajaActual, abrirCaja, cerrarCaja, getCortes, recalcularCorte, getResumenCaja }
