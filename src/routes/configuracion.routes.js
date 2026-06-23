const { Router } = require('express')
const { getConfig, updateConfig } = require('../controllers/configuracion.controller')
const { getTema, upsertTema } = require('../controllers/tema.controller')
const authMiddleware = require('../middleware/auth')

const router = Router()

router.use(authMiddleware)
router.get('/', getConfig)
router.put('/', updateConfig)
router.get('/tema', getTema)
router.put('/tema', upsertTema)

module.exports = router
