import { messages } from "../models/message.js";
export const getMessages = (req, res) => {
    const { roomId } = req.params;
    const roomMessages = messages.filter(m => m.roomId === roomId);
    res.json(roomMessages);
};
export const sendMessages = (req, res) => {
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
//# sourceMappingURL=chatController.js.map