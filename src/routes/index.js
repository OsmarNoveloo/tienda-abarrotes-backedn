const { Router } = require('express')

const router = Router()

router.use('/auth', require('./auth.routes'))
router.use('/productos', require('./productos.routes'))
router.use('/categorias', require('./categorias.routes'))
router.use('/inventario', require('./inventario.routes'))
router.use('/ventas', require('./ventas.routes'))
router.use('/caja', require('./caja.routes'))
router.use('/clientes', require('./clientes.routes'))
router.use('/creditos', require('./creditos.routes'))
router.use('/proveedores', require('./proveedores.routes'))
router.use('/usuarios', require('./usuarios.routes'))
router.use('/dashboard', require('./dashboard.routes'))
router.use('/configuracion', require('./configuracion.routes'))
router.use('/accesos', require('./accesos.routes'))
router.use('/actividad', require('./actividad.routes'))
router.use('/notas', require('./notas.routes'))
router.use('/mercadopago', require('./mercadopago.routes'))

module.exports = router
