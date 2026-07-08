const { z } = require('zod')

const creditoCreateSchema = z.object({
  venta_id: z.coerce.number().optional().nullable(),
  cliente_id: z.coerce.number({ required_error: 'cliente_id es requerido' }),
  usuario_id: z.coerce.number().optional().nullable(),
  total_credito: z.coerce.number({ required_error: 'total_credito es requerido' }),
  saldo_pendiente: z.coerce.number().optional(),
  fecha_vencimiento: z.string().optional().nullable(),
  observaciones: z.string().optional().nullable(),
}).passthrough()

const creditoUpdateSchema = creditoCreateSchema.partial()

const abonoCreateSchema = z.object({
  monto: z.coerce.number({ required_error: 'monto es requerido' }),
  usuario_id: z.coerce.number().optional().nullable(),
  metodo_pago_id: z.coerce.number().optional().nullable(),
  observacion: z.string().optional().nullable(),
}).passthrough()

const pagarClienteSchema = z.object({
  cliente_id: z.coerce.number({ required_error: 'cliente_id es requerido' }),
  monto: z.coerce.number({ required_error: 'monto es requerido' }),
  usuario_id: z.coerce.number().optional().nullable(),
  observacion: z.string().optional().nullable(),
}).passthrough()

module.exports = { creditoCreateSchema, creditoUpdateSchema, abonoCreateSchema, pagarClienteSchema }
