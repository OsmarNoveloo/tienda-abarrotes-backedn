const supabase = require('../config/supabase')

async function getNota(req, res, next) {
  try {
    const { data, error } = await supabase
      .from('notas')
      .select('id,contenido')
      .eq('es_global', true)
      .order('id', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) return next(error)
    res.json(data ?? null)
  } catch (err) {
    next(err)
  }
}

async function createNota(req, res, next) {
  try {
    const { contenido, usuario_id } = req.body
    const { data, error } = await supabase
      .from('notas')
      .insert([{ contenido, es_global: true, usuario_id: usuario_id ?? null }])
      .select('id,contenido')
      .single()

    if (error) return next(error)
    res.status(201).json(data)
  } catch (err) {
    next(err)
  }
}

async function updateNota(req, res, next) {
  try {
    const { id } = req.params
    const { contenido } = req.body
    const { data, error } = await supabase
      .from('notas')
      .update({ contenido })
      .eq('id', id)
      .select('id,contenido')
      .single()

    if (error) return next(error)
    res.json(data)
  } catch (err) {
    next(err)
  }
}

module.exports = { getNota, createNota, updateNota }
