require("dotenv").config();

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const mongoose = require("mongoose");

const Message = require("./models/Message");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// ================= MONGO =================
const mongoURI = process.env.MONGO_URI;

if (!mongoURI) {
    console.error("MONGO_URI missing!");
    process.exit(1);
}

mongoose.connect(mongoURI)
    .then(() => console.log("MongoDB connected"))
    .catch(err => console.log(err));

app.use(express.static("public"));

// ================= SOCKET =================
io.on("connection", async (socket) => {

    socket.on("set username", (name) => {
        socket.username = name;
    });

    // send history
    const msgs = await Message.find().sort({ createdAt: 1 });
    socket.emit("chat history", msgs);

    socket.on("chat message", async (data) => {
        try {

            const msg = {
                user: socket.username || "Ghost",
                text: data.text || "",
                file: data.file || "",
                voice: data.voice || "",
                type: data.type
            };

            await Message.create(msg);

            // ================= AUTO DELETE OLD MESSAGES =================
            const count = await Message.countDocuments();

            if (count > 1000) {
                const extra = count - 1000;

                const oldMsgs = await Message.find()
                    .sort({ createdAt: 1 })
                    .limit(extra);

                const ids = oldMsgs.map(m => m._id);

                await Message.deleteMany({ _id: { $in: ids } });
            }

            io.emit("chat message", msg);

        } catch (err) {
            console.error("Message error:", err);
        }
    });
});

// ================= START =================
server.listen(3000, () => {
    console.log("👻 Ghost Chat running");
});