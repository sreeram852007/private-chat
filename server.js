require("dotenv").config();

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const Message = require("./models/Message");
const User = require("./models/User");
const { ADMIN_USERS, canSendMessage, canViewMessages, getVisibleUsers, connectDB } = require("./config/database");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
    cors: { origin: "*" }
});

const JWT_SECRET = process.env.JWT_SECRET || "ghost_secret_key_123";
const onlineUsers = {};
const userStatus = {};

/* ================= MIDDLEWARE ================= */

app.use(express.json({ limit: "20mb" }));
app.use(express.static("public"));

/* ================= DATABASE ================= */

connectDB();

/* ================= AUTH ================= */

app.post("/register", async (req, res) => {
    try {
        const { username, password } = req.body;

        const exists = await User.findOne({ username });
        if (exists) {
            return res.json({ error: "User already exists" });
        }

        const hashed = await bcrypt.hash(password, 10);

        const user = await User.create({
            username,
            password: hashed,
            friends: [],
            friendRequests: [],
            sentRequests: []
        });

        const token = jwt.sign(
            { id: user._id, username: user.username },
            JWT_SECRET,
            { expiresIn: "7d" }
        );

        res.json({
            token,
            user: {
                username: user.username,
                friends: user.friends
            }
        });

    } catch (err) {
        console.log(err);
        res.json({ error: "Register failed" });
    }
});

app.post("/login", async (req, res) => {
    try {
        const { username, password } = req.body;

        const user = await User.findOne({ username });
        if (!user) {
            return res.json({ error: "User not found" });
        }

        const match = await bcrypt.compare(password, user.password);
        if (!match) {
            return res.json({ error: "Wrong password" });
        }

        const token = jwt.sign(
            { id: user._id, username: user.username },
            JWT_SECRET,
            { expiresIn: "7d" }
        );

        res.json({
            token,
            user: {
                username: user.username,
                friends: user.friends
            }
        });

    } catch (err) {
        console.log(err);
        res.json({ error: "Login failed" });
    }
});

/* ================= FRIEND SYSTEM API ================= */

app.post("/send-friend-request", async (req, res) => {
    try {
        const { from, to } = req.body;
        
        if (from === to) {
            return res.json({ error: "Cannot send request to yourself" });
        }
        
        const targetUser = await User.findOne({ username: to });
        if (!targetUser) {
            return res.json({ error: "User not found" });
        }
        
        const sender = await User.findOne({ username: from });
        
        if (sender.friends.includes(to)) {
            return res.json({ error: "Already friends with this user" });
        }
        
        if (targetUser.friendRequests.includes(from)) {
            return res.json({ error: "Friend request already sent" });
        }
        
        await User.updateOne(
            { username: to },
            { $addToSet: { friendRequests: from } }
        );
        
        await User.updateOne(
            { username: from },
            { $addToSet: { sentRequests: to } }
        );
        
        const targetSocket = onlineUsers[to];
        if (targetSocket) {
            io.to(targetSocket).emit("friend-request-received", { from });
        }
        
        res.json({ success: true, message: "Friend request sent!" });
        
    } catch (err) {
        console.log(err);
        res.json({ error: "Failed to send request" });
    }
});

app.post("/accept-friend-request", async (req, res) => {
    try {
        const { username, requester } = req.body;
        
        await User.updateOne(
            { username: username },
            { 
                $addToSet: { friends: requester },
                $pull: { friendRequests: requester }
            }
        );
        
        await User.updateOne(
            { username: requester },
            { 
                $addToSet: { friends: username },
                $pull: { sentRequests: username }
            }
        );
        
        const requesterSocket = onlineUsers[requester];
        if (requesterSocket) {
            io.to(requesterSocket).emit("friend-request-accepted", { by: username });
        }
        
        res.json({ success: true, message: "Friend request accepted!" });
        
    } catch (err) {
        console.log(err);
        res.json({ error: "Failed to accept request" });
    }
});

app.post("/reject-friend-request", async (req, res) => {
    try {
        const { username, requester } = req.body;
        
        await User.updateOne(
            { username: username },
            { $pull: { friendRequests: requester } }
        );
        
        await User.updateOne(
            { username: requester },
            { $pull: { sentRequests: username } }
        );
        
        res.json({ success: true, message: "Friend request rejected" });
        
    } catch (err) {
        console.log(err);
        res.json({ error: "Failed to reject request" });
    }
});

