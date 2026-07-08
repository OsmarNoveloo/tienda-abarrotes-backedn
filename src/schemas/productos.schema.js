const { z } = require('zod')

const productoCreateSchema = z.object({
  nombre: z.string().trim().min(1, 'nombre es requerido'),
  categoria_id: z.coerce.number().optional().nullable(),
  precio_venta: z.coerce.number().optional(),
  precio_compra: z.coerce.number().optional(),
  stock_minimo: z.coerce.number().optional(),
  codigo_barras: z.string().optional().nullable(),
  activo: z.boolean().optional(),
}).passthrough()

const productoUpdateSchema = productoCreateSchema.partial()

module.exports = { productoCreateSchema, productoUpdateSchema }
