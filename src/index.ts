import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import helmet from 'helmet';
import { createServer } from 'http';
import { Server } from 'socket.io';

import mongoose from 'mongoose';
import Message from './models/message.js';

import jwt from 'jsonwebtoken';

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

//mongodb connection
mongoose.connect(process.env.MONGO_URI || "mongodb://localhost:27017/chatapp").then(()=> console.log("connected to mongodb")).catch(err => console.error("failed to connect mongodb", err));

app.use(cors());
app.use(helmet());
app.use(express.json());

import chatRoutes from './routes/chat.js';
import authRoutes from './routes/auth.js';

app.use('/chat', chatRoutes);
app.use('/auth', authRoutes);


io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error("Authentication error"));

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET!);
        (socket as any).user = decoded;
        next();
    } catch {
        next(new Error("Authentication error"));
    }
});


//Socket.IO events
io.on('connection', (socket)=>{
    console.log(`Authenticated user connected: ${socket.id} ${(socket as any).user.id}`);

    socket.on('joinRoom', (roomId)=>{
        socket.join(roomId);
        console.log(`User ${socket.id} joined room ${roomId}`);
    });

    socket.on('chatMessage', async({roomId, sender, content})=>{
        // const message = {
        //     id: Date.now().toString(),
        //     roomId,
        //     sender,
        //     content,
        //     createdAt: new Date()
        // };
        const message = new Message({ roomId, sender, content});
        await message.save();

        // broadcast to room
        io.to(roomId).emit('chatMessage', message);
    });
    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.id}`);
    });
});

server.listen(PORT, ()=>{
    console.log(`server is running at http://localhost:${PORT}`);
});
