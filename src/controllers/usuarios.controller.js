const supabase = require('../config/supabase')
const { sha256Hex } = require('../utils/security')
const { getLocalISOString } = require('../utils/dateUtils')
const { registrarActividad } = require('../utils/actividad')

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

    void registrarActividad({
      usuario_id: req.user?.id,
      usuario_nombre: req.user?.nombre,
      accion: 'USUARIO_CREADO',
      entidad: 'usuarios',
      detalle: `Creó al usuario "${data.nombre}" (${data.usuario})`,
    })
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

    void registrarActividad({
      usuario_id: req.user?.id,
      usuario_nombre: req.user?.nombre,
      accion: 'USUARIO_ACTUALIZADO',
      entidad: 'usuarios',
      detalle: `Actualizó al usuario "${data.nombre}" (${data.usuario})${password ? ' incluyendo su contraseña' : ''}`,
    })
  } catch (err) {
    next(err)
  }
}

async function remove(req, res, next) {
  try {
    const { id } = req.params
    const { data, error } = await supabase
      .from('usuarios')
      .update({ estado: 'INACTIVO' })
      .eq('id', id)
      .select('nombre,usuario')
      .single()

    if (error) return next(error)
    res.json({ ok: true })

    void registrarActividad({
      usuario_id: req.user?.id,
      usuario_nombre: req.user?.nombre,
      accion: 'USUARIO_DESACTIVADO',
      entidad: 'usuarios',
      detalle: `Desactivó al usuario "${data?.nombre ?? id}" (${data?.usuario ?? ''})`,
    })
  } catch (err) {
    next(err)
  }
}

async function getRoles(req, res, next) {
  try {
    const { data, error } = await supabase.from('roles').select('id,nombre').order('nombre')
    if (error) return next(error)
    res.json(data ?? [])
  } catch (err) {
    next(err)
  }
}

module.exports = { getAll, getRoles, create, update, remove }
