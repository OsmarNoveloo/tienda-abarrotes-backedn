const { z } = require('zod')

const abrirCajaSchema = z.object({
  empleado_apertura_id: z.coerce.number({ required_error: 'empleado_apertura_id es requerido' }),
  monto_apertura: z.coerce.number({ required_error: 'monto_apertura es requerido' }),
}).passthrough()

const cerrarCajaSchema = z.object({
  empleado_cierre_id: z.coerce.number({ required_error: 'empleado_cierre_id es requerido' }),
  // Los totales de ventas los calcula el backend; el cajero solo captura lo que contó
  efectivo_contado: z.coerce.number().nonnegative('efectivo_contado no puede ser negativo').optional().nullable(),
  observaciones: z.string().optional().nullable(),
}).passthrough()

const recalcularCorteSchema = z.object({
  caja_sesion_id: z.coerce.number({ required_error: 'caja_sesion_id es requerido' }),
}).passthrough()

module.exports = { abrirCajaSchema, cerrarCajaSchema, recalcularCorteSchema }
