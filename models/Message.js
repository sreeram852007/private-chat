const mongoose = require("mongoose");

const MessageSchema = new mongoose.Schema({
    user: String,
    text: String,
    file: String,   // file URL (if any)
    voice: String,  // voice audio URL (if any)
    type: {
        type: String,
        default: "text" // text | file | voice
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model("Message", MessageSchema);