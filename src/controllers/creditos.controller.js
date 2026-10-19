const supabase = require('../config/supabase')
const { getLocalISOString } = require('../utils/dateUtils')
const { abonarCredito, pagarDeudaCliente, crearVentaPorAbono } = require('../utils/creditosAbonos')
const { getMetodoPagoTarjetaId } = require('../utils/metodosPago')
const { dbError } = require('../utils/httpErrors')

// Se registra como venta para que el abono cuente en ventas y dashboard. Nunca debe romper
// la respuesta del abono, porque el abono ya quedó guardado.
async function registrarVentaPorAbono({ usuarioId, monto, observacion, esTarjeta }) {
  try {
    const metodoPagoId = esTarjeta ? await getMetodoPagoTarjetaId() : null
    await crearVentaPorAbono({ usuarioId, monto, observacion, metodoPagoId })
  } catch (err) {
    console.error('registrarVentaPorAbono:', err.message)
  }
}

async function getAll(req, res, next) {
  try {
    const page = Math.max(1, parseInt(req.query.page ?? '1'))
    const pageSize = Math.max(1, parseInt(req.query.pageSize ?? '20'))
    const search = (req.query.search ?? '').trim().toLowerCase()
    const filterEstado = req.query.estado
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1

    let query = supabase
      .from('creditos_ventas')
      .select('id,venta_id,cliente_id,usuario_id,fecha_credito,fecha_vencimiento,total_credito,saldo_pendiente,estado,observaciones', { count: 'exact' })

    if (filterEstado && filterEstado !== 'TODOS') {
      if (filterEstado === 'PENDIENTE') {
        query = query.gt('saldo_pendiente', 0).or('estado.eq.PENDIENTE,estado.is.null')
      } else {
        query = query.eq('estado', filterEstado)
      }
    }

    if (search) {
      const [clientesMatch, ventasMatch, usuariosMatch] = await Promise.all([
        supabase.from('clientes').select('id').ilike('nombre', `%${search}%`).limit(1000),
        supabase.from('ventas').select('id').ilike('folio', `%${search}%`).limit(1000),
        supabase.from('usuarios').select('id').ilike('nombre', `%${search}%`).limit(1000),
      ])

      const clienteIds = (clientesMatch.data ?? []).map((r) => r.id)
      const ventaIds = (ventasMatch.data ?? []).map((r) => r.id)
      const usuarioIds = (usuariosMatch.data ?? []).map((r) => r.id)

      const orParts = []
      if (clienteIds.length) orParts.push(`cliente_id.in.(${clienteIds.join(',')})`)
      if (ventaIds.length) orParts.push(`venta_id.in.(${ventaIds.join(',')})`)
      if (usuarioIds.length) orParts.push(`usuario_id.in.(${usuarioIds.join(',')})`)

      if (!orParts.length) return res.json({ items: [], total: 0 })
      query = query.or(orParts.join(','))
    }

    const { data: rows, error: creditosErr, count } = await query
      .order('fecha_credito', { ascending: false })
      .order('id', { ascending: false })
      .range(from, to)

    if (creditosErr) return next(dbError('consultar créditos', creditosErr))
    if (!rows?.length) return res.json({ items: [], total: count ?? 0 })

    const clienteIds = [...new Set(rows.map((r) => r.cliente_id).filter(Boolean))]
    const ventaIds = [...new Set(rows.map((r) => r.venta_id).filter(Boolean))]
    const usuarioIds = [...new Set(rows.map((r) => r.usuario_id).filter(Boolean))]
    const creditoIds = rows.map((r) => r.id)

    const [clientesRes, ventasRes, usuariosRes, abonosRes] = await Promise.all([
      clienteIds.length
        ? supabase.from('clientes').select('id,nombre,telefono').in('id', clienteIds)
        : Promise.resolve({ data: [] }),
      ventaIds.length
        ? supabase.from('ventas').select('id,folio').in('id', ventaIds)
        : Promise.resolve({ data: [] }),
      usuarioIds.length
        ? supabase.from('usuarios').select('id,nombre').in('id', usuarioIds)
        : Promise.resolve({ data: [] }),
      supabase
        .from('abonos_credito')
        .select('id,credito_id,usuario_id,monto,fecha_abono,metodo_pago_id,observacion')
        .in('credito_id', creditoIds)
        .order('fecha_abono', { ascending: false }),
    ])

    const clienteMap = new Map((clientesRes.data ?? []).map((c) => [c.id, c]))
    const ventaMap = new Map((ventasRes.data ?? []).map((v) => [v.id, v.folio]))
    const usuarioMap = new Map((usuariosRes.data ?? []).map((u) => [u.id, u.nombre]))

    const abonosRaw = abonosRes.data ?? []
    const abonoUsuarioIds = [...new Set(abonosRaw.map((a) => a.usuario_id).filter(Boolean))]
    let abonoUsuarioMap = new Map()
    if (abonoUsuarioIds.length) {
      const { data: abonoUsers } = await supabase.from('usuarios').select('id,nombre').in('id', abonoUsuarioIds)
      abonoUsuarioMap = new Map((abonoUsers ?? []).map((u) => [u.id, u.nombre]))
    }

    const abonosPorCredito = new Map()
    for (const abono of abonosRaw) {
      const lista = abonosPorCredito.get(abono.credito_id) ?? []
      lista.push({ ...abono, usuario_nombre: abonoUsuarioMap.get(abono.usuario_id) ?? 'Sin usuario' })
      abonosPorCredito.set(abono.credito_id, lista)
    }

    const items = rows.map((row) => {
      const abonos = abonosPorCredito.get(row.id) ?? []
      const totalAbonado = abonos.reduce((acc, a) => acc + Number(a.monto), 0)
      const saldoActual = Math.max(Number(row.saldo_pendiente ?? 0), 0)
      const estado = row.estado ?? (saldoActual <= 0 ? 'PAGADO' : abonos.length > 0 ? 'ABONANDO' : 'PENDIENTE')

      return {
        ...row,
        cliente_nombre: clienteMap.get(row.cliente_id)?.nombre ?? 'Sin cliente',
        cliente_telefono: clienteMap.get(row.cliente_id)?.telefono ?? null,
        venta_folio: ventaMap.get(row.venta_id) ?? 'N/A',
        usuario_nombre: usuarioMap.get(row.usuario_id) ?? 'Sin usuario',
        abonos,
        total_abonado: totalAbonado,
        saldo_actual: saldoActual,
        estado_normalizado: estado,
      }
    })

    res.json({ items, total: count ?? 0 })
  } catch (err) {
    next(err)
  }
}

