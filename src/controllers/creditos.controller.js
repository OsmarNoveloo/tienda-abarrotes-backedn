const supabase = require('../config/supabase')
const { getLocalISOString } = require('../utils/dateUtils')

async function getAll(req, res, next) {
  try {
    const { data, error } = await supabase
      .from('credito_ventas')
      .select('*')
      .order('fecha_credito', { ascending: false })

    if (error) return next(error)
    res.json(data ?? [])
  } catch (err) {
    next(err)
  }
}

async function create(req, res, next) {
  try {
    const { data, error } = await supabase
      .from('credito_ventas')
      .insert([{ ...req.body, fecha_credito: getLocalISOString() }])
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
      .from('credito_ventas')
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

async function getAbonos(req, res, next) {
  try {
    const { id } = req.params
    const { data, error } = await supabase
      .from('abonos_credito')
      .select('*')
      .eq('credito_id', id)
      .order('fecha_abono', { ascending: false })

    if (error) return next(error)
    res.json(data ?? [])
  } catch (err) {
    next(err)
  }
}

async function createAbono(req, res, next) {
  try {
    const { id } = req.params
    const { data, error } = await supabase
      .from('abonos_credito')
      .insert([{ ...req.body, credito_id: Number(id), fecha_abono: getLocalISOString() }])
      .select()
      .single()

    if (error) return next(error)
    res.status(201).json(data)
  } catch (err) {
    next(err)
  }
}

module.exports = { getAll, create, update, getAbonos, createAbono }
