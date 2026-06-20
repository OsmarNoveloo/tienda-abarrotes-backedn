const { Router } = require('express')
const { getAll, getClientesDeuda, create, update, getAbonos, createAbono, pagarCliente } = require('../controllers/creditos.controller')
const authMiddleware = require('../middleware/auth')

const router = Router()

router.use(authMiddleware)
router.get('/deuda-clientes', getClientesDeuda)
router.post('/pagar-cliente', pagarCliente)
router.get('/', getAll)
router.post('/', create)
router.put('/:id', update)
router.get('/:id/abonos', getAbonos)
router.post('/:id/abonos', createAbono)

module.exports = router
