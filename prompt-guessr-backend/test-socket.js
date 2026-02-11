// Minimal Socket.IO test
const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer);

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

io.on('connection', (socket) => {
  console.log('Socket connected:', socket.id);
});

httpServer.listen(3002, () => {
  console.log('Test server on :3002');
});
