const { Router } = require('express')
const { getAll, create, update, getAbonos, createAbono } = require('../controllers/creditos.controller')
const authMiddleware = require('../middleware/auth')

const router = Router()

router.use(authMiddleware)
router.get('/', getAll)
router.post('/', create)
router.put('/:id', update)
router.get('/:id/abonos', getAbonos)
router.post('/:id/abonos', createAbono)

module.exports = router
