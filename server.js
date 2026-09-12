const http = require("http");
const crypto = require("crypto");

const PORT = Number(process.env.PORT) || 10000;

const rooms = new Map();

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function makeRoomCode() {
    let code;

    do {
        code = "";

        for (let i = 0; i < 6; i++) {
            code += CODE_CHARS[
                Math.floor(Math.random() * CODE_CHARS.length)
            ];
        }
    } while (rooms.has(code));

    return code;
}

function sendJSON(res, status, data) {
    const body = JSON.stringify(data);

    res.writeHead(status, {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        "Cache-Control": "no-store"
    });

    res.end(body);
}

function readBody(req) {
    return new Promise((resolve, reject) => {
        let body = "";

        req.on("data", chunk => {
            body += chunk.toString();

            if (body.length > 1024 * 1024) {
                reject(new Error("Request too large."));
                req.destroy();
            }
        });

        req.on("end", () => {
            if (!body) {
                resolve({});
                return;
            }

            try {
                resolve(JSON.parse(body));
            } catch (error) {
                reject(new Error("Invalid JSON."));
            }
        });

        req.on("error", reject);
    });
}

function cleanRoom(roomCode) {
    if (!roomCode) {
        return "";
    }

    return String(roomCode)
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "")
        .slice(0, 6);
}

function queueMessage(room, target, type, data) {
    room.messages.push({
        id: crypto.randomUUID(),
        target,
        type,
        data,
        time: Date.now()
    });
}

function getMessages(room, target, after) {
    const timestamp = Number(after) || 0;

    const messages = room.messages.filter(message => {
        return (
            message.target === target &&
            message.time > timestamp
        );
    });

    return messages;
}

