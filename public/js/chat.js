const socket = io();
let username = "";
let token = "";
let selectedUser = "";
let onlineUsers = [];
let friendsList = [];
let friendRequests = [];
let verifiedUsers = ["Sreeram", "sreeram"];
let currentResetToken = null;
let resetUsername = null;

// ================= VOICE RECORDING VARIABLES =================
let mediaRecorder = null;
let audioChunks = [];
let recordingTimer = null;
let recordingSeconds = 0;
let isRecording = false;
let audioStream = null;

// ================= AUTO-SCROLL VARIABLES =================
let isUserScrolling = false;
let scrollTimeout;

// ================= SCROLL FUNCTIONS =================
function scrollToBottom() {
    const messagesDiv = document.getElementById("messages");
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
    document.getElementById("jumpToBottom").style.display = "none";
    isUserScrolling = false;
}

function checkScrollPosition() {
    const messagesDiv = document.getElementById("messages");
    const isNearBottom = messagesDiv.scrollHeight - messagesDiv.scrollTop - messagesDiv.clientHeight < 100;
    
    if (isNearBottom) {
        document.getElementById("jumpToBottom").style.display = "none";
    } else {
        document.getElementById("jumpToBottom").style.display = "flex";
    }
}

function autoScrollIfNeeded() {
    if (!isUserScrolling) {
        scrollToBottom();
    }
}

function setupScrollListener() {
    const messagesDiv = document.getElementById("messages");
    
    messagesDiv.addEventListener("scroll", () => {
        isUserScrolling = true;
        clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(() => {
            const isNearBottom = messagesDiv.scrollHeight - messagesDiv.scrollTop - messagesDiv.clientHeight < 100;
            if (isNearBottom) {
                isUserScrolling = false;
            }
        }, 3000);
        checkScrollPosition();
    });
}

// ================= UI HELPERS =================

function toggleSidebar() {
    document.getElementById("sidebar").classList.toggle("open");
}

function switchTab(tab) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.getElementById('friendsTab').style.display = 'none';
    document.getElementById('requestsTab').style.display = 'none';
    document.getElementById('searchTab').style.display = 'none';
    
    if (tab === 'friends') {
        document.querySelector('.tab:nth-child(1)').classList.add('active');
        document.getElementById('friendsTab').style.display = 'block';
        loadFriends();
    } else if (tab === 'requests') {
        document.querySelector('.tab:nth-child(2)').classList.add('active');
        document.getElementById('requestsTab').style.display = 'block';
        loadFriendRequests();
    } else if (tab === 'search') {
        document.querySelector('.tab:nth-child(3)').classList.add('active');
        document.getElementById('searchTab').style.display = 'block';
    }
}

// ================= FRIEND SYSTEM =================

async function loadFriends() {
    const isAdmin = verifiedUsers.includes(username);
    let usersToShow = [];
    
    if (isAdmin) {
        // Admin sees ALL users except themselves
        try {
            const allUsersRes = await fetch("/users");
            const allUsers = await allUsersRes.json();
            usersToShow = allUsers.map(u => u.username).filter(u => u !== username);
        } catch (err) {
            console.error("Failed to load users:", err);
        }
    } else {
        // Normal users see: friends + admin (Sreeram)
        try {
            const friendsRes = await fetch(`/friends/${username}`);
            const friendsData = await friendsRes.json();
            const myFriends = friendsData.friends || [];
            friendsList = myFriends;
            
            // Start with friends
            usersToShow = [...myFriends];
            
            // Add Sreeram (admin) if not already in friends list and not the current user
            const adminUser = verifiedUsers.find(u => u !== username);
            if (adminUser && !usersToShow.includes(adminUser)) {
                usersToShow.push(adminUser);
            }
        } catch (err) {
            console.error("Failed to load friends:", err);
        }
    }
    
    const container = document.getElementById("friendsList");
    if (!container) return;
    
    if (usersToShow.length === 0) {
        container.innerHTML = '<div style="padding:20px; text-align:center; color:#6b7280;">' + 
            (isAdmin ? '📭 No other users found.' : '👥 No friends yet. Use "Add Friend" tab to find friends!') + '</div>';
        return;
    }
    
    container.innerHTML = "";
    
    for (const user of usersToShow) {
        const online = onlineUsers.includes(user);
        const isVerified = verifiedUsers.includes(user);
        const isFriend = friendsList.includes(user);
        
        const div = document.createElement("div");
        div.className = "user-item";
        div.innerHTML = `
            <div class="user-name-wrapper">
                <div class="user-name">${escapeHtml(user)}</div>
                ${isVerified ? '<span class="verified-badge" title="Verified User"></span>' : ''}
                ${!isAdmin && isFriend ? '<span class="friend-badge">friend</span>' : ''}
                ${!isAdmin && isVerified && !isFriend ? '<span style="font-size:9px; margin-left:6px; color:#6b7280;">👑</span>' : ''}
            </div>
            <div class="user-status ${online ? 'user-online' : 'user-offline'}">
                ${online ? 'online' : 'offline'}
            </div>
        `;
        div.onclick = () => openChat(user);
        container.appendChild(div);
    }
}

