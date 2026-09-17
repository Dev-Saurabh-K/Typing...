import mongoose, { Schema, Document } from 'mongoose';
const UserSchema = new Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true }
});
export default mongoose.model('User', UserSchema);
//# sourceMappingURL=user.js.map