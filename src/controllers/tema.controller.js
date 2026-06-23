const supabase = require('../config/supabase')

const TABLA = 'configuracion_tema'

async function getTema(req, res, next) {
  try {
    const userId = req.user.id
    const { data, error } = await supabase
      .from(TABLA)
      .select('modo')
      .eq('usuario_id', userId)
      .maybeSingle()

    if (error) return next(error)
    res.json(data ?? null)
  } catch (err) {
    next(err)
  }
}

async function upsertTema(req, res, next) {
  try {
    const userId = req.user.id
    const { modo } = req.body
    const { data, error } = await supabase
      .from(TABLA)
      .upsert([{ usuario_id: userId, modo }], { onConflict: 'usuario_id' })
      .select()
      .single()

    if (error) return next(error)
    res.json(data)
  } catch (err) {
    next(err)
  }
}

module.exports = { getTema, upsertTema }
