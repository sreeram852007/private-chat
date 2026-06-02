require("dotenv").config();

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const Message = require("./models/Message");
const User = require("./models/User");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const JWT_SECRET = process.env.JWT_SECRET || "ghost_secret_key_123";

/* ================= MIDDLEWARE ================= */

app.use(express.json({ limit: "10mb" }));
app.use(express.static("public"));

/* ================= DATABASE ================= */

mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log("MongoDB connected"))
    .catch(err => console.log(err));

/* ================= AUTH APIs ================= */

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

        const token = jwt.sign(
            { id: user._id, username: user.username },
            JWT_SECRET,
            { expiresIn: "7d" }
        );

        res.json({
            token,
            user: { username: user.username }
        });

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

        const token = jwt.sign(
            { id: user._id, username: user.username },
            JWT_SECRET,
            { expiresIn: "7d" }
        );

        res.json({
            token,
            user: { username: user.username }
        });

    } catch (err) {
        res.json({ error: "Login failed" });
    }
});

/* ================= SOCKET AUTH ================= */

io.on("connection", async (socket) => {

    console.log("User connected");

    // LOAD LAST 1000 MESSAGES
    const messages = await Message.find()
        .sort({ createdAt: -1 })
        .limit(1000);

    socket.emit("chat history", messages.reverse());

    // JWT AUTH
    socket.on("set user", (token) => {
        try {
            const decoded = jwt.verify(token, JWT_SECRET);
            socket.user = decoded.username;
        } catch (err) {
            socket.user = "Ghost";
        }
    });

    // CHAT MESSAGE
    socket.on("chat message", async (msg) => {
        try {
            const saved = await Message.create({
                user: socket.user || "Ghost",
                text: msg.text,
                file: msg.file,
                voice: msg.voice,
                type: msg.type
            });

            // KEEP ONLY LAST 1000 MESSAGES
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

        } catch (err) {
            console.log("Message error:", err);
        }
    });

    socket.on("disconnect", () => {
        console.log("User disconnected");
    });
});

/* ================= START SERVER ================= */

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
    console.log(`Ghost Pro running on port ${PORT}`);
});