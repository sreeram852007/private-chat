const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema({
    username: { type: String, unique: true },
    password: String,
    friends: [{ type: String, default: [] }], // List of friend usernames
    friendRequests: [{ type: String, default: [] }], // Incoming friend requests
    sentRequests: [{ type: String, default: [] }], // Outgoing friend requests
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("User", UserSchema);