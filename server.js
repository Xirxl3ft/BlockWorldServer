const http = require("http");

const PORT = Number(process.env.PORT) || 10000;

const rooms = {};

const CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function createCode() {
let code = "";

```
while (code.length < 6) {
    const index = Math.floor(Math.random() * CHARS.length);
    code += CHARS[index];
}

if (rooms[code]) {
    return createCode();
}

return code;
```

}

function getPath(url) {
const question = url.indexOf("?");

```
if (question === -1) {
    return url;
}

return url.substring(0, question);
```

}

function cors(res) {
res.setHeader("Access-Control-Allow-Origin", "*");
res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
res.setHeader("Access-Control-Allow-Headers", "Content-Type");
res.setHeader("Cache-Control", "no-store");
}

function json(res, status, data) {
cors(res);

```
const text = JSON.stringify(data);

res.writeHead(status, {
    "Content-Type": "application/json"
});

res.end(text);
```

}

function body(req, callback) {
let data = "";

```
req.on("data", function(chunk) {
    data += chunk.toString();

    if (data.length > 1000000) {
        req.destroy();
    }
});

req.on("end", function() {
    if (data.length === 0) {
        callback({});
        return;
    }

    try {
        callback(JSON.parse(data));
    } catch (error) {
        callback(null);
    }
});
```

}

function cleanCode(value) {
return String(value || "")
.trim()
.toUpperCase()
.replace(/[^A-Z0-9]/g, "")
.substring(0, 6);
}

function addMessage(room, target, type, data) {
room.messageID++;

```
room.messages.push({
    id: room.messageID,
    target: target,
    type: type,
    data: data
});

if (room.messages.length > 200) {
    room.messages.shift();
}
```

}

const server = http.createServer(function(req, res) {

```
const path = getPath(req.url || "/");

console.log(req.method + " " + path);

if (req.method === "OPTIONS") {
    cors(res);
    res.writeHead(204);
    res.end();
    return;
}

if (req.method === "GET" && path === "/") {
    json(res, 200, {
        ok: true,
        server: "BlockWorld signaling server",
        transport: "HTTPS polling",
        status: "running"
    });

    return;
}

if (req.method === "POST" && path === "/create") {

    const code = createCode();

    rooms[code] = {
        host: true,
        client: false,
        hostSeen: Date.now(),
        clientSeen: Date.now(),
        messageID: 0,
        messages: []
    };

    console.log("ROOM CREATED: " + code);

    json(res, 200, {
        ok: true,
        roomCode: code
    });

    return;
}

if (req.method === "POST" && path === "/join") {

    body(req, function(data) {

        if (!data) {
            json(res, 400, {
                ok: false,
                error: "Invalid JSON."
            });

            return;
        }

        const code = cleanCode(data.roomCode);

        if (code.length !== 6) {
            json(res, 400, {
                ok: false,
                error: "Invalid room code."
            });

            return;
        }

        const room = rooms[code];

        if (!room) {
            json(res, 404, {
                ok: false,
                error: "Room not found."
            });

            return;
        }

        if (room.client) {
            json(res, 409, {
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

        console.log("PLAYER JOINED: " + code);

        json(res, 200, {
            ok: true,
            roomCode: code
        });

    });

    return;
}

if (req.method === "POST" && path === "/poll") {

    body(req, function(data) {

        if (!data) {
            json(res, 400, {
                ok: false,
                error: "Invalid JSON."
            });

            return;
        }

        const code = cleanCode(data.roomCode);
        const role = data.role;
        const after = Number(data.after) || 0;

        if (role !== "host" && role !== "client") {
            json(res, 400, {
                ok: false,
                error: "Invalid role."
            });

            return;
        }

        const room = rooms[code];

        if (!room) {
            json(res, 404, {
                ok: false,
                error: "Room not found."
            });

            return;
        }

        if (role === "host") {
            room.hostSeen = Date.now();
        }

        if (role === "client") {
            room.clientSeen = Date.now();
        }

        const messages = [];

        for (let i = 0; i < room.messages.length; i++) {

            const message = room.messages[i];

            if (
                message.target === role &&
                message.id > after
            ) {
                messages.push(message);
            }
        }

        json(res, 200, {
            ok: true,
            messages: messages
        });

    });

    return;
}

if (req.method === "POST" && path === "/signal") {

    body(req, function(data) {

        if (!data) {
            json(res, 400, {
                ok: false,
                error: "Invalid JSON."
            });

            return;
        }

        const code = cleanCode(data.roomCode);
        const role = data.role;
        const type = data.type;
        const signalData = data.data;

        const room = rooms[code];

        if (!room) {
            json(res, 404, {
                ok: false,
                error: "Room not found."
            });

            return;
        }

        if (role !== "host" && role !== "client") {
            json(res, 400, {
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
            json(res, 400, {
                ok: false,
                error: "Invalid signal type."
            });

            return;
        }

        let target = "host";

        if (role === "host") {
            target = "client";
        }

        addMessage(
            room,
            target,
            type,
            signalData
        );

        console.log(
            "SIGNAL " +
            type +
            " " +
            role +
            " -> " +
            target +
            " " +
            code
        );

        json(res, 200, {
            ok: true
        });

    });

    return;
}

if (req.method === "POST" && path === "/heartbeat") {

    body(req, function(data) {

        if (!data) {
            json(res, 400, {
                ok: false,
                error: "Invalid JSON."
            });

            return;
        }

        const code = cleanCode(data.roomCode);
        const role = data.role;

        const room = rooms[code];

        if (!room) {
            json(res, 404, {
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
            json(res, 400, {
                ok: false,
                error: "Invalid role."
            });

            return;
        }

        json(res, 200, {
            ok: true
        });

    });

    return;
}

json(res, 404, {
    ok: false,
    error: "Not found.",
    path: path,
    method: req.method
});
```

});

setInterval(function() {

```
const now = Date.now();

const codes = Object.keys(rooms);

for (let i = 0; i < codes.length; i++) {

    const code = codes[i];
    const room = rooms[code];

    const hostExpired =
        now - room.hostSeen > 600000;

    const clientExpired =
        room.client &&
        now - room.clientSeen > 600000;

    if (hostExpired || clientExpired) {
        console.log("REMOVING ROOM: " + code);
        delete rooms[code];
    }
}
```

}, 60000);

server.listen(
PORT,
"0.0.0.0",
function() {

```
    console.log("==============================");
    console.log("BLOCKWORLD SERVER ONLINE");
    console.log("PORT: " + PORT);
    console.log("HOST: 0.0.0.0");
    console.log("TRANSPORT: HTTPS POLLING");
    console.log("==============================");

}
```

);
