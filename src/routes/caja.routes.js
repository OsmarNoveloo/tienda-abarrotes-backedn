const { Router } = require('express')
const { getCajaActual, abrirCaja, cerrarCaja, getCortes, recalcularCorte, getResumenCaja } = require('../controllers/caja.controller')
const authMiddleware = require('../middleware/auth')

const router = Router()

router.use(authMiddleware)
router.get('/actual', getCajaActual)
router.get('/:id/resumen', getResumenCaja)
router.post('/abrir', abrirCaja)
router.post('/cerrar/:id', cerrarCaja)
router.get('/cortes', getCortes)
router.post('/cortes/:id/recalcular', recalcularCorte)

module.exports = router
