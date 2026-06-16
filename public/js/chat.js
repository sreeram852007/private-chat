// ================= MAIN CHAT JS - LOADS ALL MODULES =================
// This file loads all the modular JavaScript files

// Load core module (socket, variables, auth, scroll)
document.write('<script src="/js/modules/core.js"><\/script>');

// Load friends module
document.write('<script src="/js/modules/friends.js"><\/script>');

// Load chat module
document.write('<script src="/js/modules/chat-module.js"><\/script>');

// ================= SOCKET EVENTS (depends on all modules) =================

// These need to be defined after all modules are loaded
// We'll use DOMContentLoaded to ensure everything is ready
document.addEventListener('DOMContentLoaded', function() {
    // Socket events
    socket.on("online users", users => {
        onlineUsers = users;
        if (typeof loadFriends === 'function') loadFriends();
    });

    socket.on("private message", msg => {
        if (msg.sender === selectedUser || msg.receiver === selectedUser) {
            if (typeof renderMessage === 'function') renderMessage(msg);
        }
    });

    socket.on("message edited", (data) => {
        if (data.sender === selectedUser || data.receiver === selectedUser) {
            const messages = document.querySelectorAll(".message-wrapper");
            for (const msgWrapper of messages) {
                const timeSpan = msgWrapper.querySelector(".message-time");
                if (timeSpan && !timeSpan.innerHTML.includes("edited")) {
                    const msgDiv = msgWrapper.querySelector(".msg");
                    if (msgDiv) {
                        const oldText = msgDiv.querySelector(".message-text");
                        if (oldText) oldText.remove();
                        const newTextNode = document.createTextNode(data.newText);
                        msgDiv.insertBefore(newTextNode, timeSpan);
                        timeSpan.innerHTML += ' <span class="edited-badge">(edited)</span>';
                    }
                    break;
                }
            }
        }
    });

    socket.on("message deleted", (data) => {
        if (data.sender === selectedUser || data.receiver === selectedUser) {
            const messages = document.querySelectorAll(".message-wrapper");
            for (const msgWrapper of messages) {
                const userSpan = msgWrapper.querySelector(".user");
                if (userSpan && userSpan.textContent.includes(data.sender)) {
                    msgWrapper.remove();
                    break;
                }
            }
        }
    });

    socket.on("reaction added", (data) => {
        if (data.sender === selectedUser || data.receiver === selectedUser) {
            const messages = document.querySelectorAll(".message-wrapper");
            for (const msgWrapper of messages) {
                const userSpan = msgWrapper.querySelector(".user");
                if (userSpan && userSpan.textContent.includes(data.user)) {
                    const reactionsDiv = msgWrapper.querySelector(".reactions-display") || document.createElement("div");
                    reactionsDiv.className = "reactions-display";
                    reactionsDiv.innerHTML = "";
                    if (data.reactions) {
                        for (const [reaction, users] of Object.entries(data.reactions)) {
                            const reactionSpan = document.createElement("span");
                            reactionSpan.className = "reaction-count";
                            reactionSpan.textContent = `${reaction} ${users.length}`;
                            reactionsDiv.appendChild(reactionSpan);
                        }
                    }
                    if (!msgWrapper.querySelector(".reactions-display")) {
                        msgWrapper.querySelector(".msg").appendChild(reactionsDiv);
                    }
                    break;
                }
            }
        }
    });

    socket.on("friend-request-received", ({ from }) => {
        alert(`📨 New friend request from ${from}!`);
        if (typeof loadFriendRequests === 'function') loadFriendRequests();
    });

    socket.on("friend-request-accepted", ({ by }) => {
        alert(`✅ ${by} accepted your friend request!`);
        if (typeof loadFriends === 'function') loadFriends();
        if (typeof loadVisibleUsers === 'function') loadVisibleUsers();
    });

    socket.on("error", (error) => {
        alert(error);
    });
});({ token: currentResetToken, newPassword, username: resetUsername })
    });
    const data = await res.json();
    
    if (data.success) { alert("Password reset successful!"); closeResetModal(); }
    else { alert(data.error); }
}

function showChangePassword() {
    document.getElementById("changePwdModal").style.display = "flex";
}

function closeChangePwdModal() {
    document.getElementById("changePwdModal").style.display = "none";
}

async function changePassword() {
    const currentPassword = document.getElementById("currentPassword").value;
    const newPassword = document.getElementById("newPasswordChange").value;
    const confirmPassword = document.getElementById("confirmNewPassword").value;
    
    if (!currentPassword || !newPassword || !confirmPassword) { alert("Fill all fields"); return; }
    if (newPassword !== confirmPassword) { alert("New passwords don't match"); return; }
    
    const res = await fetch("/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, currentPassword, newPassword })
    });
    const data = await res.json();
    
    if (data.success) { alert("Password changed! Please login again."); location.reload(); }
    else { alert(data.error); }
}

// ================= TYPING INDICATOR =================
let typingTimeout;

document.getElementById("input").addEventListener("input", () => {
    if (!selectedUser) return;
    socket.emit("typing", { receiver: selectedUser, isTyping: true });
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
        socket.emit("typing", { receiver: selectedUser, isTyping: false });
    }, 1000);
});

socket.on("user typing", (data) => {
    const indicator = document.getElementById("typingIndicator");
    if (data.sender === selectedUser) {
        indicator.style.display = data.isTyping ? "block" : "none";
        indicator.textContent = data.isTyping ? `${data.sender} is typing...` : "";
    }
});

// ================= KEYBOARD SHORTCUTS =================
document.getElementById("input").addEventListener("keydown", e => { 
    if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});
document.getElementById("usernameInput").addEventListener("keydown", e => { 
    if (e.key === "Enter") login(); 
});