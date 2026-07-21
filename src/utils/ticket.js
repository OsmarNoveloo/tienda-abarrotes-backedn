const supabase = require('../config/supabase')

async function getTicketData(ventaId) {
  const [{ data: venta, error: vErr }, { data: detalle, error: dErr }, { data: pagos, error: pErr }, { data: config }] =
    await Promise.all([
      supabase.from('ventas').select('*').eq('id', ventaId).single(),
      supabase.from('venta_detalle').select('*, productos(nombre)').eq('venta_id', ventaId),
      supabase.from('venta_pagos').select('*').eq('venta_id', ventaId),
      supabase.from('configuracion').select('*').limit(1).maybeSingle(),
    ])

  if (vErr) throw vErr
  if (dErr) throw dErr
  if (pErr) throw pErr

  let usuarioNombre = null
  if (venta?.usuario_id) {
    const { data: usuario } = await supabase.from('usuarios').select('nombre').eq('id', venta.usuario_id).single()
    usuarioNombre = usuario?.nombre ?? null
  }

  const items = (detalle ?? []).map((d) => ({
    nombre: d.productos?.nombre ?? 'Producto eliminado',
    cantidad: Number(d.cantidad),
    precio_unitario: Number(d.precio_unitario),
    subtotal: Number(d.subtotal),
  }))

  const cfg = config ?? {}

  return {
    venta,
    items,
    pagos: pagos ?? [],
    usuarioNombre,
    negocio: {
      nombre: cfg.nombre_negocio ?? cfg.nombre ?? cfg.razon_social ?? 'Tienda el campo',
      direccion: cfg.direccion ?? null,
      telefono: cfg.telefono ?? null,
      rfc: cfg.rfc ?? null,
      mensajePie: cfg.mensaje_pie ?? cfg.mensaje_ticket ?? cfg.pie_ticket ?? 'Gracias por su compra',
    },
  }
}

module.exports = { getTicketData }
