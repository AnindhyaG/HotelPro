require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
if (!process.env.JWT_SECRET || !process.env.MONGO_URI) { console.error('Copy .env.example to .env and fill it in.'); process.exit(1); }
const app = express();
app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173' }));
app.use(express.json());
app.get('/api/health', (_, res) => res.json({ ok: true }));
app.use('/api', require('./routes'));
app.use((_, res) => res.status(404).json({ message: 'Not found.' }));
mongoose.connect(process.env.MONGO_URI).then(() => {
  app.listen(process.env.PORT || 5000, () => console.log('HotelPro API running on port ' + (process.env.PORT || 5000)));
}).catch((e) => { console.error('MongoDB connection failed:', e.message); process.exit(1); });
