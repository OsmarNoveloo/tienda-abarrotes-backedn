const { Router } = require('express')
const { getAll, getById, create, cancelar } = require('../controllers/ventas.controller')
const authMiddleware = require('../middleware/auth')
const validate = require('../middleware/validate')
const { ventaCreateSchema } = require('../schemas/ventas.schema')

const router = Router()

router.use(authMiddleware)
router.get('/', getAll)
router.get('/:id', getById)
router.post('/', validate(ventaCreateSchema), create)
router.patch('/:id/cancelar', cancelar)

module.exports = router
