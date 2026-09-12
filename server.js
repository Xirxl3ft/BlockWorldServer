const http = require("http");

const PORT = Number(process.env.PORT) || 10000;

const server = http.createServer((req, res) => {

    console.log("REQUEST:", req.method, req.url);

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
        res.writeHead(204);
        res.end();
        return;
    }

    if (req.method === "GET" && req.url === "/") {

        const response = {
            ok: true,
            server: "BLOCKWORLD NEW SERVER",
            version: "TEST-001",
            transport: "HTTPS POLLING",
            message: "YOU ARE HITTING THE NEW SERVER"
        };

        res.writeHead(200, {
            "Content-Type": "application/json"
        });

        res.end(JSON.stringify(response));

        return;
    }

    res.writeHead(404, {
        "Content-Type": "application/json"
    });

    res.end(JSON.stringify({
        ok: false,
        error: "Not found.",
        path: req.url,
        method: req.method
    }));
});


server.listen(PORT, "0.0.0.0", () => {

    console.log("=================================");
    console.log("BLOCKWORLD NEW SERVER");
    console.log("VERSION: TEST-001");
    console.log("PORT:", PORT);
    console.log("HOST: 0.0.0.0");
    console.log("=================================");

});
