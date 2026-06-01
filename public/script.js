const socket = io();

function sendMessage() {
    const input = document.getElementById("messageInput");

    socket.emit("chat message", input.value);

    input.value = "";
}

socket.on("chat history", (messages) => {

    document.getElementById("messages").innerHTML = "";

    messages.forEach((message) => {
        const li = document.createElement("li");
        li.textContent = message.text;
        document.getElementById("messages").appendChild(li);
    });
});

socket.on("chat message", (msg) => {
    const li = document.createElement("li");
    li.textContent = msg;

    document.getElementById("messages")
        .appendChild(li);
});