async function getClientesDeuda(req, res, next) {
  try {
    const { data, error } = await supabase
      .from('creditos_ventas')
      .select('cliente_id,saldo_pendiente')
      .not('estado', 'in', '("PAGADO","CANCELADO")')
      .gt('saldo_pendiente', 0)

    if (error) return next(dbError('consultar la deuda por cliente', error))

    const byCliente = new Map()
    for (const row of data ?? []) {
      const prev = byCliente.get(row.cliente_id) ?? { total: 0, count: 0 }
      byCliente.set(row.cliente_id, { total: prev.total + Number(row.saldo_pendiente), count: prev.count + 1 })
    }

    if (!byCliente.size) return res.json([])

    const clienteIds = [...byCliente.keys()]
    const { data: clientesData, error: clientesErr } = await supabase
      .from('clientes')
      .select('id,nombre,telefono')
      .in('id', clienteIds)

    if (clientesErr) return next(dbError('consultar clientes con deuda', clientesErr))

    const clienteMap = new Map((clientesData ?? []).map((c) => [c.id, c]))

    const result = clienteIds
      .map((id) => {
        const agg = byCliente.get(id)
        const cliente = clienteMap.get(id)
        return {
          cliente_id: id,
          cliente_nombre: cliente?.nombre ?? 'Sin nombre',
          cliente_telefono: cliente?.telefono ?? null,
          total_deuda: agg.total,
          creditos_activos: agg.count,
        }
      })
      .sort((a, b) => b.total_deuda - a.total_deuda)

    res.json(result)
  } catch (err) {
    next(err)
  }
}

async function create(req, res, next) {
  try {
    const { data, error } = await supabase
      .from('creditos_ventas')
      .insert([{ ...req.body, fecha_credito: getLocalISOString() }])
      .select()
      .single()

    if (error) return next(dbError('crear el crédito', error))
    res.status(201).json(data)
  } catch (err) {
    next(err)
  }
}

async function update(req, res, next) {
  try {
    const { id } = req.params
    const { data, error } = await supabase
      .from('creditos_ventas')
      .update(req.body)
      .eq('id', id)
      .select()
      .single()

    if (error) return next(dbError('actualizar el crédito', error))
    res.json(data)
  } catch (err) {
    next(err)
  }
}

async function getAbonos(req, res, next) {
  try {
    const { id } = req.params
    const { data, error } = await supabase
      .from('abonos_credito')
      .select('*')
      .eq('credito_id', id)
      .order('fecha_abono', { ascending: false })

    if (error) return next(dbError('consultar los abonos del crédito', error))
    res.json(data ?? [])
  } catch (err) {
    next(err)
  }
}

async function createAbono(req, res, next) {
  try {
    const { id } = req.params
    const { monto, es_tarjeta, usuario_id, observacion, metodo_pago_id } = req.body
    const metodoPagoId = es_tarjeta ? await getMetodoPagoTarjetaId() : (metodo_pago_id ?? null)

    const { abono, montoAplicado, nuevoEstado, clienteNombre } = await abonarCredito({
      creditoId: Number(id),
      monto,
      usuarioId: usuario_id,
      observacion,
      metodoPagoId,
    })

    await registrarVentaPorAbono({
      usuarioId: usuario_id,
      monto: montoAplicado,
      observacion: `${nuevoEstado === 'PAGADO' ? 'Liquidación' : 'Abono'} de crédito — ${clienteNombre}${observacion ? ` | ${observacion}` : ''}`,
      esTarjeta: Boolean(es_tarjeta),
    })

    res.status(201).json(abono)
  } catch (err) {
    next(err)
  }
}

async function pagarCliente(req, res, next) {
  try {
    const { cliente_id, monto, observacion, usuario_id, es_tarjeta } = req.body
    const metodoPagoId = es_tarjeta ? await getMetodoPagoTarjetaId() : null

    const { abonos, montoAplicado, clienteNombre } = await pagarDeudaCliente({
      clienteId: Number(cliente_id),
      monto,
      usuarioId: usuario_id,
      observacion,
      metodoPagoId,
    })

    await registrarVentaPorAbono({
      usuarioId: usuario_id,
      monto: montoAplicado,
      observacion: `Pago de crédito — ${clienteNombre} (${abonos} crédito${abonos === 1 ? '' : 's'})${observacion ? ` | ${observacion}` : ''}`,
      esTarjeta: Boolean(es_tarjeta),
    })

    res.json({ ok: true, abonos, monto_aplicado: montoAplicado })
  } catch (err) {
    next(err)
  }
}

module.exports = { getAll, getClientesDeuda, create, update, getAbonos, createAbono, pagarCliente }
