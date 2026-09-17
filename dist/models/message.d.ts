import mongoose, { Document } from "mongoose";
export interface IMessage extends Document {
    roomId: string;
    sender: string;
    content: string;
    createdAt: Date;
}
declare const _default: mongoose.Model<IMessage, {}, {}, {}, Document<unknown, {}, IMessage, {}, mongoose.DefaultSchemaOptions> & IMessage & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
} & {
    id: string;
}, any, IMessage>;
export default _default;
//# sourceMappingURL=message.d.ts.map