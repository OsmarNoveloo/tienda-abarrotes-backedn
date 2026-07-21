const { Router } = require('express')
const { getAll, getById, create, cancelar, getTicketRaw, getTicketPdf } = require('../controllers/ventas.controller')
const authMiddleware = require('../middleware/auth')
const validate = require('../middleware/validate')
const { ventaCreateSchema } = require('../schemas/ventas.schema')

const router = Router()

router.use(authMiddleware)
router.get('/', getAll)
router.get('/:id', getById)
router.get('/:id/ticket-pdf', getTicketPdf)
router.get('/:id/ticket-raw', getTicketRaw)
router.post('/', validate(ventaCreateSchema), create)
router.patch('/:id/cancelar', cancelar)

module.exports = router
