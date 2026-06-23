const supabase = require('../config/supabase')
const { getLocalISOString } = require('../utils/dateUtils')

async function getAll(req, res, next) {
  try {
    const { data, error } = await supabase
      .from('clientes')
      .select('*')
      .order('nombre')

    if (error) return next(error)
    res.json(data ?? [])
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

module.exports = { getAll, getPosClientes, create, update, remove }
