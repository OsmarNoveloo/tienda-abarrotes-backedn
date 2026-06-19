const supabase = require('../config/supabase')
const { sha256Hex } = require('../utils/security')
const { getLocalISOString } = require('../utils/dateUtils')

async function getAll(req, res, next) {
  try {
    const { data, error } = await supabase
      .from('usuarios')
      .select('id,rol_id,nombre,usuario,telefono,email,estado,creado_en,roles(nombre)')
      .order('nombre')

    if (error) return next(error)
    res.json(data ?? [])
  } catch (err) {
    next(err)
  }
}

async function create(req, res, next) {
  try {
    const { password, ...rest } = req.body
    const password_hash = sha256Hex(password)

    const { data, error } = await supabase
      .from('usuarios')
      .insert([{ ...rest, password_hash, creado_en: getLocalISOString() }])
      .select('id,rol_id,nombre,usuario,telefono,email,estado,creado_en')
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
    const { password, ...rest } = req.body

    const payload = { ...rest }
    if (password) payload.password_hash = sha256Hex(password)

    const { data, error } = await supabase
      .from('usuarios')
      .update(payload)
      .eq('id', id)
      .select('id,rol_id,nombre,usuario,telefono,email,estado,creado_en')
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
      .from('usuarios')
      .update({ estado: 'INACTIVO' })
      .eq('id', id)

    if (error) return next(error)
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
}

module.exports = { getAll, create, update, remove }
