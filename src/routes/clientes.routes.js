const { Router } = require('express')
const { getAll, getDeudas, getPosClientes, create, update, remove } = require('../controllers/clientes.controller')
const authMiddleware = require('../middleware/auth')
const validate = require('../middleware/validate')
const { clienteCreateSchema, clienteUpdateSchema } = require('../schemas/clientes.schema')

const router = Router()

router.use(authMiddleware)
router.get('/pos', getPosClientes)
router.get('/', getAll)
router.post('/', validate(clienteCreateSchema), create)
router.put('/:id', validate(clienteUpdateSchema), update)
router.delete('/:id', remove)
router.get('/:id/deudas', getDeudas)

module.exports = router
