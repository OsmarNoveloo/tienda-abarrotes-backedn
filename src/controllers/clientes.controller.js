const supabase = require('../config/supabase')
const { getLocalISOString } = require('../utils/dateUtils')

async function getAll(req, res, next) {
  try {
    const page = Math.max(1, parseInt(req.query.page ?? '1'))
    const pageSize = Math.max(1, Math.min(200, parseInt(req.query.pageSize ?? '20')))
    const search = (req.query.search ?? '').trim()
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1

    let query = supabase.from('clientes').select('*', { count: 'exact' }).order('nombre').range(from, to)
    if (search) query = query.or(`nombre.ilike.%${search}%,telefono.ilike.%${search}%`)

    const { data, error, count } = await query
    if (error) return next(error)

    const pageClientes = data ?? []
    const clienteIds = pageClientes.map((c) => c.id)
    let deudaMap = new Map()

    if (clienteIds.length > 0) {
      const { data: creditos } = await supabase
        .from('creditos_ventas')
        .select('cliente_id,saldo_pendiente')
        .in('cliente_id', clienteIds)
        .neq('estado', 'PAGADO')

      for (const c of creditos ?? []) {
        deudaMap.set(c.cliente_id, (deudaMap.get(c.cliente_id) ?? 0) + Number(c.saldo_pendiente))
      }
    }

    const items = pageClientes.map((c) => ({ ...c, total_deuda: deudaMap.get(c.id) ?? 0 }))
    res.json({ items, total: count ?? 0 })
  } catch (err) {
    next(err)
  }
}

async function create(req, res, next) {
  try {
    const { data, error } = await supabase
      .from('clientes')
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
      .from('clientes')
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
      .from('clientes')
      .update({ activo: false })
      .eq('id', id)

    if (error) return next(error)
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
}

async function getDeudas(req, res, next) {
  try {
    const { id } = req.params

    const { data: creditos, error: credErr } = await supabase
      .from('creditos_ventas')
      .select('id,venta_id,cliente_id,usuario_id,fecha_credito,total_credito,saldo_pendiente,estado')
      .eq('cliente_id', id)
      .neq('estado', 'PAGADO')
      .order('fecha_credito', { ascending: false })

    if (credErr) return next(credErr)
    if (!creditos?.length) return res.json([])

    const ventaIds = [...new Set(creditos.map((c) => c.venta_id).filter(Boolean))]
    const usuarioIds = [...new Set(creditos.map((c) => c.usuario_id).filter(Boolean))]
    const creditoIds = creditos.map((c) => c.id)

    const [ventasRes, usuariosRes, abonosRes] = await Promise.all([
      ventaIds.length ? supabase.from('ventas').select('id,folio').in('id', ventaIds) : Promise.resolve({ data: [] }),
      usuarioIds.length ? supabase.from('usuarios').select('id,nombre').in('id', usuarioIds) : Promise.resolve({ data: [] }),
      supabase.from('abonos_credito').select('*').in('credito_id', creditoIds).order('fecha_abono', { ascending: false }),
    ])

    const ventaMap = new Map((ventasRes.data ?? []).map((v) => [v.id, v.folio]))
    const usuarioMap = new Map((usuariosRes.data ?? []).map((u) => [u.id, u.nombre]))
    const abonosPorCredito = new Map()
    for (const a of abonosRes.data ?? []) {
      const lista = abonosPorCredito.get(a.credito_id) ?? []
      lista.push(a)
      abonosPorCredito.set(a.credito_id, lista)
    }

    const result = creditos.map((c) => ({
      ...c,
      venta_folio: ventaMap.get(c.venta_id) ?? 'N/A',
      usuario_nombre: usuarioMap.get(c.usuario_id) ?? 'Sin usuario',
      abonos: abonosPorCredito.get(c.id) ?? [],
    }))

    res.json(result)
  } catch (err) {
    next(err)
  }
}

async function getPosClientes(req, res, next) {
  try {
    const { data, error } = await supabase
      .from('clientes')
      .select('id,nombre')
      .eq('activo', true)
      .order('nombre')

    if (error) return next(error)

    const clienteIds = (data ?? []).map((c) => c.id)
    let saldoMap = new Map()

    if (clienteIds.length > 0) {
      const { data: saldosData } = await supabase
        .from('creditos_ventas')
        .select('cliente_id,saldo_pendiente')
        .in('cliente_id', clienteIds)
        .not('estado', 'in', '("PAGADO","CANCELADO")')
        .gt('saldo_pendiente', 0)

      for (const row of saldosData ?? []) {
        saldoMap.set(row.cliente_id, (saldoMap.get(row.cliente_id) ?? 0) + Number(row.saldo_pendiente))
      }
    }

    const result = (data ?? []).map((c) => ({
      id: c.id,
      nombre: c.nombre,
      saldo_deuda: saldoMap.get(c.id) ?? 0,
    }))

    res.json(result)
  } catch (err) {
    next(err)
  }
}

module.exports = { getAll, getDeudas, getPosClientes, create, update, remove }
