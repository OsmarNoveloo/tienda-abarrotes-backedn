const supabase = require('../config/supabase')
const { getLocalISOString } = require('../utils/dateUtils')

async function getCajaActual(req, res, next) {
  try {
    const { data, error } = await supabase
      .from('caja_sesiones')
      .select('*')
      .eq('estado', 'ABIERTA')
      .order('fecha_apertura', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) return next(error)
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

    if (error) return next(error)
    res.status(201).json(data)
  } catch (err) {
    next(err)
  }
}

async function cerrarCaja(req, res, next) {
  try {
    const { id } = req.params
    const { empleado_cierre_id, total_efectivo, total_tarjeta, observaciones } = req.body

    const { data: caja, error: cajaErr } = await supabase
      .from('caja_sesiones')
      .select('monto_apertura')
      .eq('id', id)
      .single()

    if (cajaErr) return next(cajaErr)

    const montoApertura = Number(caja.monto_apertura)
    const totalEfectivo = Number(total_efectivo)
    const totalTarjeta = Number(total_tarjeta)
    const totalVentas = totalEfectivo + totalTarjeta
    const efectivoEsperado = montoApertura + totalEfectivo

    const { error: corteErr } = await supabase.from('cortes_caja').insert([{
      caja_sesion_id: Number(id),
      usuario_id: empleado_cierre_id,
      fecha_corte: getLocalISOString(),
      total_ventas: Number(totalVentas.toFixed(2)),
      total_efectivo: Number(totalEfectivo.toFixed(2)),
      total_tarjeta: Number(totalTarjeta.toFixed(2)),
      total_entradas: 0,
      total_salidas: 0,
      efectivo_esperado: Number(efectivoEsperado.toFixed(2)),
      efectivo_contado: Number(efectivoEsperado.toFixed(2)),
      diferencia: 0,
      observacion: observaciones ?? null,
    }])

    if (corteErr) return next(corteErr)

    const { data, error: updateErr } = await supabase
      .from('caja_sesiones')
      .update({
        empleado_cierre_id,
        estado: 'CERRADA',
        fecha_cierre: getLocalISOString(),
      })
      .eq('id', id)
      .select()
      .single()

    if (updateErr) return next(updateErr)
    res.json(data)
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

    if (error) return next(error)
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

    const { data: ventasData, error: ventasErr } = await supabase
      .from('ventas')
      .select('id,total')
      .eq('estado', 'PAGADA')
      .eq('caja_sesion_id', caja_sesion_id)

    if (ventasErr) return next(ventasErr)

    const ventaIds = (ventasData ?? []).map((v) => v.id)
    const totalVentas = (ventasData ?? []).reduce((acc, v) => acc + Number(v.total), 0)

    let unidades = 0
    if (ventaIds.length > 0) {
      const { data: detalleData } = await supabase
        .from('venta_detalle')
        .select('cantidad')
        .in('venta_id', ventaIds)
      unidades = (detalleData ?? []).reduce((acc, d) => acc + Number(d.cantidad), 0)
    }

    const { data: sesionData } = await supabase
      .from('caja_sesiones')
      .select('monto_apertura')
      .eq('id', caja_sesion_id)
      .single()

    const montoApertura = Number(sesionData?.monto_apertura ?? 0)
    const efectivoEsperado = montoApertura + totalVentas

    const { data, error: updateErr } = await supabase
      .from('cortes_caja')
      .update({
        total_ventas: Number(totalVentas.toFixed(2)),
        total_efectivo: Number(totalVentas.toFixed(2)),
        efectivo_esperado: Number(efectivoEsperado.toFixed(2)),
        efectivo_contado: Number(efectivoEsperado.toFixed(2)),
        observacion: `Recalculado — ${ventasData?.length ?? 0} ventas, ${unidades} unidades`,
      })
      .eq('id', id)
      .select()
      .single()

    if (updateErr) return next(updateErr)
    res.json(data)
  } catch (err) {
    next(err)
  }
}

module.exports = { getCajaActual, abrirCaja, cerrarCaja, getCortes, recalcularCorte }
