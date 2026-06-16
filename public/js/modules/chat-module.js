// ================= CHAT FUNCTIONS =================

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