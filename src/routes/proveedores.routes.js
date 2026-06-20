const { Router } = require('express')
const {
  getAll, getSemana, create, update, remove,
  getPagos, createPago,
  getPedidos, createPedido, updatePedido,
} = require('../controllers/proveedores.controller')
const authMiddleware = require('../middleware/auth')

const router = Router()

router.use(authMiddleware)
router.get('/semana', getSemana)
router.patch('/pedidos/:pedidoId', updatePedido)
router.get('/', getAll)
router.post('/', create)
router.put('/:id', update)
router.delete('/:id', remove)
router.get('/:id/pagos', getPagos)
router.post('/:id/pagos', createPago)
router.get('/:id/pedidos', getPedidos)
router.post('/:id/pedidos', createPedido)

module.exports = router