// Helper function to escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

async function loadFriendRequests() {
    const res = await fetch(`/friend-requests/${username}`);
    const data = await res.json();
    friendRequests = data.requests || [];
    
    const container = document.getElementById("requestsList");
    if (friendRequests.length === 0) {
        container.innerHTML = '<div style="padding:20px; text-align:center; color:#6b7280;">No pending requests</div>';
        return;
    }
    
    container.innerHTML = "";
    for (const requester of friendRequests) {
        const div = document.createElement("div");
        div.className = "request-item";
        div.innerHTML = `
            <span>${escapeHtml(requester)}</span>
            <div class="request-actions">
                <button onclick="acceptRequest('${escapeHtml(requester)}')">✓ Accept</button>
                <button class="reject" onclick="rejectRequest('${escapeHtml(requester)}')">✗ Reject</button>
            </div>
        `;
        container.appendChild(div);
    }
}

async function acceptRequest(requester) {
    const res = await fetch("/accept-friend-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, requester })
    });
    const data = await res.json();
    if (data.success) {
        loadFriendRequests();
        loadFriends();
        loadVisibleUsers();
    } else {
        alert(data.error);
    }
}

async function rejectRequest(requester) {
    const res = await fetch("/reject-friend-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, requester })
    });
    const data = await res.json();
    if (data.success) {
        loadFriendRequests();
    } else {
        alert(data.error);
    }
}

async function searchUsers() {
    const query = document.getElementById("searchUserInput").value.trim();
    if (query.length < 2) {
        document.getElementById("searchResults").innerHTML = "";
        return;
    }
    
    const res = await fetch(`/search-users/${encodeURIComponent(query)}?currentUser=${username}`);
    const users = await res.json();
    
    const container = document.getElementById("searchResults");
    container.innerHTML = "";
    
    for (const user of users) {
        const isFriend = friendsList.includes(user.username);
        const isRequestSent = friendRequests.includes(user.username);
        
        const div = document.createElement("div");
        div.className = "search-result-item";
        div.innerHTML = `
            <span>${escapeHtml(user.username)}</span>
            ${!isFriend && !isRequestSent ? `<button class="request-btn" onclick="sendFriendRequest('${escapeHtml(user.username)}')">➕ Add Friend</button>` : 
              isRequestSent ? '<span style="font-size:10px; color:#6b7280;">Request sent</span>' : 
              '<span style="font-size:10px; color:#10b981;">✓ Friend</span>'}
        `;
        container.appendChild(div);
    }
}

async function sendFriendRequest(to) {
    const res = await fetch("/send-friend-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from: username, to })
    });
    const data = await res.json();
    if (data.success) {
        alert("Friend request sent!");
        searchUsers();
    } else {
        alert(data.error);
    }
}

async function loadVisibleUsers() {
    const res = await fetch(`/visible-users/${username}`);
    const data = await res.json();
}

// ================= AUTH =================

async function register() {
    const usernameInput = document.getElementById("usernameInput").value.trim();
    if (!usernameInput) { alert("Enter username"); return; }
    const password = prompt("Create password:");
    if (!password) return;
    
    const res = await fetch("/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: usernameInput, password })
    });
    const data = await res.json();
    if (data.error) { alert(data.error); return; }
    alert("✅ Registered successfully");
}

