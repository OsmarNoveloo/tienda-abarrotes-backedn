const { Router } = require('express')
const { getActividad } = require('../controllers/actividad.controller')
const authMiddleware = require('../middleware/auth')

const router = Router()

router.use(authMiddleware)
router.get('/', getActividad)

module.exports = router
