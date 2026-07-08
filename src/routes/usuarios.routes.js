const { Router } = require('express')
const { getAll, getRoles, create, update, remove } = require('../controllers/usuarios.controller')
const authMiddleware = require('../middleware/auth')
const validate = require('../middleware/validate')
const { usuarioCreateSchema, usuarioUpdateSchema } = require('../schemas/usuarios.schema')

const router = Router()

router.use(authMiddleware)
router.get('/roles', getRoles)
router.get('/', getAll)
router.post('/', validate(usuarioCreateSchema), create)
router.put('/:id', validate(usuarioUpdateSchema), update)
router.delete('/:id', remove)

module.exports = router
