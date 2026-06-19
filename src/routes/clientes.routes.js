const { Router } = require('express')
const { getAll, create, update, remove } = require('../controllers/clientes.controller')
const authMiddleware = require('../middleware/auth')

const router = Router()

router.use(authMiddleware)
router.get('/', getAll)
router.post('/', create)
router.put('/:id', update)
router.delete('/:id', remove)

module.exports = router
