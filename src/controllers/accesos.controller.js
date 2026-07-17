const supabase = require('../config/supabase')
const { getLocalISOString } = require('../utils/dateUtils')
const { registrarActividad } = require('../utils/actividad')

async function getAccesos(req, res, next) {
  try {
    const { data, error } = await supabase
      .from('configuracion_accesos')
      .select('admin_permisos,cajero_permisos')
      .eq('id', 1)
      .maybeSingle()

    if (error) return next(error)
    res.json(data ?? null)
  } catch (err) {
    next(err)
  }
}

async function updateAccesos(req, res, next) {
  try {
    const { admin_permisos, cajero_permisos, actualizado_por } = req.body

    const { data, error } = await supabase
      .from('configuracion_accesos')
      .upsert([{
        id: 1,
        admin_permisos,
        cajero_permisos,
        actualizado_por: actualizado_por ?? null,
        actualizado_en: getLocalISOString(),
      }], { onConflict: 'id' })
      .select()
      .single()

    if (error) return next(error)
    res.json(data)

    void registrarActividad({
      usuario_id: req.user?.id,
      usuario_nombre: req.user?.nombre,
      accion: 'ACCESOS_ACTUALIZADOS',
      entidad: 'configuracion_accesos',
      detalle: 'Actualizó los permisos de acceso por rol',
    })
  } catch (err) {
    next(err)
  }
}

module.exports = { getAccesos, updateAccesos }
