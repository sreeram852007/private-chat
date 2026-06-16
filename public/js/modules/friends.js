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
                ${!isAdmin && isVerified && !isFriend ? '<span style="font-size:9px; margin-left:6px; color:#6b7280;"></span>' : ''}
            </div>
            <div class="user-status ${online ? 'user-online' : 'user-offline'}">
                ${online ? 'online' : 'offline'}
            </div>
        `;
        div.onclick = () => {
            if (typeof openChat === 'function') openChat(user);
        };
        container.appendChild(div);
    }
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