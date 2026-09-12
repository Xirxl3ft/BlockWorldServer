```js
const http = require("http");

const PORT = Number(process.env.PORT) || 10000;

const rooms = new Map();

const CODE_CHARS =
    "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";


// ============================================================
// ROOM CODE
// ============================================================

function makeRoomCode() {

    let code;

    do {

        code = "";

        for (let i = 0; i < 6; i++) {

            code += CODE_CHARS[
                Math.floor(
                    Math.random() * CODE_CHARS.length
                )
            ];
        }

    } while (rooms.has(code));

    return code;
}


// ============================================================
// URL PATH
// ============================================================

function getPath(req) {

    const url =
        String(req.url || "/");

    const questionMark =
        url.indexOf("?");

    if (questionMark === -1) {

        return url;
    }

    return url.substring(
        0,
        questionMark
    );
}


// ============================================================
// CORS
// ============================================================

function setCORS(res) {

    res.setHeader(
        "Access-Control-Allow-Origin",
        "*"
    );

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
}


// ============================================================
// JSON RESPONSE
// ============================================================

function sendJSON(
    res,
    status,
    data
) {

    setCORS(res);

    const body =
        JSON.stringify(data);

    res.writeHead(
        status,
        {
            "Content-Type":
                "application/json",

            "Content-Length":
                Buffer.byteLength(body)
        }
    );

    res.end(body);
}


// ============================================================
// READ BODY
// ============================================================

function readBody(req) {

    return new Promise(
        (resolve, reject) => {

            let body = "";

            let finished =
                false;


            req.on(
                "data",
                chunk => {

                    if (finished) {
                        return;
                    }

                    body +=
                        chunk.toString();


                    if (
                        body.length >
                        1024 * 1024
                    ) {

                        finished = true;

                        reject(
                            new Error(
                                "Request too large."
                            )
                        );

                        req.destroy();
                    }
                }
            );


            req.on(
                "end",
                () => {

                    if (finished) {
                        return;
                    }

                    finished = true;


                    if (!body) {

                        resolve({});

                        return;
                    }


                    try {

                        resolve(
                            JSON.parse(body)
                        );

                    } catch (error) {

                        reject(
                            new Error(
                                "Invalid JSON."
                            )
                        );
                    }
                }
            );


            req.on(
                "error",
                error => {

                    if (!finished) {

                        finished = true;

                        reject(error);
                    }
                }
            );
        }
    );
}


// ============================================================
// CLEAN ROOM CODE
// ============================================================

function cleanRoomCode(value) {

    return String(
        value || ""
    )
        .trim()
        .toUpperCase()
        .replace(
            /[^A-Z0-9]/g,
            ""
        )
        .slice(
            0,
            6
        );
}


// ============================================================
// QUEUE MESSAGE
// ============================================================

function queueMessage(
    room,
    target,
    type,
    data
) {

    room.messageCounter++;

    room.messages.push({

        id:
            room.messageCounter,

        target:
            target,

        type:
            type,

        data:
            data,

        time:
            Date.now()
    });


    // Keep the queue from growing forever.

    if (
        room.messages.length >
        200
    ) {

        room.messages =
            room.messages.slice(
                -200
            );
    }
}


// ============================================================
// SERVER
// ============================================================

const server =
    http.createServer(
        async (req, res) => {

            const path =
                getPath(req);


            console.log(
                "REQUEST:",
                req.method,
                req.url
            );


            // =================================================
            // CORS PREFLIGHT
            // =================================================

            if (
                req.method ===
                "OPTIONS"
            ) {

                setCORS(res);

                res.writeHead(
                    204
                );

                res.end();

                return;
            }


            // =================================================
            // HOME
            // =================================================

            if (
                req.method ===
                    "GET" &&
                path ===
                    "/"
            ) {

                sendJSON(
                    res,
                    200,
                    {

                        ok:
                            true,

                        server:
                            "BlockWorld signaling server",

                        transport:
                            "HTTPS polling",

                        status:
                            "running"
                    }
                );

                return;
            }


            // =================================================
            // CREATE ROOM
            // =================================================

            if (
                req.method ===
                    "POST" &&
                path ===
                    "/create"
            ) {

                try {

                    const roomCode =
                        makeRoomCode();


                    rooms.set(
                        roomCode,
                        {

                            host:
                                true,

                            client:
                                false,

                            hostSeen:
                                Date.now(),

                            clientSeen:
                                Date.now(),

                            messageCounter:
                                0,

                            messages:
                                []
                        }
                    );


                    console.log(
                        "ROOM CREATED:",
                        roomCode
                    );


                    sendJSON(
                        res,
                        200,
                        {

                            ok:
                                true,

                            roomCode:
                                roomCode
                        }
                    );

                } catch (error) {

                    console.error(
                        "CREATE ERROR:",
                        error
                    );


                    sendJSON(
                        res,
                        500,
                        {

                            ok:
                                false,

                            error:
                                "Could not create room."
                        }
                    );
                }

                return;
            }


            // =================================================
            // JOIN ROOM
            // =================================================

            if (
                req.method ===
                    "POST" &&
                path ===
                    "/join"
            ) {

                try {

                    const body =
                        await readBody(
                            req
                        );


                    const roomCode =
                        cleanRoomCode(
                            body.roomCode
                        );


                    if (
                        roomCode.length !==
                        6
                    ) {

                        sendJSON(
                            res,
                            400,
                            {

                                ok:
                                    false,

                                error:
                                    "Invalid room code."
                            }
                        );

                        return;
                    }


                    const room =
                        rooms.get(
                            roomCode
                        );


                    if (!room) {

                        sendJSON(
                            res,
                            404,
                            {

                                ok:
                                    false,

                                error:
                                    "Room not found."
                            }
                        );

                        return;
                    }


                    if (
                        room.client
                    ) {

                        sendJSON(
                            res,
                            409,
                            {

                                ok:
                                    false,

                                error:
                                    "Room is full."
                            }
                        );

                        return;
                    }


                    room.client =
                        true;

                    room.clientSeen =
                        Date.now();


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


                    sendJSON(
                        res,
                        200,
                        {

                            ok:
                                true,

                            roomCode:
                                roomCode
                        }
                    );

                } catch (error) {

                    console.error(
                        "JOIN ERROR:",
                        error
                    );


                    sendJSON(
                        res,
                        400,
                        {

                            ok:
                                false,

                            error:
                                error.message
                        }
                    );
                }

                return;
            }


            // =================================================
            // POLL
            // =================================================

            if (
                req.method ===
                    "POST" &&
                path ===
                    "/poll"
            ) {

                try {

                    const body =
                        await readBody(
                            req
                        );


                    const roomCode =
                        cleanRoomCode(
                            body.roomCode
                        );


                    const role =
                        body.role;


                    const after =
                        Number(
                            body.after
                        ) || 0;


                    if (
                        role !==
                            "host" &&
                        role !==
                            "client"
                    ) {

                        sendJSON(
                            res,
                            400,
                            {

                                ok:
                                    false,

                                error:
                                    "Invalid role."
                            }
                        );
```
