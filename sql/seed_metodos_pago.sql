-- Ejecutar en el SQL editor de Supabase (proyecto de producción).
-- El catálogo metodos_pago estaba vacío, así que getMetodoPagoTarjetaId() regresaba null:
-- los cobros con terminal (ventas y abonos a crédito) no se guardaban en venta_pagos ni
-- marcaban metodo_pago_id, y el total de tarjeta en ventas/corte siempre salía en 0.
-- Los ids se asignan explícitamente porque la columna id no tiene valor por defecto.
insert into metodos_pago (id, nombre)
select (select coalesce(max(id), 0) from metodos_pago) + row_number() over (order by v.orden), v.nombre
from (values (1, 'Efectivo'), (2, 'Tarjeta')) as v(orden, nombre)
where not exists (
  select 1 from metodos_pago m where lower(m.nombre) = lower(v.nombre)
);
