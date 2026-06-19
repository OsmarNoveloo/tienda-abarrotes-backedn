const { Router } = require('express')
const { getStats, getUltimasVentas } = require('../controllers/dashboard.controller')
const authMiddleware = require('../middleware/auth')

const router = Router()

router.use(authMiddleware)
router.get('/stats', getStats)
router.get('/ultimas-ventas', getUltimasVentas)

module.exports = router
