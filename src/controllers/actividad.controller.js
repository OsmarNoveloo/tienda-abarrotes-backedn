const supabase = require('../config/supabase')

async function getActividad(req, res, next) {
  try {
    const page = Math.max(1, parseInt(req.query.page ?? '1'))
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize ?? '30')))
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1

    const { data, error, count } = await supabase
      .from('registro_actividad')
      .select('id,usuario_id,usuario_nombre,accion,entidad,detalle,creado_en', { count: 'exact' })
      .order('creado_en', { ascending: false })
      .range(from, to)

    if (error) return next(error)
    res.json({ items: data ?? [], total: count ?? 0 })
  } catch (err) {
    next(err)
  }
}

module.exports = { getActividad }
