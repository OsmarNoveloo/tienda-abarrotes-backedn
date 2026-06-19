const { Router } = require('express')
const { getAccesos, updateAccesos } = require('../controllers/accesos.controller')
const authMiddleware = require('../middleware/auth')

const router = Router()

router.use(authMiddleware)
router.get('/', getAccesos)
router.put('/', updateAccesos)

module.exports = router
