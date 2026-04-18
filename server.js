const express = require('express')
const mongoose = require('mongoose')
const cors = require('cors')
const dotenv = require('dotenv')
const path = require('path')

dotenv.config()

const app = express()

app.use(cors({
  origin: [
    'http://localhost:3000', 
    'https://cncode.io.vn', 
    'https://cncode.vercel.app',
  ],
  credentials: true
}))
app.use('/api/payments/webhook', express.raw({ type: 'application/json' }))
app.use(express.json())

mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch((err) => console.error('MongoDB connection error:', err))

app.use('/api/auth', require('./modules/auth/auth.routes'))
app.use('/api/digital-products', require('./modules/digital-product/digital-product.routes'))
app.use('/api/payments', require('./modules/payment/payment.routes'))
app.use('/api/upload', require('./modules/upload/upload.routes'))

app.get('/', (req, res) => {
  res.json({ message: 'CNcode API is running' })
})

const PORT = process.env.PORT || 5000
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})