async function login() {
    const usernameInput = document.getElementById("usernameInput").value.trim();
    if (!usernameInput) { alert("Enter username"); return; }
    const password = prompt("Enter password:");
    if (!password) return;
    
    const res = await fetch("/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: usernameInput, password })
    });
    const data = await res.json();
    
    if (data.error) { alert(data.error); return; }
    
    username = data.user.username;
    token = data.token;
    socket.emit("set user", token);
    startChat();
}

function startChat() {
    document.getElementById("login").style.display = "none";
    document.getElementById("chat").style.display = "flex";
    loadFriends();
    loadFriendRequests();
    loadVisibleUsers();
    setupScrollListener();
}

// ================= CHAT =================

async function openChat(user) {
    selectedUser = user;
    if (window.innerWidth < 768) {
        document.getElementById("sidebar").classList.remove("open");
    }
    
    const isVerified = verifiedUsers.includes(user);
    const isFriend = friendsList.includes(user);
    const isAdmin = verifiedUsers.includes(username);
    
    // Update chat title
    document.getElementById("chatTitle").innerHTML = `~/chat/with/${escapeHtml(user)}${isVerified ? ' <span class="verified-badge"></span>' : ''}`;
    
    // Check if user can reply (if target is admin and not friends, and current user is not admin)
    const isReadOnly = isVerified && !isFriend && !isAdmin;
    
    // Update input box state
    const input = document.getElementById("input");
    const sendBtn = document.querySelector("#form button:last-child");
    
    if (isReadOnly) {
        input.disabled = true;
        input.placeholder = "🔒 Read-only - You can view messages but cannot reply";
        input.style.opacity = "0.5";
        sendBtn.style.opacity = "0.5";
        sendBtn.style.pointerEvents = "none";
        
        // Show a small indicator in header
        const titleSpan = document.getElementById("chatTitle");
        if (!document.getElementById("readonlyBadge")) {
            const badge = document.createElement("span");
            badge.id = "readonlyBadge";
            badge.innerHTML = " 🔒 read-only";
            badge.style.cssText = "font-size:11px; color:#ef4444; margin-left:8px;";
            titleSpan.appendChild(badge);
        }
    } else {
        input.disabled = false;
        input.placeholder = "type your message...";
        input.style.opacity = "1";
        sendBtn.style.opacity = "1";
        sendBtn.style.pointerEvents = "auto";
        
        // Remove readonly badge if exists
        const badge = document.getElementById("readonlyBadge");
        if (badge) badge.remove();
    }
    
    // Clear and load messages
    document.getElementById("messages").innerHTML = "";
    
    const res = await fetch(`/messages/${username}/${user}`);
    const messages = await res.json();
    if (!messages.error) {
        messages.forEach(msg => renderMessage(msg));
    }
    
    setTimeout(() => {
        scrollToBottom();
        isUserScrolling = false;
    }, 100);
}

