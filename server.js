const http = require("http");
const WebSocket = require("ws");

const PORT = Number(process.env.PORT) || 10000;

const server = http.createServer((req, res) => {
    res.writeHead(200, {
        "Content-Type": "text/plain"
    });

    res.end("BlockWorld signaling server is running.");
});

const wss = new WebSocket.Server({
    server: server
});

const rooms = new Map();

function makeRoomCode() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

    let code;

    do {
        code = "";

        for (let i = 0; i < 6; i++) {
            code += chars[Math.floor(Math.random() * chars.length)];
        }
    } while (rooms.has(code));

    return code;
}

function send(socket, data) {
    if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify(data));
    }
}

wss.on("connection", (socket, request) => {
    console.log("=================================");
    console.log("WEBSOCKET CONNECTION RECEIVED");
    console.log("IP:", request.socket.remoteAddress);
    console.log("=================================");

    socket.roomCode = null;
    socket.role = null;

    send(socket, {
        type: "connected"
    });

    socket.on("message", (raw) => {
        let message;

        try {
            message = JSON.parse(raw.toString());
        } catch (error) {
            console.log("Invalid JSON received.");
            return;
        }

        console.log("Message:", message.type);

        // ==============================
        // CREATE ROOM
        // ==============================

        if (message.type === "create-room") {
            const roomCode = makeRoomCode();

            rooms.set(roomCode, {
                host: socket,
                client: null
            });

            socket.roomCode = roomCode;
            socket.role = "host";

            console.log("ROOM CREATED:", roomCode);

            send(socket, {
                type: "room-created",
                roomCode: roomCode
            });

            return;
        }

        // ==============================
        // JOIN ROOM
        // ==============================

        if (message.type === "join-room") {
            const roomCode = String(message.roomCode || "")
                .trim()
                .toUpperCase();

            console.log("JOIN REQUEST:", roomCode);

            const room = rooms.get(roomCode);

            if (!room) {
                console.log("ROOM NOT FOUND:", roomCode);

                send(socket, {
                    type: "error",
                    message: "Room not found."
                });

                return;
            }

            if (room.client) {
                console.log("ROOM FULL:", roomCode);

                send(socket, {
                    type: "error",
                    message: "Room is already full."
                });

                return;
            }

            room.client = socket;

            socket.roomCode = roomCode;
            socket.role = "client";

            console.log("PLAYER JOINED:", roomCode);

            send(socket, {
                type: "join-success",
                roomCode: roomCode
            });

            send(room.host, {
                type: "player-joined"
            });

            return;
        }

        // ==============================
        // WEBRTC SIGNALING
        // ==============================

        if (
            message.type === "offer" ||
            message.type === "answer" ||
            message.type === "ice-candidate"
        ) {
            const room = rooms.get(socket.roomCode);

            if (!room) {
                console.log("SIGNALING FAILED: room missing");
                return;
            }

            let target = null;

            if (socket.role === "host") {
                target = room.client;
            } else if (socket.role === "client") {
                target = room.host;
            }

            if (!target) {
                console.log("SIGNALING FAILED: target missing");
                return;
            }

            send(target, {
                type: message.type,
                data: message.data
            });

            console.log(
                "RELAYED",
                message.type,
                socket.role,
                "->",
                target === room.host ? "host" : "client"
            );

            return;
        }

        // ==============================
        // PING
        // ==============================

        if (message.type === "ping") {
            send(socket, {
                type: "pong"
            });

            return;
        }
    });

    socket.on("close", () => {
        console.log("WebSocket disconnected.");

        const roomCode = socket.roomCode;

        if (!roomCode) {
            return;
        }

        const room = rooms.get(roomCode);

        if (!room) {
            return;
        }

        if (room.host === socket) {
            if (room.client) {
                send(room.client, {
                    type: "host-disconnected"
                });
            }

            rooms.delete(roomCode);

            console.log("ROOM DELETED:", roomCode);
        }

        else if (room.client === socket) {
            room.client = null;

            send(room.host, {
                type: "player-disconnected"
            });

            console.log("PLAYER LEFT:", roomCode);
        }
    });

    socket.on("error", (error) => {
        console.log("WEBSOCKET ERROR:", error.message);
    });
});

server.listen(PORT, "0.0.0.0", () => {
    console.log("=================================");
    console.log("BLOCKWORLD SERVER ONLINE");
    console.log("HOST: 0.0.0.0");
    console.log("PORT:", PORT);
    console.log("HTTP: READY");
    console.log("WEBSOCKET: READY");
    console.log("=================================");
});
