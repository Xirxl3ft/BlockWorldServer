const http = require("http");

const PORT = Number(process.env.PORT) || 10000;

const rooms = new Map();

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function makeRoomCode() {
let code = "";

```
do {
    code = "";

    for (let i = 0; i < 6; i++) {
        const index = Math.floor(
            Math.random() * CODE_CHARS.length
        );

        code += CODE_CHARS[index];
    }
} while (rooms.has(code));

return code;
```

}

function getPath(req) {
const url = String(req.url || "/");
const questionMark = url.indexOf("?");

```
if (questionMark === -1) {
    return url;
}

return url.substring(0, questionMark);
```

}

function setCORS(res) {
res.setHeader(
"Access-Control-Allow-Origin",
"*"
);

```
res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, OPTIONS"
);

res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type"
);

res.setHeader(
    "Access-Control-Max-Age",
    "86400"
);

res.setHeader(
    "Cache-Control",
    "no-store"
);
```

}

function sendJSON(res, status, data) {
setCORS(res);

```
const body = JSON.stringify(data);

res.writeHead(status, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(body)
});

res.end(body);
```

}

function readBody(req) {
return new Promise((resolve, reject) => {
let body = "";
let finished = false;

```
    req.on("data", function (chunk) {
        if (finished) {
            return;
        }

        body += chunk.toString();

        if (body.length > 1024 * 1024) {
            finished = true;

            reject(
                new Error("Request too large.")
            );

            req.destroy();
        }
    });

    req.on("end", function () {
        if (finished) {
            return;
        }

        finished = true;

        if (!body) {
            resolve({});
            return;
        }

        try {
            resolve(JSON.parse(body));
        } catch (error) {
            reject(
                new Error("Invalid JSON.")
            );
        }
    });

    req.on("error", function (error) {
        if (!finished) {
            finished = true;
            reject(error);
        }
    });
});
```

}

function cleanRoomCode(value) {
return String(value || "")
.trim()
.toUpperCase()
.replace(/[^A-Z0-9]/g, "")
.slice(0, 6);
}

function queueMessage(room, target, type, data) {
room.messageCounter++;

```
room.messages.push({
    id: room.messageCounter,
    target: target,
    type: type,
    data: data,
    time: Date.now()
});

if (room.messages.length > 200) {
    room.messages = room.messages.slice(-200);
}
```

}

const server = http.createServer(
async function (req, res) {
const path = getPath(req);

```
    console.log(
        "REQUEST:",
        req.method,
        req.url
    );

    if (req.method === "OPTIONS") {
        setCORS(res);

        res.writeHead(204);
        res.end();

        return;
    }

    if (
        req.method === "GET" &&
        path === "/"
    ) {
        sendJSON(res, 200, {
            ok: true,
            server: "BlockWorld signaling server",
            transport: "HTTPS polling",
            status: "running"
        });

        return;
    }

    if (
        req.method === "POST" &&
        path === "/create"
    ) {
        try {
            const roomCode = makeRoomCode();

            rooms.set(roomCode, {
                host: true,
                client: false,

                hostSeen: Date.now(),
                clientSeen: Date.now(),

                messageCounter: 0,
                messages: []
            });

            console.log(
                "ROOM CREATED:",
                roomCode
            );

            sendJSON(res, 200, {
                ok: true,
                roomCode: roomCode
            });
        } catch (error) {
            console.error(
                "CREATE ERROR:",
                error
            );

            sendJSON(res, 500, {
                ok: false,
                error: "Could not create room."
            });
        }

        return;
    }

    if (
        req.method === "POST" &&
        path === "/join"
    ) {
        try {
            const body = await readBody(req);

            const roomCode = cleanRoomCode(
                body.roomCode
            );

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

            console.log(
                "PLAYER JOINED:",
                roomCode
            );

            sendJSON(res, 200, {
                ok: true,
                roomCode: roomCode
            });
        } catch (error) {
            console.error(
                "JOIN ERROR:",
                error
            );

            sendJSON(res, 400, {
                ok: false,
                error: error.message
            });
        }

        return;
    }

    if (
        req.method === "POST" &&
        path === "/poll"
    ) {
        try {
            const body = await readBody(req);

            const roomCode = cleanRoomCode(
                body.roomCode
            );

            const role = body.role;
            const after = Number(body.after) || 0;

            if (
                role !== "host" &&
                role !== "client"
            ) {
                sendJSON(res, 400, {
                    ok: false,
                    error: "Invalid role."
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

            if (role === "host") {
                room.hostSeen = Date.now();
            } else {
                room.clientSeen = Date.now();
            }

            const messages = room.messages.filter(
                function (message) {
                    return (
                        message.target === role &&
                        message.id > after
                    );
                }
            );

            sendJSON(res, 200, {
                ok: true,
                messages: messages
            });
        } catch (error) {
            console.error(
                "POLL ERROR:",
                error
            );

            sendJSON(res, 400, {
                ok: false,
                error: error.message
            });
        }

        return;
    }

    if (
        req.method === "POST" &&
        path === "/signal"
    ) {
        try {
            const body = await readBody(req);

            const roomCode = cleanRoomCode(
                body.roomCode
            );

            const role = body.role;
            const type = body.type;
            const data = body.data;

            const room = rooms.get(roomCode);

            if (!room) {
                sendJSON(res, 404, {
                    ok: false,
                    error: "Room not found."
                });

                return;
            }

            if (
                role !== "host" &&
                role !== "client"
            ) {
                sendJSON(res, 400, {
                    ok: false,
                    error: "Invalid role."
                });

                return;
            }

            const allowedTypes = [
                "offer",
                "answer",
                "ice-candidate"
            ];

            if (!allowedTypes.includes(type)) {
                sendJSON(res, 400, {
                    ok: false,
                    error: "Invalid signal type."
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
            console.error(
                "SIGNAL ERROR:",
                error
            );

            sendJSON(res, 400, {
                ok: false,
                error: error.message
            });
        }

        return;
    }

    if (
        req.method === "POST" &&
        path === "/heartbeat"
    ) {
        try {
            const body = await readBody(req);

            const roomCode = cleanRoomCode(
                body.roomCode
            );

            const role = body.role;

            const room = rooms.get(roomCode);

            if (!room) {
                sendJSON(res, 404, {
                    ok: false,
                    error: "Room not found."
                });

                return;
            }

            if (role === "host") {
                room.hostSeen = Date.now();
            } else if (role === "client") {
                room.clientSeen = Date.now();
            } else {
                sendJSON(res, 400, {
                    ok: false,
                    error: "Invalid role."
                });

                return;
            }

            sendJSON(res, 200, {
                ok: true
            });
        } catch (error) {
            console.error(
                "HEARTBEAT ERROR:",
                error
            );

            sendJSON(res, 400, {
                ok: false,
                error: "Heartbeat failed."
            });
        }

        return;
    }

    sendJSON(res, 404, {
        ok: false,
        error: "Not found.",
        path: path,
        method: req.method
    });
}
```

);

setInterval(
function () {
const now = Date.now();

```
    for (const [code, room] of rooms) {
        const hostDead =
            now - room.hostSeen >
            10 * 60 * 1000;

        const clientDead =
            room.client &&
            now - room.clientSeen >
            10 * 60 * 1000;

        if (hostDead || clientDead) {
            console.log(
                "REMOVING ROOM:",
                code
            );

            rooms.delete(code);
        }
    }
},
60 * 1000
```

);

server.listen(
PORT,
"0.0.0.0",
function () {
console.log(
"================================="
);

```
    console.log(
        "BLOCKWORLD SERVER ONLINE"
    );

    console.log(
        "PORT:",
        PORT
    );

    console.log(
        "HOST: 0.0.0.0"
    );

    console.log(
        "TRANSPORT: HTTPS POLLING"
    );

    console.log(
        "================================="
    );
}
```

);