function formatDuration(seconds) {
    if (!seconds || isNaN(seconds)) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function createVoicePlayer(base64Audio, duration) {
    const container = document.createElement("div");
    container.className = "voice-message";
    
    const audio = new Audio(`data:audio/webm;base64,${base64Audio}`);
    let isPlaying = false;
    let progressInterval = null;
    
    const playBtn = document.createElement("button");
    playBtn.className = "voice-play-btn";
    playBtn.innerHTML = "▶";
    playBtn.onclick = () => {
        if (isPlaying) {
            audio.pause();
            playBtn.innerHTML = "▶";
            isPlaying = false;
            if (progressInterval) clearInterval(progressInterval);
        } else {
            audio.play();
            playBtn.innerHTML = "⏸";
            isPlaying = true;
            
            const progressBar = container.querySelector(".voice-progress");
            progressInterval = setInterval(() => {
                if (audio.currentTime && audio.duration) {
                    const percent = (audio.currentTime / audio.duration) * 100;
                    progressBar.style.width = `${percent}%`;
                }
            }, 100);
        }
    };
    
    audio.onended = () => {
        playBtn.innerHTML = "▶";
        isPlaying = false;
        if (progressInterval) clearInterval(progressInterval);
        const progressBar = container.querySelector(".voice-progress");
        if (progressBar) progressBar.style.width = "0%";
    };
    
    const timeline = document.createElement("div");
    timeline.className = "voice-timeline";
    timeline.onclick = (e) => {
        const rect = timeline.getBoundingClientRect();
        const percent = (e.clientX - rect.left) / rect.width;
        audio.currentTime = percent * audio.duration;
    };
    
    const progress = document.createElement("div");
    progress.className = "voice-progress";
    timeline.appendChild(progress);
    
    const durationDisplay = document.createElement("span");
    durationDisplay.className = "voice-duration";
    durationDisplay.textContent = formatDuration(duration || audio.duration);
    
    container.appendChild(playBtn);
    container.appendChild(timeline);
    container.appendChild(durationDisplay);
    
    return container;
}

function renderMessage(msg) {
    const wrapper = document.createElement("div");
    wrapper.className = "message-wrapper";
    const isMe = msg.sender === username;
    wrapper.classList.add(isMe ? "me" : "other");
    
    const msgDiv = document.createElement("div");
    msgDiv.className = "msg";
    
    const userSpan = document.createElement("span");
    userSpan.className = "user";
    userSpan.innerHTML = `${escapeHtml(msg.sender)}${verifiedUsers.includes(msg.sender) ? ' <span class="verified-badge"></span>' : ''}`;
    msgDiv.appendChild(userSpan);
    
    if (msg.type === "text") {
        // Support for code blocks
        let text = msg.text || "";
        if (text.includes("```")) {
            text = text.replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>');
        }
        msgDiv.appendChild(document.createTextNode(text));
    } else if (msg.type === "file") {
        const fileLink = document.createElement("a");
        fileLink.href = `data:application/octet-stream;base64,${msg.file}`;
        fileLink.download = msg.fileName || "download";
        fileLink.innerHTML = "📎 Download File";
        msgDiv.appendChild(fileLink);
    } else if (msg.type === "image") {
        const img = document.createElement("img");
        img.src = `data:${msg.fileType || 'image/jpeg'};base64,${msg.file}`;
        img.className = "image-preview";
        img.style.maxWidth = "200px";
        img.style.maxHeight = "150px";
        img.style.borderRadius = "8px";
        img.style.cursor = "pointer";
        img.onclick = () => window.open(img.src);
        msgDiv.appendChild(img);
    } else if (msg.type === "voice") {
        const voicePlayer = createVoicePlayer(msg.voice, msg.voiceDuration);
        msgDiv.appendChild(voicePlayer);
    }
    
    // Display reactions if any
    if (msg.reactions && Object.keys(msg.reactions).length > 0) {
        const reactionsDiv = document.createElement("div");
        reactionsDiv.className = "reactions-display";
        for (const [reaction, users] of Object.entries(msg.reactions)) {
            const reactionSpan = document.createElement("span");
            reactionSpan.className = "reaction-count";
            reactionSpan.textContent = `${reaction} ${users.length}`;
            reactionsDiv.appendChild(reactionSpan);
        }
        msgDiv.appendChild(reactionsDiv);
    }
    
    const timeSpan = document.createElement("div");
    timeSpan.className = "message-time";
    timeSpan.textContent = new Date().toLocaleTimeString();
    if (msg.edited) {
        const editedSpan = document.createElement("span");
        editedSpan.className = "edited-badge";
        editedSpan.textContent = " (edited)";
        timeSpan.appendChild(editedSpan);
    }
    msgDiv.appendChild(timeSpan);
    
    // Add reaction buttons
    const reactionBar = document.createElement("div");
    reactionBar.className = "reaction-bar";
    const reactions = ["👍", "❤️", "😂", "😮", "😢"];
    reactions.forEach(emoji => {
        const btn = document.createElement("span");
        btn.className = "reaction-btn";
        btn.textContent = emoji;
        btn.onclick = () => addReaction(msg._id, emoji);
        reactionBar.appendChild(btn);
    });
    
    // Add edit/delete for own messages
    if (isMe) {
        const actionBar = document.createElement("div");
        actionBar.className = "message-actions";
        const editBtn = document.createElement("button");
        editBtn.className = "message-action-btn";
        editBtn.innerHTML = "✏️ edit";
        editBtn.onclick = () => editMessage(msg._id, msg.text);
        const deleteBtn = document.createElement("button");
        deleteBtn.className = "message-action-btn";
        deleteBtn.innerHTML = "🗑️ delete";
        deleteBtn.onclick = () => deleteMessage(msg._id);
        actionBar.appendChild(editBtn);
        actionBar.appendChild(deleteBtn);
        wrapper.appendChild(actionBar);
    }
    
    wrapper.appendChild(msgDiv);
    wrapper.appendChild(reactionBar);
    document.getElementById("messages").appendChild(wrapper);
    autoScrollIfNeeded();
}

function addReaction(messageId, reaction) {
    socket.emit("add reaction", {
        messageId: messageId,
        reaction: reaction,
        receiver: selectedUser
    });
}

function editMessage(messageId, currentText) {
    const input = document.getElementById("input");
    input.value = currentText;
    input.focus();
    input.style.border = "2px solid var(--accent-primary)";
    
    // Store that we're editing
    window.editingMessageId = messageId;
    
    // Change send button to update button temporarily
    const sendBtn = document.querySelector("#form button:last-child");
    const originalOnclick = sendBtn.onclick;
    sendBtn.innerHTML = "✏️ Update";
    sendBtn.onclick = () => {
        updateMessage(messageId);
    };
    
    // Restore after cancel or timeout
    const restoreBtn = () => {
        sendBtn.innerHTML = "⏎";
        sendBtn.onclick = originalOnclick;
        input.style.border = "";
        window.editingMessageId = null;
        input.removeEventListener("keydown", cancelEdit);
    };
    
    const cancelEdit = (e) => {
        if (e.key === "Escape") {
            restoreBtn();
            input.value = "";
            input.removeEventListener("keydown", cancelEdit);
        }
    };
    
    input.addEventListener("keydown", cancelEdit);
    
    // Auto-restore after 30 seconds
    setTimeout(restoreBtn, 30000);
}

function updateMessage(messageId) {
    const newText = document.getElementById("input").value.trim();
    if (newText) {
        socket.emit("edit message", {
            messageId: messageId,
            newText: newText,
            receiver: selectedUser
        });
    }
    document.getElementById("input").value = "";
    document.getElementById("input").style.border = "";
    window.editingMessageId = null;
    
    // Restore send button
    const sendBtn = document.querySelector("#form button:last-child");
    sendBtn.innerHTML = "⏎";
    sendBtn.onclick = sendMessage;
}

function deleteMessage(messageId) {
    if (confirm("Delete this message?")) {
        socket.emit("delete message", {
            messageId: messageId,
            receiver: selectedUser
        });
    }
}

async function sendMessage() {
    if (!selectedUser) { alert("Select a user first"); return; }
    
    // If editing a message
    if (window.editingMessageId) {
        updateMessage(window.editingMessageId);
        return;
    }
    
    const text = document.getElementById("input").value.trim();
    const file = document.getElementById("file").files[0];
    
    if (file) {
        const base64 = await toBase64(file);
        const isImage = file.type.startsWith("image/");
        socket.emit("private message", {
            receiver: selectedUser,
            text: "",
            type: isImage ? "image" : "file",
            file: base64,
            fileType: file.type,
            fileName: file.name
        });
        document.getElementById("file").value = "";
    } else if (text) {
        socket.emit("private message", { receiver: selectedUser, text, type: "text" });
    }
    
    document.getElementById("input").value = "";
}

// ================= ENHANCED VOICE RECORDING =================

async function sendVoice() {
    if (!selectedUser) {
        alert("Select a user first");
        return;
    }
    
    if (isRecording) {
        stopRecordingAndSend();
        return;
    }
    
    startRecording();
}

function startRecording() {
    navigator.mediaDevices.getUserMedia({ audio: true })
        .then(stream => {
            audioStream = stream;
            mediaRecorder = new MediaRecorder(stream);
            audioChunks = [];
            
            mediaRecorder.ondataavailable = event => {
                audioChunks.push(event.data);
            };
            
            mediaRecorder.onstop = () => {
                const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                sendVoiceMessage(audioBlob);
                stopTimer();
                document.getElementById("recordingIndicator").style.display = "none";
                isRecording = false;
                
                if (audioStream) {
                    audioStream.getTracks().forEach(track => track.stop());
                }
            };
            
            mediaRecorder.start();
            isRecording = true;
            startTimer();
            
            const indicator = document.getElementById("recordingIndicator");
            indicator.style.display = "flex";
            
            setTimeout(() => {
                if (isRecording) {
                    stopRecordingAndSend();
                }
            }, 30000);
        })
        .catch(err => {
            console.error("Microphone error:", err);
            alert("Could not access microphone. Please check permissions.");
        });
}

function stopRecordingAndSend() {
    if (mediaRecorder && isRecording) {
        mediaRecorder.stop();
        stopTimer();
        document.getElementById("recordingIndicator").style.display = "none";
        isRecording = false;
    }
}

function cancelRecording() {
    if (mediaRecorder && isRecording) {
        mediaRecorder.onstop = () => {
            if (audioStream) {
                audioStream.getTracks().forEach(track => track.stop());
            }
            document.getElementById("recordingIndicator").style.display = "none";
            isRecording = false;
        };
        mediaRecorder.stop();
        stopTimer();
    }
}

function startTimer() {
    recordingSeconds = 0;
    updateTimerDisplay();
    recordingTimer = setInterval(() => {
        recordingSeconds++;
        updateTimerDisplay();
    }, 1000);
}

function stopTimer() {
    if (recordingTimer) {
        clearInterval(recordingTimer);
        recordingTimer = null;
    }
}

function updateTimerDisplay() {
    const minutes = Math.floor(recordingSeconds / 60);
    const seconds = recordingSeconds % 60;
    const timerElement = document.getElementById("recordingTimer");
    if (timerElement) {
        timerElement.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }
}

function sendVoiceMessage(audioBlob) {
    const reader = new FileReader();
    reader.onloadend = () => {
        const base64Audio = reader.result.split(",")[1];
        const duration = recordingSeconds;
        
        socket.emit("private message", {
            receiver: selectedUser,
            type: "voice",
            voice: base64Audio,
            voiceDuration: duration
        });
    };
    reader.readAsDataURL(audioBlob);
}

function toBase64(file) {
    return new Promise(resolve => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result.split(",")[1]);
        reader.readAsDataURL(file);
    });
}

