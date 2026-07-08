const { z } = require('zod')

const proveedorCreateSchema = z.object({
  nombre: z.string().trim().min(1, 'nombre es requerido'),
  telefono: z.string().optional().nullable(),
  email: z.string().email('email inválido').optional().nullable().or(z.literal('')),
}).passthrough()

const proveedorUpdateSchema = proveedorCreateSchema.partial()

const proveedorPagoCreateSchema = z.object({
  fecha: z.string({ required_error: 'fecha es requerida' }),
  monto: z.coerce.number({ required_error: 'monto es requerido' }),
}).passthrough()

const proveedorPedidoCreateSchema = z.object({
  fecha: z.string({ required_error: 'fecha es requerida' }),
}).passthrough()

const proveedorPedidoUpdateSchema = z.object({
  pedido: z.any().refine((v) => v !== undefined, 'pedido es requerido'),
}).passthrough()

module.exports = {
  proveedorCreateSchema,
  proveedorUpdateSchema,
  proveedorPagoCreateSchema,
  proveedorPedidoCreateSchema,
  proveedorPedidoUpdateSchema,
}
