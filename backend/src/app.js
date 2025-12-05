const cors = require('cors');
const express = require('express');
const app = express();

app.use(express.json());
app.use(cors());

const aiRoutes = require('./routes/ai.routes');
app.use('/ai', aiRoutes);

module.exports = app;
