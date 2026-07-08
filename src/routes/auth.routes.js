const { Router } = require('express')
const rateLimit = require('express-rate-limit')
const { login, me, recovery } = require('../controllers/auth.controller')
const authMiddleware = require('../middleware/auth')

const router = Router()

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados intentos, intenta de nuevo más tarde' },
})

router.post('/login', loginLimiter, login)
router.post('/recovery', loginLimiter, recovery)
router.get('/me', authMiddleware, me)

module.exports = router
