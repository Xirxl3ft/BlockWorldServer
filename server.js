"use strict";

const http = require("http");
const WebSocket = require("ws");

const PORT =
  process.env.PORT || 8080;


/*
============================================================
SERVER
============================================================
*/

const httpServer =
  http.createServer(
    function (request, response) {

      response.writeHead(
        200,
        {
          "Content-Type":
            "text/plain; charset=utf-8"
        }
      );

      response.end(
        "BlockWorld signaling server is running."
      );
    }
  );


const wss =
  new WebSocket.WebSocketServer({
    server: httpServer
  });


/*
============================================================
ROOMS
============================================================
*/

const rooms =
  new Map();


/*
Room structure:

rooms.set("ABC123", {
    host: websocket,
    client: websocket
});
*/


/*
============================================================
ROOM CODE
============================================================
*/

const CODE_CHARACTERS =
  "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";


function generateRoomCode() {

  let code;

  do {

    code = "";

    for (
      let i = 0;
      i < 6;
      i++
    ) {

      const index =
        Math.floor(
          Math.random() *
          CODE_CHARACTERS.length
        );

      code +=
        CODE_CHARACTERS[index];
    }

  } while (
    rooms.has(code)
  );


  return code;
}


/*
============================================================
SEND
============================================================
*/

function send(
  socket,
  message
) {

  if (
    socket &&
    socket.readyState ===
    WebSocket.OPEN
  ) {

    socket.send(
      JSON.stringify(
        message
      )
    );
  }
}


/*
============================================================
BROADCAST
============================================================
*/

function sendToOtherPeer(
  room,
  sender,
  message
) {

  if (
    !room
  ) {
    return;
  }


  const target =
    room.host === sender
      ? room.client
      : room.host;


  send(
    target,
    message
  );
}


/*
============================================================
WEBSOCKET CONNECTION
============================================================
*/

wss.on(
  "connection",
  function (socket) {

    console.log(
      "Client connected."
    );


    socket.roomCode =
      null;

    socket.role =
      null;


    socket.on(
      "message",
      function (rawData) {

        let message;


        try {

          message =
            JSON.parse(
              rawData.toString()
            );

        } catch (error) {

          send(
            socket,
            {
              type: "error",
              message:
                "Invalid server message."
            }
          );

          return;
        }


        handleMessage(
          socket,
          message
        );
      }
    );


    socket.on(
      "close",
      function () {

        handleDisconnect(
          socket
        );

        console.log(
          "Client disconnected."
        );
      }
    );


    socket.on(
      "error",
      function (error) {

        console.error(
          "WebSocket error:",
          error.message
        );
      }
    );
  }
);


/*
============================================================
MESSAGE HANDLER
============================================================
*/

function handleMessage(
  socket,
  message
) {

  switch (
    message.type
  ) {

    /*
    ========================================
    CREATE ROOM
    ========================================
    */

    case "create-room":

      createRoom(
        socket,
        message.requestId
      );

      break;


    /*
    ========================================
    JOIN ROOM
    ========================================
    */

    case "join-room":

      joinRoom(
        socket,
        message.roomCode
      );

      break;


    /*
    ========================================
    WEBRTC OFFER
    ========================================
    */

    case "offer":

      relay(
        socket,
        {
          type: "offer",
          offer: message.offer
        }
      );

      break;


    /*
    ========================================
    WEBRTC ANSWER
    ========================================
    */

    case "answer":

      relay(
        socket,
        {
          type: "answer",
          answer: message.answer
        }
      );

      break;


    /*
    ========================================
    ICE
    ========================================
    */

    case "ice-candidate":

      relay(
        socket,
        {
          type: "ice-candidate",
          candidate:
            message.candidate
        }
      );

      break;


    default:

      send(
        socket,
        {
          type: "error",
          message:
            "Unknown message type."
        }
      );
  }
}


/*
============================================================
CREATE ROOM
============================================================
*/

