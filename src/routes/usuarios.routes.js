const { Router } = require('express')
const { getAll, getRoles, create, update, remove } = require('../controllers/usuarios.controller')
const authMiddleware = require('../middleware/auth')

const router = Router()

router.use(authMiddleware)
router.get('/roles', getRoles)
router.get('/', getAll)
router.post('/', create)
router.put('/:id', update)
router.delete('/:id', remove)

module.exports = router
