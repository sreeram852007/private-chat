const mongoose = require("mongoose");

const MessageSchema = new mongoose.Schema({
    sender: {
        type: String,
        required: true
    },

    receiver: {
        type: String,
        required: true
    },

    text: {
        type: String,
        default: ""
    },

    file: {
        type: String,
        default: ""
    },

    voice: {
        type: String,
        default: ""
    },

    type: {
        type: String,
        enum: ["text", "file", "voice"],
        default: "text"
    },

    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model("Message", MessageSchema);