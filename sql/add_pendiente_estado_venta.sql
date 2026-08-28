-- Ejecutar en el SQL editor de Supabase (proyecto de producción).
-- El enum estado_venta solo tenía PAGADA/CANCELADA; el flujo de cobro con
-- terminal (Mercado Pago Point) crea la venta como PENDIENTE mientras espera
-- que se complete el pago en la terminal.
ALTER TYPE estado_venta ADD VALUE 'PENDIENTE';
