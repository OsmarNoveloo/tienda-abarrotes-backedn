const { z } = require('zod')

const usuarioCreateSchema = z.object({
  nombre: z.string().trim().min(1, 'nombre es requerido'),
  usuario: z.string().trim().min(1, 'usuario es requerido'),
  password: z.string().min(6, 'password debe tener al menos 6 caracteres'),
  rol_id: z.coerce.number({ required_error: 'rol_id es requerido' }),
  telefono: z.string().optional().nullable(),
  email: z.string().email('email inválido').optional().nullable().or(z.literal('')),
  estado: z.string().optional(),
}).passthrough()

const usuarioUpdateSchema = usuarioCreateSchema
  .partial()
  .extend({
    password: z.string().min(6, 'password debe tener al menos 6 caracteres').optional(),
  })

module.exports = { usuarioCreateSchema, usuarioUpdateSchema }
