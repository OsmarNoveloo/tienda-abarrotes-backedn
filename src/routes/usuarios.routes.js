const { Router } = require('express')
const { getAll, getRoles, create, update, remove } = require('../controllers/usuarios.controller')
const authMiddleware = require('../middleware/auth')
const requireAdmin = require('../middleware/requireAdmin')
const validate = require('../middleware/validate')
const { usuarioCreateSchema, usuarioUpdateSchema } = require('../schemas/usuarios.schema')

const router = Router()

router.use(authMiddleware)
router.get('/roles', getRoles)
router.get('/', getAll)
// La lista se usa también al abrir caja; crear/editar/desactivar es solo para administradores
router.post('/', requireAdmin, validate(usuarioCreateSchema), create)
router.put('/:id', requireAdmin, validate(usuarioUpdateSchema), update)
router.delete('/:id', requireAdmin, remove)

module.exports = router
