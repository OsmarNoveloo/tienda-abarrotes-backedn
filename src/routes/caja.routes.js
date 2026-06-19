const { Router } = require('express')
const { getCajaActual, abrirCaja, cerrarCaja, getCortes, recalcularCorte } = require('../controllers/caja.controller')
const authMiddleware = require('../middleware/auth')

const router = Router()

router.use(authMiddleware)
router.get('/actual', getCajaActual)
router.post('/abrir', abrirCaja)
router.post('/cerrar/:id', cerrarCaja)
router.get('/cortes', getCortes)
router.post('/cortes/:id/recalcular', recalcularCorte)

module.exports = router
