import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import helmet from 'helmet';
import { createServer } from 'http';
import { Server } from 'socket.io';

dotenv.config();

const app = express();
const server = createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(helmet());
app.use(express.json());

import chatRoutes from './routes/chat.js';
app.use('/chat', chatRoutes);

//Socket.IO events
io.on('connection', (socket)=>{
    console.log(`User ${socket.id}`);

    socket.on('joinRoom', (roomId)=>{
        socket.join(roomId);
        console.log(`User ${socket.id} joined room ${roomId}`);
    });

    socket.on('chatMessage', ({roomId, sender, content})=>{
        const message = {
            id: Date.now().toString(),
            roomId,
            sender,
            content,
            createdAt: new Date()
        };
        // broadcast to room
        io.to(roomId).emit('chatMessage', message);
    });
    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.id}`);
    });
});

app.listen(PORT, ()=>{
    console.log(`server is running at http://localhost:${{PORT}}`);
})
