-- Ejecutar en el SQL editor de Supabase (proyecto de producción).
-- Evita que una misma venta se guarde dos veces cuando el POS la reenvía desde la cola
-- offline al mismo tiempo (por ejemplo, desde dos pestañas): la verificación por folio de
-- POST /ventas no alcanza a frenar dos envíos simultáneos; este índice sí.

-- 1) Debe regresar 0 filas antes de crear el índice:
select folio, count(*) from ventas where folio is not null group by folio having count(*) > 1;

-- 2) Crea el índice único (reemplaza al índice normal que se usaba para la búsqueda por folio):
create unique index if not exists idx_ventas_folio_unico on ventas(folio);
drop index if exists idx_ventas_folio;
