const { Router } = require('express')
const rateLimit = require('express-rate-limit')
const { login, perfiles, perfilLogin, me, recovery } = require('../controllers/auth.controller')
const authMiddleware = require('../middleware/auth')

const router = Router()

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados intentos, intenta de nuevo más tarde' },
})

// Los empleados cambian de perfil seguido y comparten la IP de la tienda,
// así que este límite es más amplio que el de contraseña.
const perfilLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados intentos, intenta de nuevo más tarde' },
})

router.post('/login', loginLimiter, login)
router.get('/perfiles', perfilLimiter, perfiles)
router.post('/perfil-login', perfilLimiter, perfilLogin)
router.post('/recovery', loginLimiter, recovery)
router.get('/me', authMiddleware, me)

module.exports = router
