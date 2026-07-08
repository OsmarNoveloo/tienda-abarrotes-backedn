const { z } = require('zod')

const categoriaCreateSchema = z.object({
  nombre: z.string().trim().min(1, 'nombre es requerido'),
}).passthrough()

const categoriaUpdateSchema = categoriaCreateSchema.partial()

module.exports = { categoriaCreateSchema, categoriaUpdateSchema }
