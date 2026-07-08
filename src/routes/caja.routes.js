const { Router } = require('express')
const { getCajaActual, abrirCaja, cerrarCaja, getCortes, recalcularCorte, getResumenCaja } = require('../controllers/caja.controller')
const authMiddleware = require('../middleware/auth')
const validate = require('../middleware/validate')
const { abrirCajaSchema, cerrarCajaSchema, recalcularCorteSchema } = require('../schemas/caja.schema')

const router = Router()

router.use(authMiddleware)
router.get('/actual', getCajaActual)
router.get('/:id/resumen', getResumenCaja)
router.post('/abrir', validate(abrirCajaSchema), abrirCaja)
router.post('/cerrar/:id', validate(cerrarCajaSchema), cerrarCaja)
router.get('/cortes', getCortes)
router.post('/cortes/:id/recalcular', validate(recalcularCorteSchema), recalcularCorte)

module.exports = router
