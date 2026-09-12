const http = require("http");
const crypto = require("crypto");

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
                    Math.random() *
                    CODE_CHARS.length
                )
            ];
        }

    } while (rooms.has(code));

    return code;
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
                "application/json"
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

            req.on(
                "data",
                chunk => {

                    body +=
                        chunk.toString();

                    if (
                        body.length >
                        1024 * 1024
                    ) {

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
                reject
            );
        }
    );
}


// ============================================================
// ROOM CODE CLEANUP
// ============================================================

function cleanRoomCode(
    value
) {

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

        target,

        type,

        data,

        time:
            Date.now()
    });
}


// ============================================================
// SERVER
// ============================================================

const server =
    http.createServer(
        async (req, res) => {

            console.log(
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
                req.url ===
                    "/"
            ) {

                sendJSON(
                    res,
                    200,
                    {
                        ok: true,

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
                req.url ===
                    "/create"
            ) {

                const roomCode =
                    makeRoomCode();


                rooms.set(
                    roomCode,
                    {
                        host: true,

                        client: false,

                        hostSeen:
                            Date.now(),

                        clientSeen:
                            Date.now(),

                        messageCounter:
                            0,

                        messages: []
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
                        ok: true,

                        roomCode:
                            roomCode
                    }
                );

                return;
            }


            // =================================================
            // JOIN
            // =================================================

            if (
                req.method ===
                    "POST" &&
                req.url ===
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
                                ok: false,

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
                                ok: false,

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
                                ok: false,

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
                            ok: true,

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
                            ok: false,

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
                req.url ===
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


                    const room =
                        rooms.get(
                            roomCode
                        );


                    if (!room) {

                        sendJSON(
                            res,
                            404,
                            {
                                ok: false,

                                error:
                                    "Room not found."
                            }
                        );

                        return;
                    }


                    if (
                        role ===
                        "host"
                    ) {

                        room.hostSeen =
                            Date.now();

                    } else if (
                        role ===
                        "client"
                    ) {

                        room.clientSeen =
                            Date.now();
                    }


                    const messages =
                        room.messages.filter(
                            message => {

                                return (
                                    message.target ===
                                        role &&
                                    message.id >
                                        after
                                );
                            }
                        );


                    sendJSON(
                        res,
                        200,
                        {
                            ok: true,

                            messages:
                                messages
                        }
                    );

                } catch (error) {

                    console.error(
                        "POLL ERROR:",
                        error
                    );


                    sendJSON(
                        res,
                        400,
                        {
                            ok: false,

                            error:
                                error.message
                        }
                    );
                }

                return;
            }


            // =================================================
            // SIGNAL
            // =================================================

            if (
                req.method ===
                    "POST" &&
                req.url ===
                    "/signal"
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


                    const type =
                        body.type;


                    const data =
                        body.data;


                    const room =
                        rooms.get(
                            roomCode
                        );


                    if (!room) {

                        sendJSON(
                            res,
                            404,
                            {
                                ok: false,

                                error:
                                    "Room not found."
                            }
                        );

                        return;
                    }


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
                                ok: false,

                                error:
                                    "Invalid role."
                            }
                        );

                        return;
                    }


                    const allowed =
                        [
                            "offer",
                            "answer",
                            "ice-candidate"
                        ];


                    if (
                        !allowed.includes(
                            type
                        )
                    ) {

                        sendJSON(
                            res,
                            400,
                            {
                                ok: false,

                                error:
                                    "Invalid signal type."
                            }
                        );

                        return;
                    }


                    const target =
                        role ===
                        "host"
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


                    sendJSON(
                        res,
                        200,
                        {
                            ok: true
                        }
                    );

                } catch (error) {

                    console.error(
                        "SIGNAL ERROR:",
                        error
                    );


                    sendJSON(
                        res,
                        400,
                        {
                            ok: false,

                            error:
                                error.message
                        }
                    );
                }

                return;
            }


            // =================================================
            // HEARTBEAT
            // =================================================

            if (
                req.method ===
                    "POST" &&
                req.url ===
                    "/heartbeat"
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


                    const room =
                        rooms.get(
                            roomCode
                        );


                    if (!room) {

                        sendJSON(
                            res,
                            404,
                            {
                                ok: false
                            }
                        );

                        return;
                    }


                    if (
                        role ===
                        "host"
                    ) {

                        room.hostSeen =
                            Date.now();

                    } else if (
                        role ===
                        "client"
                    ) {

                        room.clientSeen =
                            Date.now();
                    }


                    sendJSON(
                        res,
                        200,
                        {
                            ok: true
                        }
                    );

                } catch (error) {

                    sendJSON(
                        res,
                        400,
                        {
                            ok: false
                        }
                    );
                }

                return;
            }


            // =================================================
            // NOT FOUND
            // =================================================

            sendJSON(
                res,
                404,
                {
                    ok: false,

                    error:
                        "Not found."
                }
            );
        }
    );


// ============================================================
// CLEAN OLD ROOMS
// ============================================================

setInterval(
    () => {

        const now =
            Date.now();


        for (
            const [
                code,
                room
            ]
            of rooms
        ) {

            const hostDead =
                now -
                room.hostSeen >
                10 * 60 * 1000;


            const clientDead =
                room.client &&
                now -
                room.clientSeen >
                10 * 60 * 1000;


            if (
                hostDead ||
                clientDead
            ) {

                console.log(
                    "REMOVING ROOM:",
                    code
                );

                rooms.delete(
                    code
                );
            }
        }

    },
    60 * 1000
);


// ============================================================
// START
// ============================================================

server.listen(
    PORT,
    "0.0.0.0",
    () => {

        console.log(
            "================================="
        );

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
);
