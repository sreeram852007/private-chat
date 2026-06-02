require("dotenv").config();

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const Message = require("./models/Message");
const User = require("./models/User");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json({ limit: "10mb" }));
app.use(express.static("public"));

/* ================= DATABASE ================= */

mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log("MongoDB connected"))
    .catch(err => console.log(err));

/* ================= AUTH ================= */

// REGISTER
app.post("/register", async (req, res) => {
    try {
        const { username, password } = req.body;

        const exists = await User.findOne({ username });
        if (exists) return res.json({ error: "User already exists" });

        const hashed = await bcrypt.hash(password, 10);

        const user = await User.create({
            username,
            password: hashed
        });

        res.json({ user });
    } catch (err) {
        res.json({ error: "Register failed" });
    }
});

// LOGIN
app.post("/login", async (req, res) => {
    try {
        const { username, password } = req.body;

        const user = await User.findOne({ username });
        if (!user) return res.json({ error: "User not found" });

        const match = await bcrypt.compare(password, user.password);
        if (!match) return res.json({ error: "Wrong password" });

        res.json({ user: { username: user.username } });
    } catch (err) {
        res.json({ error: "Login failed" });
    }
});

/* ================= SOCKET ================= */

io.on("connection", async (socket) => {

    console.log("User connected");

    // CHAT HISTORY (LIMIT FIX)
    const messages = await Message.find()
        .sort({ createdAt: -1 })
        .limit(1000);

    socket.emit("chat history", messages.reverse());

    socket.on("set user", (user) => {
        socket.user = user.username;
    });

    socket.on("chat message", async (msg) => {

        const saved = await Message.create({
            user: socket.user || "Ghost",
            text: msg.text,
            file: msg.file,
            voice: msg.voice,
            type: msg.type
        });

        // AUTO LIMIT CLEANUP (keep last 1000)
        const count = await Message.countDocuments();

        if (count > 1000) {
            const old = await Message.find()
                .sort({ createdAt: 1 })
                .limit(count - 1000);

            await Message.deleteMany({
                _id: { $in: old.map(m => m._id) }
            });
        }

        io.emit("chat message", saved);
    });

    socket.on("disconnect", () => {
        console.log("User disconnected");
    });
});

/* ================= SERVER ================= */

server.listen(3000, () => {
    console.log("Ghost Pro running on http://localhost:3000");
});