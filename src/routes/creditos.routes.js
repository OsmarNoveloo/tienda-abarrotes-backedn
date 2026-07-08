const { Router } = require('express')
const { getAll, getClientesDeuda, create, update, getAbonos, createAbono, pagarCliente } = require('../controllers/creditos.controller')
const authMiddleware = require('../middleware/auth')
const validate = require('../middleware/validate')
const {
  creditoCreateSchema,
  creditoUpdateSchema,
  abonoCreateSchema,
  pagarClienteSchema,
} = require('../schemas/creditos.schema')

const router = Router()

router.use(authMiddleware)
router.get('/deuda-clientes', getClientesDeuda)
router.post('/pagar-cliente', validate(pagarClienteSchema), pagarCliente)
router.get('/', getAll)
router.post('/', validate(creditoCreateSchema), create)
router.put('/:id', validate(creditoUpdateSchema), update)
router.get('/:id/abonos', getAbonos)
router.post('/:id/abonos', validate(abonoCreateSchema), createAbono)

module.exports = router
