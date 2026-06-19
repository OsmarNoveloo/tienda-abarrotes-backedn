const { Router } = require('express')
const { getAll, getById, create, cancelar } = require('../controllers/ventas.controller')
const authMiddleware = require('../middleware/auth')

const router = Router()

router.use(authMiddleware)
router.get('/', getAll)
router.get('/:id', getById)
router.post('/', create)
router.patch('/:id/cancelar', cancelar)

module.exports = router
