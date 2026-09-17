// export const messages: {
//     id: string;
//     roomId: string;
//     sender: string;
//     content: string;
//     createdAt: Date;
// }[] = [];


import mongoose, {Schema, Document} from "mongoose";

export interface IMessage extends Document {
    roomId: string;
    sender: string;
    content: string;
    createdAt: Date;
}

const MessageSchema: Schema = new Schema({
    roomId: { type: String, required: true},
    sender: { type: String, required: true},
    content: { type: String, required: true},
    createdAt: { type: Date, default: Date.now}
});

export default mongoose.model<IMessage>('Message', MessageSchema);