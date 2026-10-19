const crypto = require('crypto')
const bcrypt = require('bcryptjs')

const BCRYPT_ROUNDS = 10

function sha256Hex(text) {
  return crypto.createHash('sha256').update(text).digest('hex')
}

async function hashPassword(password) {
  return bcrypt.hash(password, BCRYPT_ROUNDS)
}

function esHashLegacy(hash) {
  return !String(hash ?? '').startsWith('$2')
}

// Acepta hashes bcrypt y los SHA-256 anteriores (sin salt). Los legacy se migran a bcrypt
// al iniciar sesión (ver auth.controller), así nadie tiene que cambiar su contraseña.
async function verifyPassword(password, hash) {
  if (!hash) return false
  if (esHashLegacy(hash)) {
    const calculado = Buffer.from(sha256Hex(password))
    const guardado = Buffer.from(String(hash))
    return calculado.length === guardado.length && crypto.timingSafeEqual(calculado, guardado)
  }
  return bcrypt.compare(password, hash)
}

module.exports = { sha256Hex, hashPassword, verifyPassword, esHashLegacy }
