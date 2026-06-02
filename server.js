require("dotenv").config();

console.log("MONGO_URI =", process.env.MONGO_URI);

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const mongoose = require("mongoose");

const Message = require("./models/Message");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// =====================
// MongoDB Connection FIX
// =====================
const mongoURI = process.env.MONGO_URI;

if (!mongoURI) {
    console.error("MONGO_URI is missing!");
    process.exit(1);
}

mongoose.connect(mongoURI)
    .then(() => {
        console.log("MongoDB connected");
    })
    .catch((err) => {
        console.error("MongoDB Error:", err);
    });

// =====================
// App Setup
// =====================
app.use(express.static("public"));

// =====================
// Socket.io Chat Logic
// =====================
io.on("connection", async (socket) => {
    console.log("User connected");

    try {
        const messages = await Message.find().sort({ createdAt: 1 });
        socket.emit("chat history", messages);
    } catch (err) {
        console.error("Error loading messages:", err);
    }

    socket.on("chat message", async (msg) => {
        try {
            await Message.create({ text: msg });
            io.emit("chat message", msg);
        } catch (err) {
            console.error("Error saving message:", err);
        }
    });

    socket.on("disconnect", () => {
        console.log("User disconnected");
    });
});

// =====================
// Start Server
// =====================
server.listen(3000, () => {
    console.log("Server running on http://localhost:3000");
});