const server = http.createServer(async (req, res) => {
    // ==========================================
    // CORS PREFLIGHT
    // ==========================================

    if (req.method === "OPTIONS") {
        res.writeHead(204, {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
            "Access-Control-Max-Age": "86400"
        });

        res.end();
        return;
    }

    // ==========================================
    // HOME / HEALTH CHECK
    // ==========================================

    if (req.method === "GET" && req.url === "/") {
        sendJSON(res, 200, {
            ok: true,
            server: "BlockWorld signaling server",
            transport: "HTTPS polling",
            status: "running"
        });

        return;
    }

    // ==========================================
    // CREATE ROOM
    // ==========================================

    if (req.method === "POST" && req.url === "/create") {
        const roomCode = makeRoomCode();

        rooms.set(roomCode, {
            host: true,
            client: false,

            hostSeen: Date.now(),
            clientSeen: 0,

            messages: []
        });

        console.log("ROOM CREATED:", roomCode);

        sendJSON(res, 200, {
            ok: true,
            roomCode
        });

        return;
    }

    // ==========================================
    // JOIN ROOM
    // ==========================================

    if (req.method === "POST" && req.url === "/join") {
        try {
            const body = await readBody(req);

            const roomCode = cleanRoom(body.roomCode);

            if (roomCode.length !== 6) {
                sendJSON(res, 400, {
                    ok: false,
                    error: "Invalid room code."
                });

                return;
            }

            const room = rooms.get(roomCode);

            if (!room) {
                sendJSON(res, 404, {
                    ok: false,
                    error: "Room not found."
                });

                return;
            }

            if (room.client) {
                sendJSON(res, 409, {
                    ok: false,
                    error: "Room is full."
                });

                return;
            }

            room.client = true;
            room.clientSeen = Date.now();

            queueMessage(
                room,
                "host",
                "player-joined",
                {}
            );

            console.log("PLAYER JOINED:", roomCode);

            sendJSON(res, 200, {
                ok: true,
                roomCode
            });

        } catch (error) {
            sendJSON(res, 400, {
                ok: false,
                error: error.message
            });
        }

        return;
    }

    // ==========================================
    // POLL
    // ==========================================

    if (req.method === "POST" && req.url === "/poll") {
        try {
            const body = await readBody(req);

            const roomCode = cleanRoom(body.roomCode);
            const role = body.role;
            const after = Number(body.after) || 0;

            if (!roomCode || (role !== "host" && role !== "client")) {
                sendJSON(res, 400, {
                    ok: false,
                    error: "Invalid poll request."
                });

                return;
            }

            const room = rooms.get(roomCode);

            if (!room) {
                sendJSON(res, 404, {
                    ok: false,
                    error: "Room no longer exists."
                });

                return;
            }

            if (role === "host") {
                room.hostSeen = Date.now();
            } else {
                room.clientSeen = Date.now();
            }

            const messages = getMessages(
                room,
                role,
                after
            );

            sendJSON(res, 200, {
                ok: true,
                messages
            });

        } catch (error) {
            sendJSON(res, 400, {
                ok: false,
                error: error.message
            });
        }

        return;
    }

    // ==========================================
    // SIGNAL
    // ==========================================

    if (req.method === "POST" && req.url === "/signal") {
        try {
            const body = await readBody(req);

            const roomCode = cleanRoom(body.roomCode);
            const role = body.role;
            const type = body.type;
            const data = body.data;

            if (!roomCode) {
                sendJSON(res, 400, {
                    ok: false,
                    error: "Missing room code."
                });

                return;
            }

            if (role !== "host" && role !== "client") {
                sendJSON(res, 400, {
                    ok: false,
                    error: "Invalid role."
                });

                return;
            }

            const allowedTypes = [
                "offer",
                "answer",
                "ice-candidate",
                "request-world"
            ];

            if (!allowedTypes.includes(type)) {
                sendJSON(res, 400, {
                    ok: false,
                    error: "Invalid signal type."
                });

                return;
            }

            const room = rooms.get(roomCode);

            if (!room) {
                sendJSON(res, 404, {
                    ok: false,
                    error: "Room not found."
                });

                return;
            }

            const target =
                role === "host"
                    ? "client"
                    : "host";

            queueMessage(
                room,
                target,
                type,
                data
            );

            console.log(
                "SIGNAL:",
                type,
                role,
                "->",
                target,
                roomCode
            );

            sendJSON(res, 200, {
                ok: true
            });

        } catch (error) {
            sendJSON(res, 400, {
                ok: false,
                error: error.message
            });
        }

        return;
    }

    // ==========================================
    // KEEP-ALIVE
    // ==========================================

    if (req.method === "POST" && req.url === "/heartbeat") {
        try {
            const body = await readBody(req);

            const roomCode = cleanRoom(body.roomCode);
            const role = body.role;

            const room = rooms.get(roomCode);

            if (!room) {
                sendJSON(res, 404, {
                    ok: false
                });

                return;
            }

            if (role === "host") {
                room.hostSeen = Date.now();
            }

            if (role === "client") {
                room.clientSeen = Date.now();
            }

            sendJSON(res, 200, {
                ok: true
            });

        } catch (error) {
            sendJSON(res, 400, {
                ok: false
            });
        }

        return;
    }

    sendJSON(res, 404, {
        ok: false,
        error: "Not found."
    });
});

// ==========================================
// CLEAN OLD ROOMS
// ==========================================

setInterval(() => {
    const now = Date.now();

    for (const [code, room] of rooms.entries()) {
        const hostDead =
            now - room.hostSeen > 5 * 60 * 1000;

        const clientDead =
            room.client &&
            now - room.clientSeen > 5 * 60 * 1000;

        if (hostDead || clientDead) {
            console.log(
                "REMOVING OLD ROOM:",
                code
            );

            rooms.delete(code);
        }
    }
}, 60 * 1000);

// ==========================================
// START
// ==========================================

server.listen(PORT, "0.0.0.0", () => {
    console.log("---------------------------------");
    console.log("BLOCKWORLD SERVER ONLINE");
    console.log("PORT:", PORT);
    console.log("TRANSPORT: HTTPS POLLING");
    console.log("---------------------------------");
});
