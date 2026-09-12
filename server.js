const express = require("express");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 3000;

const gamesFolder = path.join(__dirname, "games");

// Create games folder if it doesn't exist
if (!fs.existsSync(gamesFolder)) {
    fs.mkdirSync(gamesFolder, { recursive: true });
}

// Main website
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Automatically find all HTML games
app.get("/api/games", (req, res) => {
    try {
        const files = fs.readdirSync(gamesFolder)
            .filter(file => file.toLowerCase().endsWith(".html"));

        const games = files.map(file => {
            const name = path.basename(file, ".html");

            // Convert filenames into nice names
            // drive-mad.html -> Drive Mad
            // flappy_bird.html -> Flappy Bird
            const title = name
                .replace(/[-_]+/g, " ")
                .replace(/\b\w/g, char => char.toUpperCase());

            return {
                title: title,
                file: file,
                url: "/games/" + encodeURIComponent(file)
            };
        });

        games.sort((a, b) => a.title.localeCompare(b.title));

        res.json(games);

    } catch (error) {
        console.error(error);

        res.status(500).json({
            error: "Could not load games."
        });
    }
});

// Serve game files
app.use("/games", express.static(gamesFolder));

// Serve website files
app.use(express.static(path.join(__dirname, "public")));

app.listen(PORT, () => {
    console.log(`Game Hub running on port ${PORT}`);
});

