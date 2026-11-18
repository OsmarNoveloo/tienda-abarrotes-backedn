const jwt = require('jsonwebtoken')
const supabase = require('../config/supabase')
const { hashPassword, verifyPassword, esHashLegacy } = require('../utils/security')
const { esAdmin } = require('../middleware/requireAdmin')
const { dbError } = require('../utils/httpErrors')

function rolNombreDe(rolesPayload) {
  const rol = Array.isArray(rolesPayload) ? rolesPayload[0]?.nombre : rolesPayload?.nombre
  return rol ?? 'Sin rol'
}

function emitirSesion(res, data) {
  const payload = {
    id: data.id,
    rol_id: data.rol_id,
    nombre: data.nombre,
    usuario: data.usuario,
    rol_nombre: rolNombreDe(data.roles),
  }

  const token = jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN ?? '8h',
  })

  res.json({ token, user: payload })
}

const CAMPOS_LOGIN = 'id,rol_id,nombre,usuario,password_hash,estado,roles(nombre)'

// Acepta { usuario, password } (captura manual) o { id, password } (tarjeta de perfil)
async function login(req, res, next) {
  try {
    const { usuario, id, password } = req.body
    if ((!usuario && !id) || !password) {
      return res.status(400).json({ error: 'Usuario y contraseña son requeridos' })
    }

    let query = supabase.from('usuarios').select(CAMPOS_LOGIN).eq('estado', 'ACTIVO')
    query = id ? query.eq('id', Number(id)) : query.eq('usuario', usuario)
    const { data, error } = await query.maybeSingle()

    if (error) return next(dbError('consultar el usuario', error))
    if (!data) return res.status(401).json({ error: 'Usuario o contraseña incorrectos' })

    const valida = await verifyPassword(password, data.password_hash)
    if (!valida) {
      return res.status(401).json({ error: 'Usuario o contraseña incorrectos' })
    }

    // Migra el hash SHA-256 viejo a bcrypt; si falla no impide el login
    if (esHashLegacy(data.password_hash)) {
      const nuevoHash = await hashPassword(password)
      const { error: migErr } = await supabase.from('usuarios').update({ password_hash: nuevoHash }).eq('id', data.id)
      if (migErr) console.error('migrar password_hash:', migErr.message)
    }

    emitirSesion(res, data)
  } catch (err) {
    next(err)
  }
}

// Perfiles para la pantalla de inicio. Es público (aún no hay sesión), por eso solo
// expone lo necesario para pintar las tarjetas: nunca el usuario, email ni teléfono.
async function perfiles(req, res, next) {
  try {
    const { data, error } = await supabase
      .from('usuarios')
      .select('id,nombre,roles(nombre)')
      .eq('estado', 'ACTIVO')
      .order('nombre')

    if (error) return next(dbError('consultar los perfiles', error))

    res.json((data ?? []).map((u) => {
      const rol_nombre = rolNombreDe(u.roles)
      return { id: u.id, nombre: u.nombre, rol_nombre, requiere_password: esAdmin({ rol_nombre }) }
    }))
  } catch (err) {
    next(err)
  }
}

// Entrada con un toque para empleados. Los administradores siempre deben usar contraseña:
// esta validación es la que lo garantiza, no la pantalla de inicio.
async function perfilLogin(req, res, next) {
  try {
    const id = Number(req.body?.id)
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'Perfil inválido' })
    }

    const { data, error } = await supabase
      .from('usuarios')
      .select(CAMPOS_LOGIN)
      .eq('id', id)
      .eq('estado', 'ACTIVO')
      .maybeSingle()

    if (error) return next(dbError('consultar el usuario', error))
    if (!data) return res.status(404).json({ error: 'El perfil no existe o está inactivo' })

    if (esAdmin({ rol_nombre: rolNombreDe(data.roles) })) {
      return res.status(403).json({ error: 'El administrador debe ingresar con contraseña' })
    }

    emitirSesion(res, data)
  } catch (err) {
    next(err)
  }
}

async function me(req, res) {
  res.json({ user: req.user })
}

async function recovery(req, res, next) {
  try {
    const { usuario, email, newPassword } = req.body
    if (!usuario || !email || !newPassword) {
      return res.status(400).json({ error: 'usuario, email y newPassword son requeridos' })
    }
    if (newPassword.trim().length < 6) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' })
    }

    const { data, error } = await supabase
      .from('usuarios')
      .select('id,roles(nombre)')
      .eq('usuario', usuario.trim())
      .eq('email', email.trim())
      .eq('estado', 'ACTIVO')
      .maybeSingle()

    if (error) return next(dbError('consultar el usuario', error))
    if (!data) return res.status(404).json({ error: 'No se encontró un usuario activo con esos datos' })

    // Esta recuperación solo pide usuario y email (no envía código), así que no se permite
    // para administradores: con esos dos datos alguien podría tomar el control del sistema.
    const rol = Array.isArray(data.roles) ? data.roles[0] : data.roles
    if (esAdmin({ rol_nombre: rol?.nombre })) {
      return res.status(403).json({ error: 'La contraseña de un administrador solo se puede cambiar desde Usuarios por otro administrador' })
    }

    const password_hash = await hashPassword(newPassword)
    const { error: updateErr } = await supabase.from('usuarios').update({ password_hash }).eq('id', data.id)
    if (updateErr) return next(dbError('actualizar la contraseña', updateErr))

    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
}

module.exports = { login, perfiles, perfilLogin, me, recovery }