app.get("/friend-requests/:username", async (req, res) => {
    try {
        const { username } = req.params;
        const user = await User.findOne({ username });
        res.json({ requests: user?.friendRequests || [] });
    } catch (err) {
        res.json({ requests: [] });
    }
});

app.get("/friends/:username", async (req, res) => {
    try {
        const { username } = req.params;
        const user = await User.findOne({ username });
        res.json({ friends: user?.friends || [] });
    } catch (err) {
        res.json({ friends: [] });
    }
});

app.get("/visible-users/:username", async (req, res) => {
    try {
        const { username } = req.params;
        const visibleUsers = await getVisibleUsers(username);
        res.json({ users: visibleUsers });
    } catch (err) {
        res.json({ users: [] });
    }
});

/* ================= USERS API ================= */

app.get("/users", async (req, res) => {
    try {
        const users = await User.find({}, { username: 1, _id: 0 });
        res.json(users);
    } catch (err) {
        res.json([]);
    }
});

app.get("/search-users/:query", async (req, res) => {
    try {
        const { query } = req.params;
        const currentUser = req.query.currentUser;
        
        const users = await User.find(
            { 
                username: { $regex: query, $options: "i" },
                username: { $ne: currentUser }
            },
            { username: 1, _id: 0 }
        ).limit(10);
        
        res.json(users);
    } catch (err) {
        res.json([]);
    }
});

/* ================= CHAT HISTORY ================= */

app.get("/messages/:user1/:user2", async (req, res) => {
    try {
        const { user1, user2 } = req.params;
        
        // Allow viewing if either user is admin (Sreeram)
        const isAdmin1 = ADMIN_USERS.includes(user1);
        const isAdmin2 = ADMIN_USERS.includes(user2);
        
        if (isAdmin1 || isAdmin2) {
            // Admin chat with anyone - allow viewing
            const messages = await Message.find({
                $or: [
                    { sender: user1, receiver: user2 },
                    { sender: user2, receiver: user1 }
                ]
            }).sort({ createdAt: 1 });
            return res.json(messages);
        }
        
        // Normal users: only view messages if they are friends
        const user = await User.findOne({ username: user1 });
        const areFriends = user && user.friends.includes(user2);
        
        if (!areFriends) {
            return res.json({ error: "Not friends", messages: [] });
        }
        
        const messages = await Message.find({
            $or: [
                { sender: user1, receiver: user2 },
                { sender: user2, receiver: user1 }
            ]
        }).sort({ createdAt: 1 });
        
        res.json(messages);
    } catch (err) {
        console.log(err);
        res.json([]);
    }
});

/* ================= PASSWORD RESET ================= */

app.post("/forgot-password", async (req, res) => {
    try {
        const { username } = req.body;
        const user = await User.findOne({ username });
        if (!user) {
            return res.json({ error: "User not found" });
        }
        
        const resetToken = jwt.sign(
            { id: user._id, username: user.username, type: "reset" },
            JWT_SECRET,
            { expiresIn: "1h" }
        );
        
        res.json({ success: true, resetToken });
    } catch (err) {
        res.json({ error: "Failed to generate reset token" });
    }
});

app.post("/reset-password", async (req, res) => {
    try {
        const { token, newPassword, username } = req.body;
        const decoded = jwt.verify(token, JWT_SECRET);
        
        if (decoded.username !== username) {
            return res.json({ error: "Invalid token" });
        }
        
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await User.updateOne({ username }, { $set: { password: hashedPassword } });
        
        res.json({ success: true, message: "Password reset successful!" });
    } catch (err) {
        res.json({ error: "Failed to reset password" });
    }
});

app.post("/change-password", async (req, res) => {
    try {
        const { username, currentPassword, newPassword } = req.body;
        const user = await User.findOne({ username });
        
        const isValid = await bcrypt.compare(currentPassword, user.password);
        if (!isValid) {
            return res.json({ error: "Current password is incorrect" });
        }
        
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await User.updateOne({ username }, { $set: { password: hashedPassword } });
        
        res.json({ success: true, message: "Password changed successfully!" });
    } catch (err) {
        res.json({ error: "Failed to change password" });
    }
});

/* ================= SOCKET ================= */

