const { Router } = require('express')
const { getNota, createNota, updateNota } = require('../controllers/notas.controller')
const authMiddleware = require('../middleware/auth')

const router = Router()

router.use(authMiddleware)
router.get('/', getNota)
router.post('/', createNota)
router.put('/:id', updateNota)

module.exports = router
