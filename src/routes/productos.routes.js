const { Router } = require('express')
const { getAll, create, update, remove } = require('../controllers/productos.controller')
const authMiddleware = require('../middleware/auth')
const validate = require('../middleware/validate')
const { productoCreateSchema, productoUpdateSchema } = require('../schemas/productos.schema')

const router = Router()

router.use(authMiddleware)
router.get('/', getAll)
router.post('/', validate(productoCreateSchema), create)
router.put('/:id', validate(productoUpdateSchema), update)
router.delete('/:id', remove)

module.exports = router
