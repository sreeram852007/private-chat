const mongoose = require("mongoose");

const MessageSchema = new mongoose.Schema({
    user: String,
    text: String,
    file: String,
    voice: String,
    type: String,
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Message", MessageSchema);