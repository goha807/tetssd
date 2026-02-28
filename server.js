const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

// Сервіс статичних файлів з папки public
app.use(express.static(path.join(__dirname, 'public')));

// Зберігаємо чат у пам'яті (на Railway файли не зберігаються вічно)
let chatHistory = [];
const MAX_MESSAGES = 100;

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);
    
    // Надсилаємо історію новому користувачу
    socket.emit('chat_history', chatHistory);

    socket.on('chat_message', (msg) => {
        const messageData = {
            id: Date.now(),
            user: msg.user || 'Анонім',
            text: msg.text,
            time: new Date().toLocaleTimeString('uk-UA')
        };
        
        chatHistory.push(messageData);
        if (chatHistory.length > MAX_MESSAGES) {
            chatHistory.shift();
        }
        
        io.emit('chat_message', messageData);
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
    });
});

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});