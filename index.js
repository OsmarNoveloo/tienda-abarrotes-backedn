require('dotenv').config()
const express = require('express')
const cors = require('cors')
const routes = require('./src/routes')
const errorHandler = require('./src/middleware/errorHandler')

const app = express()
const PORT = process.env.PORT ?? 3000

app.use(cors({
  origin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
  credentials: true,
}))

app.use(express.json())

app.get('/health', (_req, res) => res.json({ ok: true }))
app.get('/.well-known/appspecific/com.chrome.devtools.json', (_req, res) => res.json({}))

app.use('/api', routes)

app.use(errorHandler)
console.log('PORT:', process.env.PORT)
console.log('SUPABASE_URL:', process.env.SUPABASE_URL)
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`)
})
