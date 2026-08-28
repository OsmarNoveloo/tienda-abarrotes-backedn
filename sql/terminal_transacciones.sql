-- Ejecutar en el SQL editor de Supabase antes de probar la integración.
create table if not exists terminal_transacciones (
  id bigint generated always as identity primary key,
  intent_id text not null unique,
  venta_id bigint references ventas(id),
  device_id text,
  monto numeric(10,2) not null,
  estado text not null default 'CREATED',
  payment_id text,
  detalle jsonb,
  creado_en timestamp not null default now(),
  actualizado_en timestamp not null default now()
);

create index if not exists idx_terminal_transacciones_venta_id on terminal_transacciones(venta_id);
create index if not exists idx_terminal_transacciones_creado_en on terminal_transacciones(creado_en desc);
