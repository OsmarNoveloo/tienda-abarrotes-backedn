const { Router } = require('express')
const {
  getAll, getSemana, create, update, remove,
  getPagos, createPago,
  getPedidos, createPedido, updatePedido,
} = require('../controllers/proveedores.controller')
const authMiddleware = require('../middleware/auth')
const validate = require('../middleware/validate')
const {
  proveedorCreateSchema,
  proveedorUpdateSchema,
  proveedorPagoCreateSchema,
  proveedorPedidoCreateSchema,
  proveedorPedidoUpdateSchema,
} = require('../schemas/proveedores.schema')

const router = Router()

router.use(authMiddleware)
router.get('/semana', getSemana)
router.patch('/pedidos/:pedidoId', validate(proveedorPedidoUpdateSchema), updatePedido)
router.get('/', getAll)
router.post('/', validate(proveedorCreateSchema), create)
router.put('/:id', validate(proveedorUpdateSchema), update)
router.delete('/:id', remove)
router.get('/:id/pagos', getPagos)
router.post('/:id/pagos', validate(proveedorPagoCreateSchema), createPago)
router.get('/:id/pedidos', getPedidos)
router.post('/:id/pedidos', validate(proveedorPedidoCreateSchema), createPedido)

module.exports = router
