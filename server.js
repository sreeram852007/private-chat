require("dotenv").config();

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const mongoose = require("mongoose");
const multer = require("multer");
const path = require("path");

const Message = require("./models/Message");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// ================= MongoDB =================
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log("MongoDB connected"))
    .catch(err => console.log(err));

// ================= Static =================
app.use(express.static("public"));
app.use("/uploads", express.static("uploads"));
app.use(express.json());

// ================= File Upload =================
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, "uploads"),
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});

const upload = multer({ storage });

// upload file route
app.post("/upload", upload.single("file"), (req, res) => {
    res.json({ fileUrl: "/uploads/" + req.file.filename });
});

// ================= Socket =================
io.on("connection", async (socket) => {

    socket.on("set username", (name) => {
        socket.username = name;
    });

    const msgs = await Message.find().sort({ createdAt: 1 });
    socket.emit("chat history", msgs);

    socket.on("chat message", async (data) => {

        const msg = {
            user: socket.username || "Ghost",
            text: data.text || "",
            file: data.file || "",
            voice: data.voice || "",
            type: data.type
        };

        await Message.create(msg);

        io.emit("chat message", msg);
    });
});

server.listen(3000, () => {
    console.log("👻 Ghost Chat running on http://localhost:3000");
});