// export const messages: {
//     id: string;
//     roomId: string;
//     sender: string;
//     content: string;
//     createdAt: Date;
// }[] = [];
import mongoose, { Schema, Document } from "mongoose";
const MessageSchema = new Schema({
    roomId: { type: String, required: true },
    sender: { type: String, required: true },
    content: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
});
export default mongoose.model('Message', MessageSchema);
//# sourceMappingURL=message.js.map