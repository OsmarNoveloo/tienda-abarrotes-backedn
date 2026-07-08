const { z } = require('zod')

const updateAccesosSchema = z.object({
  admin_permisos: z.any().refine((v) => v !== undefined, 'admin_permisos es requerido'),
  cajero_permisos: z.any().refine((v) => v !== undefined, 'cajero_permisos es requerido'),
  actualizado_por: z.coerce.number().optional().nullable(),
}).passthrough()

module.exports = { updateAccesosSchema }
