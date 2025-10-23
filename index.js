const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('@dotenvx/dotenvx').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const chatRoutes = require('./routes/chat');
app.use('/api/chat', chatRoutes);

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});