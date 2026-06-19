const { Router } = require('express')
const { getConfig, updateConfig } = require('../controllers/configuracion.controller')
const authMiddleware = require('../middleware/auth')

const router = Router()

router.use(authMiddleware)
router.get('/', getConfig)
router.put('/', updateConfig)

module.exports = router
