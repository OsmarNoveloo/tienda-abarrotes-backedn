const { Router } = require('express')
const { getNota, createNota, updateNota } = require('../controllers/notas.controller')
const authMiddleware = require('../middleware/auth')
const validate = require('../middleware/validate')
const { notaCreateSchema, notaUpdateSchema } = require('../schemas/notas.schema')

const router = Router()

router.use(authMiddleware)
router.get('/', getNota)
router.post('/', validate(notaCreateSchema), createNota)
router.put('/:id', validate(notaUpdateSchema), updateNota)

module.exports = router
