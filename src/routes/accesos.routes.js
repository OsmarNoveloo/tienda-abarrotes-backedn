const { Router } = require('express')
const { getAccesos, updateAccesos } = require('../controllers/accesos.controller')
const authMiddleware = require('../middleware/auth')
const validate = require('../middleware/validate')
const { updateAccesosSchema } = require('../schemas/accesos.schema')

const router = Router()

router.use(authMiddleware)
router.get('/', getAccesos)
router.put('/', validate(updateAccesosSchema), updateAccesos)

module.exports = router
