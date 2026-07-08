const { Router } = require('express')
const { getAll, create, update, remove } = require('../controllers/categorias.controller')
const authMiddleware = require('../middleware/auth')
const validate = require('../middleware/validate')
const { categoriaCreateSchema, categoriaUpdateSchema } = require('../schemas/categorias.schema')

const router = Router()

router.use(authMiddleware)
router.get('/', getAll)
router.post('/', validate(categoriaCreateSchema), create)
router.put('/:id', validate(categoriaUpdateSchema), update)
router.delete('/:id', remove)

module.exports = router
