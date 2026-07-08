const { z } = require('zod')

const updateConfigSchema = z.object({
  id: z.coerce.number().optional(),
}).passthrough()

const upsertTemaSchema = z.object({
  modo: z.string().trim().min(1, 'modo es requerido'),
}).passthrough()

module.exports = { updateConfigSchema, upsertTemaSchema }
