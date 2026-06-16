// ================= SOCKET & VARIABLES =================
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

// ================= AUTO-SCROLL VARIABLES =================
let isUserScrolling = false;
let scrollTimeout;

// ================= VOICE RECORDING VARIABLES =================
let mediaRecorder = null;
let audioChunks = [];
let recordingTimer = null;
let recordingSeconds = 0;
let isRecording = false;
let audioStream = null;

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
        if (typeof loadFriends === 'function') loadFriends();
    } else if (tab === 'requests') {
        document.querySelector('.tab:nth-child(2)').classList.add('active');
        document.getElementById('requestsTab').style.display = 'block';
        if (typeof loadFriendRequests === 'function') loadFriendRequests();
    } else if (tab === 'search') {
        document.querySelector('.tab:nth-child(3)').classList.add('active');
        document.getElementById('searchTab').style.display = 'block';
    }
}

// Helper function to escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
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
    if (typeof loadFriends === 'function') loadFriends();
    if (typeof loadFriendRequests === 'function') loadFriendRequests();
    if (typeof loadVisibleUsers === 'function') loadVisibleUsers();
    setupScrollListener();
}

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

// ================= KEYBOARD SHORTCUTS =================
document.getElementById("input").addEventListener("keydown", e => { 
    if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        if (typeof sendMessage === 'function') sendMessage();
    }
});
document.getElementById("usernameInput").addEventListener("keydown", e => { 
    if (e.key === "Enter") login(); 
});