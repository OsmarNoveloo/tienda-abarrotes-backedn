const supabase = require('../config/supabase')
const { getLocalISOString } = require('../utils/dateUtils')
const { registrarActividad } = require('../utils/actividad')

async function getAll(req, res, next) {
  try {
    const { activo } = req.query
    const allProductos = []
    const PAGE_SIZE = 1000
    let from = 0

    while (true) {
      let query = supabase
        .from('productos')
        .select('*')
        .order('nombre')
        .range(from, from + PAGE_SIZE - 1)

      if (activo === 'true') query = query.eq('activo', true)

      const { data, error } = await query

      if (error) return next(error)
      allProductos.push(...(data ?? []))
      if ((data ?? []).length < PAGE_SIZE) break
      from += PAGE_SIZE
    }

    res.json(allProductos)
  } catch (err) {
    next(err)
  }
}

async function create(req, res, next) {
  try {
    const { data, error } = await supabase
      .from('productos')
      .insert([{ ...req.body, creado_en: getLocalISOString() }])
      .select()
      .single()

    if (error) return next(error)
    res.status(201).json(data)

    void registrarActividad({
      usuario_id: req.user?.id,
      usuario_nombre: req.user?.nombre,
      accion: 'PRODUCTO_CREADO',
      entidad: 'productos',
      detalle: `Creó el producto "${data.nombre}"`,
    })
  } catch (err) {
    next(err)
  }
}

async function update(req, res, next) {
  try {
    const { id } = req.params
    const { data, error } = await supabase
      .from('productos')
      .update({ ...req.body, actualizado_en: getLocalISOString() })
      .eq('id', id)
      .select()
      .single()

    if (error) return next(error)
    res.json(data)

    void registrarActividad({
      usuario_id: req.user?.id,
      usuario_nombre: req.user?.nombre,
      accion: 'PRODUCTO_ACTUALIZADO',
      entidad: 'productos',
      detalle: `Actualizó el producto "${data.nombre}"`,
    })
  } catch (err) {
    next(err)
  }
}

async function remove(req, res, next) {
  try {
    const { id } = req.params
    const { data: existing } = await supabase.from('productos').select('nombre').eq('id', id).maybeSingle()
    const { error } = await supabase.from('productos').delete().eq('id', id)

    if (!error) {
      res.json({ mode: 'deleted' })
      void registrarActividad({
        usuario_id: req.user?.id,
        usuario_nombre: req.user?.nombre,
        accion: 'PRODUCTO_ELIMINADO',
        entidad: 'productos',
        detalle: `Eliminó el producto "${existing?.nombre ?? id}"`,
      })
      return
    }

    const isFkError =
      error.code === '23503' ||
      error.message.includes('inventario_movimientos_producto_id_fkey') ||
      error.message.includes('venta_detalle_producto_id_fkey')

    if (!isFkError) return next(error)

    const { error: deactivateError } = await supabase
      .from('productos')
      .update({ activo: false, actualizado_en: getLocalISOString() })
      .eq('id', id)

    if (deactivateError) return next(deactivateError)
    res.json({ mode: 'deactivated' })

    void registrarActividad({
      usuario_id: req.user?.id,
      usuario_nombre: req.user?.nombre,
      accion: 'PRODUCTO_DESACTIVADO',
      entidad: 'productos',
      detalle: `Desactivó el producto "${existing?.nombre ?? id}"`,
    })
  } catch (err) {
    next(err)
  }
}

module.exports = { getAll, create, update, remove }
