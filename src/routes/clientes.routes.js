const { Router } = require('express')
const { getAll, getDeudas, getPosClientes, create, update, remove } = require('../controllers/clientes.controller')
const authMiddleware = require('../middleware/auth')

const router = Router()

router.use(authMiddleware)
router.get('/pos', getPosClientes)
router.get('/', getAll)
router.post('/', create)
router.put('/:id', update)
router.delete('/:id', remove)
router.get('/:id/deudas', getDeudas)

module.exports = router
