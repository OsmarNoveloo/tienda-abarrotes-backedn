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

const loteSchema = z.object({
  modo: z.enum(['ENTRADA', 'CONTEO'], { error: 'modo debe ser ENTRADA o CONTEO' }),
  observacion: z.string().trim().max(200).optional().nullable(),
  items: z.array(z.object({
    producto_id: z.coerce.number().int().positive(),
    // En CONTEO se permite 0 (no hay piezas en el anaquel)
    cantidad: z.coerce.number().min(0, 'cantidad no puede ser negativa'),
  })).min(1, 'Agrega al menos un producto').max(500, 'Máximo 500 productos por lote'),
}).refine(
  (body) => body.modo === 'CONTEO' || body.items.every((i) => i.cantidad > 0),
  { message: 'En ENTRADA la cantidad debe ser mayor a 0', path: ['items'] },
)

module.exports = { movimientoCreateSchema, loteSchema }
