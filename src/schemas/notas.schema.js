const { z } = require('zod')

const notaCreateSchema = z.object({
  contenido: z.string().trim().min(1, 'contenido es requerido'),
  usuario_id: z.coerce.number().optional().nullable(),
}).passthrough()

const notaUpdateSchema = z.object({
  contenido: z.string().trim().min(1, 'contenido es requerido'),
}).passthrough()

module.exports = { notaCreateSchema, notaUpdateSchema }
