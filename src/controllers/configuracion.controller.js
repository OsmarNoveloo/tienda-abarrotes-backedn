const supabase = require('../config/supabase')

async function getConfig(req, res, next) {
  try {
    const { data, error } = await supabase
      .from('configuracion')
      .select('*')
      .limit(1)
      .maybeSingle()

    if (error) return next(error)
    res.json(data ?? {})
  } catch (err) {
    next(err)
  }
}

async function updateConfig(req, res, next) {
  try {
    const { id, ...values } = req.body

    const { data, error } = id
      ? await supabase.from('configuracion').update(values).eq('id', id).select().single()
      : await supabase.from('configuracion').insert([values]).select().single()

    if (error) return next(error)
    res.json(data)
  } catch (err) {
    next(err)
  }
}

module.exports = { getConfig, updateConfig }
