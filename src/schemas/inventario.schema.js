const { z } = require('zod')

const movimientoCreateSchema = z.object({
  producto_id: z.coerce.number({ required_error: 'producto_id es requerido' }),
  usuario_id: z.coerce.number().optional().nullable(),
  tipo: z.string().trim().min(1, 'tipo es requerido'),
  cantidad: z.coerce.number({ required_error: 'cantidad es requerida' }),
  costo_unitario: z.coerce.number().optional().nullable(),
  referencia_tipo: z.string().optional().nullable(),
  referencia_id: z.coerce.number().optional().nullable(),
  observacion: z.string().optional().nullable(),
}).passthrough()

module.exports = { movimientoCreateSchema }
