require("dotenv").config();

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const mongoose = require("mongoose");

const Message = require("./models/Message");
const User = require("./models/User");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());
app.use(express.static("public"));

// ================= DB =================
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log("MongoDB connected"))
    .catch(err => console.log(err));

// ================= AUTH API =================

// REGISTER
app.post("/register", async (req, res) => {
    try {
        const { username, password } = req.body;

        const exists = await User.findOne({ username });
        if (exists) return res.json({ error: "User already exists" });

        const user = await User.create({ username, password });
        res.json({ success: true, user });
    } catch (err) {
        res.json({ error: err.message });
    }
});

// LOGIN
app.post("/login", async (req, res) => {
    try {
        const { username, password } = req.body;

        const user = await User.findOne({ username, password });

        if (!user) return res.json({ error: "Invalid credentials" });

        res.json({ success: true, user });
    } catch (err) {
        res.json({ error: err.message });
    }
});

// ================= SOCKET =================
io.on("connection", async (socket) => {

    console.log("User connected");

    socket.on("set user", (user) => {
        socket.user = user;
    });

    // HISTORY
    const msgs = await Message.find().sort({ createdAt: 1 }).limit(1000);
    socket.emit("chat history", msgs);

    // MESSAGE
    socket.on("chat message", async (data) => {
        try {

            const msg = await Message.create({
                user: socket.user?.username || "Ghost",
                text: data.text || "",
                file: data.file || "",
                voice: data.voice || "",
                type: data.type
            });

            // keep only last 1000
            const count = await Message.countDocuments();
            if (count > 1000) {
                const old = await Message.find()
                    .sort({ createdAt: 1 })
                    .limit(count - 1000);

                await Message.deleteMany({
                    _id: { $in: old.map(m => m._id) }
                });
            }

            io.emit("chat message", msg);

        } catch (err) {
            console.log(err);
        }
    });
});

server.listen(3000, () => {
    console.log("👻 Ghost Auth Chat running");
});