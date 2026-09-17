import type { Request, Response } from "express";
import { messages } from "../models/message.js";

export const getMessages = (req: Request, res: Response) =>{
    const { roomId } = req.params;
    const roomMessages = messages.filter(m => m.roomId === roomId);
    res.json(roomMessages);
};

export const sendMessages = (req :Request, res :Response) =>{
    const { roomId } = req.params;
    const { sender, content } = req.body;

    if (typeof roomId !== "string") {
        res.status(400).json({ error: "Invalid room ID" });
        return;
    }

    const newMMessage = {
        id: Date.now().toString(),
        roomId,
        sender,
        content,
        createdAt: new Date()
    };

    messages.push(newMMessage);
    res.status(201).json(newMMessage);
};
