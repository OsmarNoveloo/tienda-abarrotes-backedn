const { z } = require('zod')

const detalleItemSchema = z.object({
  producto_id: z.coerce.number({ required_error: 'producto_id es requerido' }),
  cantidad: z.coerce.number({ required_error: 'cantidad es requerida' }),
  precio_unitario: z.coerce.number({ required_error: 'precio_unitario es requerido' }),
  subtotal: z.coerce.number().optional(),
}).passthrough()

const pagoItemSchema = z.object({
  metodo: z.string().optional(),
  monto: z.coerce.number({ required_error: 'monto es requerido' }),
}).passthrough()

const ventaCreateSchema = z.object({
  usuario_id: z.coerce.number({ required_error: 'usuario_id es requerido' }),
  total: z.coerce.number({ required_error: 'total es requerido' }),
  detalle: z.array(detalleItemSchema).optional(),
  pagos: z.array(pagoItemSchema).optional(),
  movimientos: z.array(z.object({}).passthrough()).optional(),
  credito: z.object({}).passthrough().nullable().optional(),
}).passthrough()

module.exports = { ventaCreateSchema }
