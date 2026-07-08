require('dotenv').config()
const path = require('path')
const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const morgan = require('morgan')
const routes = require('./src/routes')
const errorHandler = require('./src/middleware/errorHandler')

const app = express()
const PORT = process.env.PORT ?? 3000

app.set('trust proxy', 1)

app.use(helmet())
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'))

app.use(cors({
  origin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
  credentials: true,
}))

app.use(express.json())
app.use(express.static(path.join(__dirname, 'public')))

app.get('/health', (_req, res) => res.json({ ok: true }))
app.get('/.well-known/appspecific/com.chrome.devtools.json', (_req, res) => res.json({}))

// Webhook público — sin JWT, Mercado Pago llama directamente a esta URL
app.post('/webhooks/mercadopago', require('./src/controllers/mercadopago.controller').webhook)

app.use('/api', routes)

app.use(errorHandler)
console.log('PORT:', process.env.PORT)
console.log('SUPABASE_URL:', process.env.SUPABASE_URL)
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`)
})
