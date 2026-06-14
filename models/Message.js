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
        enum: ["text", "file", "voice", "image"],
        default: "text"
    },
    fileType: {
        type: String,
        default: ""
    },
    fileName: {
        type: String,
        default: ""
    },
    reactions: {
        type: Object,
        default: {}
    },
    edited: {
        type: Boolean,
        default: false
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model("Message", MessageSchema);