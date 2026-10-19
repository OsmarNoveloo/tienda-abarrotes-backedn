-- Ejecutar en el SQL editor de Supabase (proyecto de producción).

-- 1) Índice para la verificación de folio duplicado que hace POST /ventas en cada venta
--    (evita duplicar ventas reenviadas desde la cola offline).
create index if not exists idx_ventas_folio on ventas(folio);

-- 2) Las ventas cobradas con terminal que se cancelaron antes de este cambio dejaron el
--    inventario descontado (la cancelación no regresaba las salidas). Esto registra la
--    ENTRADA correspondiente, con la misma marca que ahora usa la cancelación
--    (referencia_tipo = 'CANCELACION_VENTA'), así no se puede aplicar dos veces.
--    Revisa primero cuántas filas afecta:
select v.id, v.folio, v.total, v.fecha_venta, count(m.id) as productos
from ventas v
join inventario_movimientos m
  on m.referencia_tipo = 'VENTA' and m.referencia_id = v.id and m.tipo = 'SALIDA'
where v.estado = 'CANCELADA'
  and v.observacion like 'Cobro con tarjeta (terminal)%'
  and not exists (
    select 1 from inventario_movimientos r
    where r.referencia_tipo = 'CANCELACION_VENTA' and r.referencia_id = v.id
  )
group by v.id, v.folio, v.total, v.fecha_venta
order by v.id;

-- Y luego aplica la corrección:
insert into inventario_movimientos
  (producto_id, usuario_id, tipo, cantidad, costo_unitario, referencia_tipo, referencia_id, observacion, fecha_movimiento)
select m.producto_id, m.usuario_id, 'ENTRADA', m.cantidad, m.costo_unitario,
       'CANCELACION_VENTA', v.id, 'Regreso por cancelación de venta ' || v.id || ' (corrección)',
       (now() at time zone 'America/Mexico_City')
from ventas v
join inventario_movimientos m
  on m.referencia_tipo = 'VENTA' and m.referencia_id = v.id and m.tipo = 'SALIDA'
where v.estado = 'CANCELADA'
  and v.observacion like 'Cobro con tarjeta (terminal)%'
  and not exists (
    select 1 from inventario_movimientos r
    where r.referencia_tipo = 'CANCELACION_VENTA' and r.referencia_id = v.id
  );

-- 3) Las ventas que siguen PENDIENTE (cobros con terminal sin resolver) NO se tocan aquí:
--    algunas pudieron cobrarse. Revísalas en Ventas con "Verificar pago"; si el cobro no se
--    hizo, al cancelarlas ahora el inventario se regresa automáticamente.
