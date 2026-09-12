const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 3000;

const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, "public");
const GAMES_DIR = path.join(ROOT, "games");

if (!fs.existsSync(GAMES_DIR)) {
    fs.mkdirSync(GAMES_DIR, { recursive: true });
}

if (!fs.existsSync(PUBLIC_DIR)) {
    fs.mkdirSync(PUBLIC_DIR, { recursive: true });
}

function getGameName(filename) {
    let name = filename
        .replace(/\.html$/i, "")
        .replace(/[-_]+/g, " ")
        .trim();

    return name
        .split(" ")
        .map(word => {
            if (!word) return "";
            return word.charAt(0).toUpperCase() + word.slice(1);
        })
        .join(" ");
}

function getGames() {
    let files = [];

    try {
        files = fs.readdirSync(GAMES_DIR);
    } catch (error) {
        console.error("Could not read games folder:", error);
        return [];
    }

    return files
        .filter(file => {
            return (
                file.toLowerCase().endsWith(".html") &&
                !file.startsWith(".")
            );
        })
        .map(file => {
            return {
                file: file,
                name: getGameName(file),
                url: "/games/" + encodeURIComponent(file)
            };
        })
        .sort((a, b) => a.name.localeCompare(b.name));
}

function sendJSON(res, data, status = 200) {
    const body = JSON.stringify(data);

    res.writeHead(status, {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Length": Buffer.byteLength(body),
        "Cache-Control": "no-store",
        "Access-Control-Allow-Origin": "*"
    });

    res.end(body);
}

function getContentType(filePath) {
    const ext = path.extname(filePath).toLowerCase();

    const types = {
        ".html": "text/html; charset=utf-8",
        ".css": "text/css; charset=utf-8",
        ".js": "application/javascript; charset=utf-8",
        ".json": "application/json; charset=utf-8",
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".gif": "image/gif",
        ".webp": "image/webp",
        ".svg": "image/svg+xml",
        ".ico": "image/x-icon",
        ".mp3": "audio/mpeg",
        ".wav": "audio/wav",
        ".ogg": "audio/ogg",
        ".mp4": "video/mp4",
        ".webm": "video/webm",
        ".wasm": "application/wasm",
        ".txt": "text/plain; charset=utf-8"
    };

    return types[ext] || "application/octet-stream";
}

function safePath(base, requestedPath) {
    const decoded = decodeURIComponent(requestedPath);

    const normalized = path.normalize(decoded);

    const fullPath = path.resolve(base, "." + normalized);

    const basePath = path.resolve(base);

    if (
        fullPath !== basePath &&
        !fullPath.startsWith(basePath + path.sep)
    ) {
        return null;
    }

    return fullPath;
}

function serveFile(res, filePath) {
    fs.stat(filePath, (err, stats) => {
        if (err || !stats.isFile()) {
            res.writeHead(404, {
                "Content-Type": "text/plain; charset=utf-8"
            });

            res.end("404 - File not found");
            return;
        }

        res.writeHead(200, {
            "Content-Type": getContentType(filePath),
            "Cache-Control": "no-cache"
        });

        const stream = fs.createReadStream(filePath);

        stream.on("error", () => {
            if (!res.headersSent) {
                res.writeHead(500);
            }

            res.end("Error reading file.");
        });

        stream.pipe(res);
    });
}

const server = http.createServer((req, res) => {
    let requestPath;

    try {
        requestPath = decodeURIComponent(
            new URL(req.url, `http://${req.headers.host}`).pathname
        );
    } catch {
        res.writeHead(400);
        res.end("Bad request.");
        return;
    }

    // -----------------------------------------
    // API
    // -----------------------------------------

    if (requestPath === "/api/games") {
        sendJSON(res, {
            ok: true,
            count: getGames().length,
            games: getGames()
        });

        return;
    }

    if (requestPath === "/api/status") {
        sendJSON(res, {
            ok: true,
            server: "HTML Game Hub",
            games: getGames().length
        });

        return;
    }

    // -----------------------------------------
    // GAME FILES
    // -----------------------------------------

    if (requestPath.startsWith("/games/")) {
        const gamePath = safePath(
            GAMES_DIR,
            requestPath.substring("/games".length)
        );

        if (!gamePath) {
            res.writeHead(403);
            res.end("Forbidden.");
            return;
        }

        serveFile(res, gamePath);
        return;
    }

    // -----------------------------------------
    // PUBLIC WEBSITE
    // -----------------------------------------

    let publicPath = requestPath;

    if (publicPath === "/") {
        publicPath = "/index.html";
    }

    const filePath = safePath(
        PUBLIC_DIR,
        publicPath
    );

    if (!filePath) {
        res.writeHead(403);
        res.end("Forbidden.");
        return;
    }

    serveFile(res, filePath);
});

server.listen(PORT, () => {
    console.log("======================================");
    console.log("        HTML GAME HUB SERVER");
    console.log("======================================");
    console.log("");
    console.log(`Server running on port ${PORT}`);
    console.log(`Games folder: ${GAMES_DIR}`);
    console.log("");
    console.log("Games currently installed:");

    const games = getGames();

    if (games.length === 0) {
        console.log("  No HTML games found.");
    } else {
        games.forEach(game => {
            console.log(`  - ${game.name}`);
        });
    }

    console.log("");
    console.log("======================================");
});

