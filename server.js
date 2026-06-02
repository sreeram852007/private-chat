require("dotenv").config();

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const mongoose = require("mongoose");

const Message = require("./models/Message");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// ================= MongoDB =================
const mongoURI = process.env.MONGO_URI;

if (!mongoURI) {
    console.error("MONGO_URI is missing!");
    process.exit(1);
}

mongoose.connect(mongoURI)
    .then(() => console.log("MongoDB connected"))
    .catch(err => console.error("MongoDB Error:", err));

// ================= Middleware =================
app.use(express.static("public"));

// ================= Socket.io =================
io.on("connection", async (socket) => {
    console.log("User connected");

    // store username
    socket.on("set username", (username) => {
        socket.username = username;
    });

    // send history
    try {
        const messages = await Message.find().sort({ createdAt: 1 });
        socket.emit("chat history", messages);
    } catch (err) {
        console.error("Error loading messages:", err);
    }

    // receive message
    socket.on("chat message", async (msg) => {
        try {
            const fullMessage = {
                user: socket.username || "Anonymous",
                text: msg
            };

            await Message.create(fullMessage);

            io.emit("chat message", fullMessage);
        } catch (err) {
            console.error("Error saving message:", err);
        }
    });

    socket.on("disconnect", () => {
        console.log("User disconnected");
    });
});

// ================= Start =================
server.listen(3000, () => {
    console.log("Server running on http://localhost:3000");
});