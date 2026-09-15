const supabase = require('../config/supabase')
const { getLocalISOString } = require('../utils/dateUtils')
const { dbError } = require('../utils/httpErrors')

async function getAll(req, res, next) {
  try {
    const { data, error } = await supabase
      .from('categorias')
      .select('*')
      .order('nombre')

    if (error) return next(dbError('consultar categorías', error))
    res.json(data ?? [])
  } catch (err) {
    next(err)
  }
}

async function create(req, res, next) {
  try {
    const { data, error } = await supabase
      .from('categorias')
      .insert([{ ...req.body, creado_en: getLocalISOString() }])
      .select()
      .single()

    if (error) return next(dbError('crear la categoría', error))
    res.status(201).json(data)
  } catch (err) {
    next(err)
  }
}

async function update(req, res, next) {
  try {
    const { id } = req.params
    const { data, error } = await supabase
      .from('categorias')
      .update(req.body)
      .eq('id', id)
      .select()
      .single()

    if (error) return next(dbError('actualizar la categoría', error))
    res.json(data)
  } catch (err) {
    next(err)
  }
}

async function remove(req, res, next) {
  try {
    const { id } = req.params
    const { error } = await supabase.from('categorias').delete().eq('id', id)
    if (error) return next(dbError('eliminar la categoría', error))
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
}

module.exports = { getAll, create, update, remove }
