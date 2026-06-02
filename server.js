require("dotenv").config();

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const mongoose = require("mongoose");
const cloudinary = require("cloudinary").v2;
const streamifier = require("streamifier");

const Message = require("./models/Message");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// ================= CLOUDINARY =================
cloudinary.config({
    cloud_name: process.env.CLOUD_NAME,
    api_key: process.env.CLOUD_API_KEY,
    api_secret: process.env.CLOUD_API_SECRET
});

// ================= MONGO =================
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log("MongoDB connected"))
    .catch(err => console.log(err));

app.use(express.static("public"));
app.use(express.json({ limit: "50mb" }));

// ================= CLOUD UPLOAD FUNCTION =================
function uploadToCloud(buffer, resourceType = "auto") {
    return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
            { resource_type: resourceType },
            (error, result) => {
                if (error) return reject(error);
                resolve(result);
            }
        );

        streamifier.createReadStream(buffer).pipe(uploadStream);
    });
}

// ================= SOCKET =================
io.on("connection", async (socket) => {

    socket.on("set username", (name) => {
        socket.username = name;
    });

    const msgs = await Message.find().sort({ createdAt: 1 });
    socket.emit("chat history", msgs);

    socket.on("chat message", async (data) => {
        try {
            let fileUrl = "";
            let voiceUrl = "";

            // TEXT ONLY
            if (data.type === "text") {
                // nothing
            }

            // FILE
            if (data.type === "file") {
                const result = await uploadToCloud(
                    Buffer.from(data.file, "base64"),
                    "auto"
                );
                fileUrl = result.secure_url;
            }

            // VOICE
            if (data.type === "voice") {
                const result = await uploadToCloud(
                    Buffer.from(data.voice, "base64"),
                    "video"
                );
                voiceUrl = result.secure_url;
            }

            const msg = {
                user: socket.username || "Ghost",
                text: data.text || "",
                file: fileUrl,
                voice: voiceUrl,
                type: data.type
            };

            await Message.create(msg);
            io.emit("chat message", msg);

        } catch (err) {
            console.error("UPLOAD ERROR:", err);
        }
    });
});

server.listen(3000, () => {
    console.log("👻 Ghost Chat PRO running");
});