io.on("connection", socket => {
    console.log("Connected:", socket.id);

    socket.on("set user", token => {
        try {
            const decoded = jwt.verify(token, JWT_SECRET);
            socket.username = decoded.username;
            onlineUsers[decoded.username] = socket.id;
            
            io.emit("online users", Object.keys(onlineUsers));
            console.log(decoded.username, "online");
        } catch (err) {
            console.log("JWT verify failed");
        }
    });

    socket.on("private message", async msg => {
        try {
            // Check if sender can send to this receiver
            const canSend = await canSendMessage(socket.username, msg.receiver);
            
            if (!canSend) {
                socket.emit("error", "You can only message your friends");
                return;
            }
            
            const receiverSocket = onlineUsers[msg.receiver];

            const saved = await Message.create({
                sender: socket.username,
                receiver: msg.receiver,
                text: msg.text || "",
                file: msg.file || "",
                voice: msg.voice || "",
                type: msg.type || "text",
                fileType: msg.fileType || "",
                fileName: msg.fileName || "",
                voiceDuration: msg.voiceDuration || 0,
                reactions: {},
                edited: false
            });

            // Always send to sender
            socket.emit("private message", saved);
            
            // Send to receiver (they can SEE it even if they can't reply)
            if (receiverSocket) {
                io.to(receiverSocket).emit("private message", saved);
            }
        } catch (err) {
            console.log("Private message error:", err);
        }
    });

    socket.on("typing", ({ receiver, isTyping }) => {
        const receiverSocket = onlineUsers[receiver];
        if (receiverSocket) {
            io.to(receiverSocket).emit("user typing", { sender: socket.username, isTyping });
        }
    });

    socket.on("user status", ({ username, status }) => {
        userStatus[username] = status;
        io.emit("user status", { username, status });
    });

    socket.on("edit message", async ({ messageId, newText, receiver }) => {
        try {
            const message = await Message.findById(messageId);
            if (message && message.sender === socket.username) {
                message.text = newText;
                message.edited = true;
                await message.save();
                
                const receiverSocket = onlineUsers[receiver];
                const editData = { messageId, newText, sender: socket.username, receiver };
                
                if (receiverSocket) {
                    io.to(receiverSocket).emit("message edited", editData);
                }
                socket.emit("message edited", editData);
            }
        } catch (err) {
            console.log("Edit error:", err);
        }
    });

    socket.on("delete message", async ({ messageId, receiver }) => {
        try {
            const message = await Message.findById(messageId);
            if (message && message.sender === socket.username) {
                await Message.deleteOne({ _id: messageId });
                
                const receiverSocket = onlineUsers[receiver];
                const deleteData = { messageId, sender: socket.username, receiver };
                
                if (receiverSocket) {
                    io.to(receiverSocket).emit("message deleted", deleteData);
                }
                socket.emit("message deleted", deleteData);
            }
        } catch (err) {
            console.log("Delete error:", err);
        }
    });

    socket.on("add reaction", async ({ messageId, reaction, receiver }) => {
        try {
            const message = await Message.findById(messageId);
            if (message) {
                if (!message.reactions) message.reactions = {};
                if (!message.reactions[reaction]) message.reactions[reaction] = [];
                
                const userIndex = message.reactions[reaction].indexOf(socket.username);
                if (userIndex === -1) {
                    message.reactions[reaction].push(socket.username);
                } else {
                    message.reactions[reaction].splice(userIndex, 1);
                    if (message.reactions[reaction].length === 0) {
                        delete message.reactions[reaction];
                    }
                }
                
                await message.save();
                
                const receiverSocket = onlineUsers[receiver];
                const reactionData = { messageId, reaction, user: socket.username, receiver, reactions: message.reactions };
                
                if (receiverSocket) {
                    io.to(receiverSocket).emit("reaction added", reactionData);
                }
                socket.emit("reaction added", reactionData);
            }
        } catch (err) {
            console.log("Reaction error:", err);
        }
    });

    socket.on("disconnect", () => {
        if (socket.username) {
            delete onlineUsers[socket.username];
            io.emit("online users", Object.keys(onlineUsers));
            console.log(socket.username, "offline");
        }
    });
});

/* ================= START ================= */

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
    console.log(`Commit Chat running on port ${PORT}`);
    console.log(`👑 Admin (can message anyone): ${ADMIN_USERS.join(", ")}`);
    console.log(`🔒 Normal users can only message friends`);
});