const { z } = require('zod')

const clienteCreateSchema = z.object({
  nombre: z.string().trim().min(1, 'nombre es requerido'),
  telefono: z.string().optional().nullable(),
}).passthrough()

const clienteUpdateSchema = clienteCreateSchema.partial()

module.exports = { clienteCreateSchema, clienteUpdateSchema }
