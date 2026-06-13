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

const io = new Server(server, {
    cors: {
        origin: "*"
    }
});

const JWT_SECRET =
    process.env.JWT_SECRET ||
    "ghost_secret_key_123";

const onlineUsers = {};

/* ================= MIDDLEWARE ================= */

app.use(express.json({ limit: "20mb" }));
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

        const exists = await User.findOne({
            username
        });

        if (exists) {
            return res.json({
                error: "User already exists"
            });
        }

        const hashed =
            await bcrypt.hash(password, 10);

        const user = await User.create({
            username,
            password: hashed
        });

        const token = jwt.sign(
            {
                id: user._id,
                username: user.username
            },
            JWT_SECRET,
            { expiresIn: "7d" }
        );

        res.json({
            token,
            user: {
                username: user.username
            }
        });

    } catch (err) {
        console.log(err);

        res.json({
            error: "Register failed"
        });
    }
});

// LOGIN
app.post("/login", async (req, res) => {

    try {

        const { username, password } = req.body;

        const user =
            await User.findOne({ username });

        if (!user) {
            return res.json({
                error: "User not found"
            });
        }

        const match =
            await bcrypt.compare(
                password,
                user.password
            );

        if (!match) {
            return res.json({
                error: "Wrong password"
            });
        }

        const token = jwt.sign(
            {
                id: user._id,
                username: user.username
            },
            JWT_SECRET,
            { expiresIn: "7d" }
        );

        res.json({
            token,
            user: {
                username: user.username
            }
        });

    } catch (err) {

        console.log(err);

        res.json({
            error: "Login failed"
        });
    }
});

/* ================= USERS API ================= */

app.get("/users", async (req, res) => {

    try {

        const users = await User.find(
            {},
            {
                username: 1,
                _id: 0
            }
        );

        res.json(users);

    } catch (err) {

        res.json([]);
    }
});

/* ================= CHAT HISTORY ================= */

app.get(
    "/messages/:user1/:user2",
    async (req, res) => {

        try {

            const { user1, user2 } =
                req.params;

            const messages =
                await Message.find({
                    $or: [
                        {
                            sender: user1,
                            receiver: user2
                        },
                        {
                            sender: user2,
                            receiver: user1
                        }
                    ]
                })
                    .sort({
                        createdAt: 1
                    });

            res.json(messages);

        } catch (err) {

            console.log(err);

            res.json([]);
        }
    }
);

/* ================= SOCKET ================= */

io.on("connection", socket => {

    console.log("Connected:", socket.id);

    socket.on("set user", token => {

        try {

            const decoded =
                jwt.verify(
                    token,
                    JWT_SECRET
                );

            socket.username =
                decoded.username;

            onlineUsers[
                decoded.username
            ] = socket.id;

            io.emit(
                "online users",
                Object.keys(onlineUsers)
            );

            console.log(
                decoded.username,
                "online"
            );

        } catch (err) {

            console.log(
                "JWT verify failed"
            );
        }
    });

    socket.on(
        "private message",
        async msg => {

            try {

                const receiverSocket =
                    onlineUsers[
                        msg.receiver
                    ];

                const saved =
                    await Message.create({
                        sender:
                            socket.username,

                        receiver:
                            msg.receiver,

                        text:
                            msg.text || "",

                        file:
                            msg.file || "",

                        voice:
                            msg.voice || "",

                        type:
                            msg.type || "text"
                    });

                socket.emit(
                    "private message",
                    saved
                );

                if (
                    receiverSocket
                ) {

                    io.to(
                        receiverSocket
                    ).emit(
                        "private message",
                        saved
                    );
                }

            } catch (err) {

                console.log(
                    "Private message error:",
                    err
                );
            }
        }
    );

    socket.on(
        "disconnect",
        () => {

            if (
                socket.username
            ) {

                delete onlineUsers[
                    socket.username
                ];

                io.emit(
                    "online users",
                    Object.keys(
                        onlineUsers
                    )
                );

                console.log(
                    socket.username,
                    "offline"
                );
            }
        }
    );
});

/* ================= START ================= */

const PORT =
    process.env.PORT || 3000;

server.listen(PORT, () => {

    console.log(
        `Commit Chat running on port ${PORT}`
    );
});
