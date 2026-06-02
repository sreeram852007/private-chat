require("dotenv").config();

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const mongoose = require("mongoose");

const Message = require("./models/Message");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// ================= DB =================
const mongoURI = process.env.MONGO_URI;

if (!mongoURI) {
    console.error("MONGO_URI missing!");
    process.exit(1);
}

mongoose.connect(mongoURI)
    .then(() => console.log("MongoDB connected"))
    .catch(err => console.log(err));

// ================= STATIC =================
app.use(express.static("public"));

// ================= SOCKET =================
io.on("connection", async (socket) => {

    console.log("User connected");

    socket.on("set username", (name) => {
        socket.username = name;
    });

    // send history ONLY ONCE (FIXED)
    try {
        const msgs = await Message.find().sort({ createdAt: 1 }).limit(1000);
        socket.emit("chat history", msgs);
    } catch (err) {
        console.log(err);
    }

    // ================= MESSAGE HANDLER =================
    socket.on("chat message", async (data) => {
        try {

            const msg = {
                user: socket.username || "Ghost",
                text: data.text || "",
                file: data.file || "",
                voice: data.voice || "",
                type: data.type
            };

            const saved = await Message.create(msg);

            // ================= AUTO DELETE OLD (KEEP 1000) =================
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

// ================= START =================
server.listen(3000, () => {
    console.log("👻 Ghost Ultimate running on port 3000");
});