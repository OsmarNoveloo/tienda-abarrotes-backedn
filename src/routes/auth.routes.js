const { Router } = require('express')
const { login, me } = require('../controllers/auth.controller')
const authMiddleware = require('../middleware/auth')

const router = Router()

router.post('/login', login)
router.get('/me', authMiddleware, me)

module.exports = router
