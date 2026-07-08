const { Router } = require('express')
const { crearIntento, consultarIntento, cancelarIntento } = require('../controllers/mercadopago.controller')
const authMiddleware = require('../middleware/auth')

const router = Router()

router.use(authMiddleware)

router.post('/pago', crearIntento)
router.get('/pago/:intentId', consultarIntento)
router.delete('/pago/:intentId', cancelarIntento)

module.exports = router
