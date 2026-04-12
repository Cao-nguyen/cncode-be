import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
    email: String,
    name: String,
    avatar: String,
    provider: String,
    role: {
        type: String,
        default: "user"
    }
}, { timestamps: true });

export default mongoose.model("User", userSchema);