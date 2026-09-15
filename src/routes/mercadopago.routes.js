const { Router } = require('express')
const { crearIntento, consultarIntento, cancelarIntento, reconciliarVenta, getTransacciones } = require('../controllers/mercadopago.controller')
const authMiddleware = require('../middleware/auth')

const router = Router()

router.use(authMiddleware)

router.post('/pago', crearIntento)
router.get('/pago/:intentId', consultarIntento)
router.delete('/pago/:intentId', cancelarIntento)
router.post('/pago/venta/:ventaId/reconciliar', reconciliarVenta)
router.get('/transacciones', getTransacciones)

module.exports = router
