const { Router } = require('express')
const {
  getMovimientos,
  createMovimiento,
  getStockActual,
  getStockPage,
  getStockBajoCount,
} = require('../controllers/inventario.controller')
const authMiddleware = require('../middleware/auth')
const validate = require('../middleware/validate')
const { movimientoCreateSchema } = require('../schemas/inventario.schema')

const router = Router()

router.use(authMiddleware)
router.get('/movimientos', getMovimientos)
router.post('/movimientos', validate(movimientoCreateSchema), createMovimiento)
router.get('/stock', getStockActual)
router.get('/stock/page', getStockPage)
router.get('/stock/bajo', getStockBajoCount)

module.exports = router
