const http = require("http");

const PORT = Number(process.env.PORT) || 10000;

const rooms = new Map();

const CHARACTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const ROOM_TIMEOUT = 10 * 60 * 1000;
const MAX_MESSAGES = 250;

function makeCode() {
    let code;

    do {
        code = "";

        for (let i = 0; i < 6; i++) {
            code += CHARACTERS[
                Math.floor(Math.random() * CHARACTERS.length)
            ];
        }
    } while (rooms.has(code));

    return code;
}

function cleanCode(value) {
    return String(value || "")
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "")
        .substring(0, 6);
}

function pathOf(url) {
    const q = String(url || "/").indexOf("?");

    if (q < 0) {
        return String(url || "/");
    }

    return String(url || "/").substring(0, q);
}

function cors(res) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.setHeader("Cache-Control", "no-store");
}

function reply(res, status, data) {
    cors(res);

    const text = JSON.stringify(data);

    res.writeHead(status, {
        "Content-Type": "application/json"
    });

    res.end(text);
}

function readJSON(req, done) {
    let text = "";

    req.on("data", function(chunk) {
        text += chunk.toString();

        if (text.length > 1000000) {
            req.destroy();
        }
    });

    req.on("end", function() {
        if (text.length === 0) {
            done({});
            return;
        }

        try {
            done(JSON.parse(text));
        } catch (error) {
            done(null);
        }
    });

    req.on("error", function() {
        done(null);
    });
}

function addMessage(room, target, type, data) {
    room.id++;

    room.messages.push({
        id: room.id,
        target: target,
        type: type,
        data: data
    });

    while (room.messages.length > MAX_MESSAGES) {
        room.messages.shift();
    }
}

const server = http.createServer(function(req, res) {

    const path = pathOf(req.url);

    console.log(req.method, path);

    if (req.method === "OPTIONS") {
        cors(res);
        res.writeHead(204);
        res.end();
        return;
    }

    if (req.method === "GET" && path === "/") {
        reply(res, 200, {
            ok: true,
            server: "BlockWorld",
            transport: "HTTPS polling",
            status: "running",
            rooms: rooms.size
        });
        return;
    }

    if (req.method === "POST" && path === "/create") {

        const code = makeCode();

        rooms.set(code, {
            client: false,
            hostSeen: Date.now(),
            clientSeen: Date.now(),
            id: 0,
            messages: []
        });

        console.log("CREATED ROOM:", code);

        reply(res, 200, {
            ok: true,
            roomCode: code
        });

        return;
    }

    if (req.method === "POST" && path === "/join") {

        readJSON(req, function(data) {

            if (!data) {
                reply(res, 400, {
                    ok: false,
                    error: "Invalid JSON."
                });
                return;
            }

            const code = cleanCode(data.roomCode);
            const room = rooms.get(code);

            if (code.length !== 6) {
                reply(res, 400, {
                    ok: false,
                    error: "Room code must be 6 characters."
                });
                return;
            }

            if (!room) {
                reply(res, 404, {
                    ok: false,
                    error: "Room not found."
                });
                return;
            }

            if (room.client) {
                reply(res, 409, {
                    ok: false,
                    error: "Room is full."
                });
                return;
            }

            room.client = true;
            room.clientSeen = Date.now();

            addMessage(
                room,
                "host",
                "player-joined",
                {}
            );

            console.log("JOINED ROOM:", code);

            reply(res, 200, {
                ok: true,
                roomCode: code
            });
        });

        return;
    }

    if (req.method === "POST" && path === "/poll") {

        readJSON(req, function(data) {

            if (!data) {
                reply(res, 400, {
                    ok: false,
                    error: "Invalid JSON."
                });
                return;
            }

            const code = cleanCode(data.roomCode);
            const role = String(data.role || "");
            const after = Number(data.after) || 0;

            if (role !== "host" && role !== "client") {
                reply(res, 400, {
                    ok: false,
                    error: "Invalid role."
                });
                return;
            }

            const room = rooms.get(code);

            if (!room) {
                reply(res, 404, {
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
                function(message) {
                    return (
                        message.target === role &&
                        message.id > after
                    );
                }
            );

            reply(res, 200, {
                ok: true,
                messages: messages
            });
        });

        return;
    }

    if (req.method === "POST" && path === "/signal") {

        readJSON(req, function(data) {

            if (!data) {
                reply(res, 400, {
                    ok: false,
                    error: "Invalid JSON."
                });
                return;
            }

            const code = cleanCode(data.roomCode);
            const role = String(data.role || "");
            const type = String(data.type || "");
            const room = rooms.get(code);

            if (!room) {
                reply(res, 404, {
                    ok: false,
                    error: "Room not found."
                });
                return;
            }

            if (role !== "host" && role !== "client") {
                reply(res, 400, {
                    ok: false,
                    error: "Invalid role."
                });
                return;
            }

            if (
                type !== "offer" &&
                type !== "answer" &&
                type !== "ice-candidate"
            ) {
                reply(res, 400, {
                    ok: false,
                    error: "Invalid signal type."
                });
                return;
            }

            const target =
                role === "host"
                    ? "client"
                    : "host";

            addMessage(
                room,
                target,
                type,
                data.data
            );

            console.log(
                "SIGNAL",
                type,
                role,
                "TO",
                target,
                code
            );

            reply(res, 200, {
                ok: true
            });
        });

        return;
    }

    if (req.method === "POST" && path === "/heartbeat") {

        readJSON(req, function(data) {

            if (!data) {
                reply(res, 400, {
                    ok: false,
                    error: "Invalid JSON."
                });
                return;
            }

            const code = cleanCode(data.roomCode);
            const role = String(data.role || "");
            const room = rooms.get(code);

            if (!room) {
                reply(res, 404, {
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
                reply(res, 400, {
                    ok: false,
                    error: "Invalid role."
                });
                return;
            }

            reply(res, 200, {
                ok: true
            });
        });

        return;
    }

    reply(res, 404, {
        ok: false,
        error: "Not found.",
        path: path
    });
});

setInterval(function() {

    const now = Date.now();

    for (const entry of rooms) {

        const code = entry[0];
        const room = entry[1];

        const hostGone =
            now - room.hostSeen > ROOM_TIMEOUT;

        const clientGone =
            room.client &&
            now - room.clientSeen > ROOM_TIMEOUT;

        if (hostGone || clientGone) {
            console.log("REMOVED ROOM:", code);
            rooms.delete(code);
        }
    }

}, 60000);

server.listen(PORT, "0.0.0.0", function() {

    console.log("");
    console.log("================================");
    console.log("      BLOCKWORLD SERVER");
    console.log("================================");
    console.log("STATUS: ONLINE");
    console.log("PORT:", PORT);
    console.log("TRANSPORT: HTTPS POLLING");
    console.log("================================");
    console.log("");

});
