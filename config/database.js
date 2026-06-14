const mongoose = require("mongoose");
const User = require("../models/User");

// ADMIN USER - Can see and chat with everyone
const ADMIN_USERS = ["Sreeram", "sreeram"];

// Helper: Check if user can SEND message to target
const canSendMessage = async (sender, receiver) => {
    if (ADMIN_USERS.includes(sender)) return true;
    const user = await User.findOne({ username: sender });
    return user && user.friends.includes(receiver);
};

// Helper: Check if user can VIEW messages with target
const canViewMessages = async (user1, user2) => {
    if (ADMIN_USERS.includes(user1) || ADMIN_USERS.includes(user2)) return true;
    const user = await User.findOne({ username: user1 });
    return user && user.friends.includes(user2);
};

// Helper: Get visible users for a user
const getVisibleUsers = async (username) => {
    const user = await User.findOne({ username });
    if (!user) return [];
    
    if (ADMIN_USERS.includes(username)) {
        const allUsers = await User.find({}, { username: 1, _id: 0 });
        return allUsers.map(u => u.username).filter(u => u !== username);
    }
    
    return user.friends || [];
};

// Connect to MongoDB
const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("MongoDB connected");
    } catch (err) {
        console.log(err);
    }
};

module.exports = {
    ADMIN_USERS,
    canSendMessage,
    canViewMessages,
    getVisibleUsers,
    connectDB
};