const { z } = require('zod')

const abrirCajaSchema = z.object({
  empleado_apertura_id: z.coerce.number({ required_error: 'empleado_apertura_id es requerido' }),
  monto_apertura: z.coerce.number({ required_error: 'monto_apertura es requerido' }),
}).passthrough()

const cerrarCajaSchema = z.object({
  empleado_cierre_id: z.coerce.number({ required_error: 'empleado_cierre_id es requerido' }),
  total_efectivo: z.coerce.number({ required_error: 'total_efectivo es requerido' }),
  total_tarjeta: z.coerce.number({ required_error: 'total_tarjeta es requerido' }),
  observaciones: z.string().optional().nullable(),
}).passthrough()

const recalcularCorteSchema = z.object({
  caja_sesion_id: z.coerce.number({ required_error: 'caja_sesion_id es requerido' }),
}).passthrough()

module.exports = { abrirCajaSchema, cerrarCajaSchema, recalcularCorteSchema }
