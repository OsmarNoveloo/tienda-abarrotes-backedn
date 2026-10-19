const { Router } = require('express')
const { getConfig, updateConfig } = require('../controllers/configuracion.controller')
const { getTema, upsertTema } = require('../controllers/tema.controller')
const authMiddleware = require('../middleware/auth')
const requireAdmin = require('../middleware/requireAdmin')
const validate = require('../middleware/validate')
const { updateConfigSchema, upsertTemaSchema } = require('../schemas/configuracion.schema')

const router = Router()

router.use(authMiddleware)
router.get('/', getConfig)
router.put('/', requireAdmin, validate(updateConfigSchema), updateConfig)
router.get('/tema', getTema)
router.put('/tema', validate(upsertTemaSchema), upsertTema)

module.exports = router
