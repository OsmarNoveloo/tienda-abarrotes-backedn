const jwt = require('jsonwebtoken')
const supabase = require('../config/supabase')
const { hashPassword, verifyPassword, esHashLegacy } = require('../utils/security')
const { esAdmin } = require('../middleware/requireAdmin')
const { dbError } = require('../utils/httpErrors')

async function login(req, res, next) {
  try {
    const { usuario, password } = req.body
    if (!usuario || !password) {
      return res.status(400).json({ error: 'Usuario y contraseña son requeridos' })
    }

    const { data, error } = await supabase
      .from('usuarios')
      .select('id,rol_id,nombre,usuario,password_hash,estado,roles(nombre)')
      .eq('usuario', usuario)
      .eq('estado', 'ACTIVO')
      .maybeSingle()

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

    const rolesPayload = data.roles
    const rol_nombre = Array.isArray(rolesPayload)
      ? rolesPayload[0]?.nombre
      : rolesPayload?.nombre

    const payload = {
      id: data.id,
      rol_id: data.rol_id,
      nombre: data.nombre,
      usuario: data.usuario,
      rol_nombre: rol_nombre ?? 'Sin rol',
    }

    const token = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN ?? '8h',
    })

    res.json({ token, user: payload })
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

module.exports = { login, me, recovery }
