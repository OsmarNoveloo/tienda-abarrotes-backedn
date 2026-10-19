// Los permisos por sección se controlan en el frontend, pero las operaciones que pueden
// escalar privilegios (usuarios, accesos, configuración) se validan aquí también, porque
// cualquier usuario con sesión podría llamar a la API directamente.
// Usa el mismo criterio que el frontend (AuthContext.roleLooksAdmin).
function esAdmin(user) {
  return String(user?.rol_nombre ?? '').trim().toLowerCase().includes('admin')
}

function requireAdmin(req, res, next) {
  if (!esAdmin(req.user)) {
    return res.status(403).json({ error: 'Solo un administrador puede realizar esta acción' })
  }
  next()
}

module.exports = requireAdmin
module.exports.esAdmin = esAdmin
