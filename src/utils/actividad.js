const supabase = require('../config/supabase')
const { getLocalISOString } = require('./dateUtils')

async function registrarActividad({ usuario_id, usuario_nombre, accion, entidad, detalle }) {
  try {
    await supabase.from('registro_actividad').insert([{
      usuario_id: usuario_id ?? null,
      usuario_nombre: usuario_nombre ?? 'Sistema',
      accion,
      entidad,
      detalle: detalle ?? null,
      creado_en: getLocalISOString(),
    }])
  } catch {
    // el registro de actividad nunca debe romper la operación principal
  }
}

module.exports = { registrarActividad }