function createRoom(
  socket,
  requestId
) {

  /*
  Remove an old room if this
  socket somehow already owns one.
  */

  if (
    socket.roomCode
  ) {

    leaveRoom(
      socket
    );
  }


  const code =
    generateRoomCode();


  const room = {
    host: socket,
    client: null
  };


  rooms.set(
    code,
    room
  );


  socket.roomCode =
    code;

  socket.role =
    "host";


  console.log(
    "Room created:",
    code
  );


  send(
    socket,
    {
      type: "room-created",
      roomCode: code,
      requestId:
        requestId || null
    }
  );
}


/*
============================================================
JOIN ROOM
============================================================
*/

function joinRoom(
  socket,
  rawCode
) {

  const code =
    String(
      rawCode || ""
    )
      .trim()
      .toUpperCase();


  if (
    code.length !== 6
  ) {

    send(
      socket,
      {
        type: "error",
        message:
          "Invalid room code."
      }
    );

    return;
  }


  const room =
    rooms.get(
      code
    );


  if (!room) {

    send(
      socket,
      {
        type: "error",
        message:
          "Room not found."
      }
    );

    return;
  }


  if (
    room.client
  ) {

    send(
      socket,
      {
        type: "error",
        message:
          "That room is already full."
      }
    );

    return;
  }


  if (
    socket.roomCode
  ) {

    leaveRoom(
      socket
    );
  }


  room.client =
    socket;


  socket.roomCode =
    code;

  socket.role =
    "client";


  console.log(
    "Client joined room:",
    code
  );


  /*
  Tell the joining player that
  the room was found.
  */

  send(
    socket,
    {
      type: "room-joined",
      roomCode: code
    }
  );


  /*
  Tell the host that someone joined.
  */

  send(
    room.host,
    {
      type: "player-joined"
    }
  );
}


/*
============================================================
RELAY WEBRTC DATA
============================================================
*/

function relay(
  socket,
  message
) {

  if (
    !socket.roomCode
  ) {

    send(
      socket,
      {
        type: "error",
        message:
          "You are not in a room."
      }
    );

    return;
  }


  const room =
    rooms.get(
      socket.roomCode
    );


  if (!room) {

    send(
      socket,
      {
        type: "error",
        message:
          "Room no longer exists."
      }
    );

    return;
  }


  sendToOtherPeer(
    room,
    socket,
    message
  );
}


/*
============================================================
DISCONNECT
============================================================
*/

function handleDisconnect(
  socket
) {

  leaveRoom(
    socket
  );
}


function leaveRoom(
  socket
) {

  const code =
    socket.roomCode;


  if (!code) {
    return;
  }


  const room =
    rooms.get(
      code
    );


  if (!room) {

    socket.roomCode =
      null;

    socket.role =
      null;

    return;
  }


  const other =
    room.host === socket
      ? room.client
      : room.host;


  /*
  Tell the remaining player.
  */

  send(
    other,
    {
      type:
        "peer-disconnected"
    }
  );


  if (
    room.host === socket
  ) {

    /*
    Host left.
    The entire room disappears.
    */

    rooms.delete(
      code
    );

  } else {

    /*
    Client left.
    Keep the host's room alive
    so another player can join.
    */

    room.client =
      null;
  }


  socket.roomCode =
    null;

  socket.role =
    null;
}


/*
============================================================
CLEAN EMPTY ROOMS
============================================================
*/

setInterval(
  function () {

    for (
      const [
        code,
        room
      ] of rooms
    ) {

      if (
        !room.host ||
        room.host.readyState !==
          WebSocket.OPEN
      ) {

        rooms.delete(
          code
        );

        continue;
      }


      if (
        room.client &&
        room.client.readyState !==
          WebSocket.OPEN
      ) {

        room.client =
          null;
      }
    }

  },
  30000
);


/*
============================================================
START
============================================================
*/

httpServer.listen(
  PORT,
  function () {

    console.log(
      "===================================="
    );

    console.log(
      "BlockWorld signaling server"
    );

    console.log(
      "Running on port:",
      PORT
    );

    console.log(
      "===================================="
    );
  }
);