// ================= SOCKET EVENTS =================

socket.on("online users", users => {
    onlineUsers = users;
    loadFriends();
});

socket.on("private message", msg => {
    if (msg.sender === selectedUser || msg.receiver === selectedUser) {
        renderMessage(msg);
    }
});

socket.on("message edited", (data) => {
    if (data.sender === selectedUser || data.receiver === selectedUser) {
        // Find and update the message
        const messages = document.querySelectorAll(".message-wrapper");
        for (const msgWrapper of messages) {
            const timeSpan = msgWrapper.querySelector(".message-time");
            if (timeSpan && !timeSpan.innerHTML.includes("edited")) {
                const msgDiv = msgWrapper.querySelector(".msg");
                if (msgDiv) {
                    // Remove old text and add new
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
        // Refresh reactions display
        const messages = document.querySelectorAll(".message-wrapper");
        for (const msgWrapper of messages) {
            const userSpan = msgWrapper.querySelector(".user");
            if (userSpan && userSpan.textContent.includes(data.user)) {
                // Update reactions
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
    loadFriendRequests();
});

socket.on("friend-request-accepted", ({ by }) => {
    alert(`✅ ${by} accepted your friend request!`);
    loadFriends();
    loadVisibleUsers();
});

socket.on("error", (error) => {
    alert(error);
});

// ================= PASSWORD RESET =================

function showForgotPassword() {
    document.getElementById("resetModal").style.display = "flex";
    document.getElementById("resetStep1").style.display = "block";
    document.getElementById("resetStep2").style.display = "none";
}

function closeResetModal() {
    document.getElementById("resetModal").style.display = "none";
}

async function requestPasswordReset() {
    const username = document.getElementById("resetUsername").value.trim();
    if (!username) { alert("Enter username"); return; }
    
    const res = await fetch("/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username })
    });
    const data = await res.json();
    
    if (data.error) { alert(data.error); return; }
    
    currentResetToken = data.resetToken;
    resetUsername = username;
    document.getElementById("resetStep1").style.display = "none";
    document.getElementById("resetStep2").style.display = "block";
}

async function confirmPasswordReset() {
    const newPassword = document.getElementById("newPassword").value;
    const confirmPassword = document.getElementById("confirmPassword").value;
    
    if (!newPassword || !confirmPassword) { alert("Fill all fields"); return; }
    if (newPassword !== confirmPassword) { alert("Passwords don't match"); return; }
    
    const res = await fetch("/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: currentResetToken, newPassword, username: resetUsername })
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