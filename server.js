```js
const express = require("express");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 3000;

const gamesFolder = path.join(__dirname, "games");

// Make sure the games folder exists
if (!fs.existsSync(gamesFolder)) {
    fs.mkdirSync(gamesFolder, { recursive: true });
}

// Serve the main website
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Automatically find every HTML game
app.get("/api/games", (req, res) => {
    try {
        const files = fs.readdirSync(gamesFolder)
            .filter(file => file.toLowerCase().endsWith(".html"));

        const games = files.map(file => {
            const filename = path.basename(file, ".html");

            // Turn:
            // "drive-mad" -> "Drive Mad"
            // "flappy_bird" -> "Flappy Bird"
            const title = filename
                .replace(/[-_]+/g, " ")
                .replace(/\b\w/g, char => char.toUpperCase());

            return {
                title,
                file,
                url: `/games/${encodeURIComponent(file)}`
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

// Serve the actual game HTML files
app.use("/games", express.static(gamesFolder));

// Serve CSS/JS/images for the menu
app.use(express.static(path.join(__dirname, "public")));

app.listen(PORT, () => {
    console.log(`Game Hub running on port ${PORT}`);
});
```

**`public/index.html`**

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">

    <title>Game Hub</title>

    <link rel="stylesheet" href="/style.css">
</head>

<body>

    <header>
        <h1>🎮 Game Hub</h1>
        <p>Choose a game and play.</p>
    </header>

    <main>
        <div id="loading">Loading games...</div>

        <div id="games"></div>

        <div id="error" class="hidden">
            Couldn't load the games.
        </div>
    </main>

    <div id="gameScreen" class="hidden">

        <div class="gameTopbar">
            <button id="backButton">← Back</button>

            <span id="gameTitle"></span>

            <button id="fullscreenButton">
                Fullscreen
            </button>
        </div>

        <iframe
            id="gameFrame"
            title="Game"
            allow="fullscreen"
        ></iframe>

    </div>

    <script src="/script.js"></script>

</body>
</html>
```

**`public/style.css`**

* {
  box-sizing: border-box;
  }

html,
body {
margin: 0;
padding: 0;
min-height: 100%;
font-family: Arial, Helvetica, sans-serif;
background: #111;
color: white;
}

body {
padding-bottom: 40px;
}

header {
text-align: center;
padding: 45px 20px 30px;
background: #181818;
border-bottom: 1px solid #292929;
}

header h1 {
margin: 0;
font-size: 42px;
}

header p {
margin: 10px 0 0;
color: #aaa;
font-size: 17px;
}

main {
max-width: 1200px;
margin: auto;
padding: 30px 20px;
}

#games {
display: grid;
grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
gap: 20px;
}

.gameButton {
min-height: 150px;
border: 1px solid #303030;
border-radius: 14px;
background: #1c1c1c;
color: white;
cursor: pointer;
padding: 25px;

```
display: flex;
align-items: center;
justify-content: center;

font-size: 21px;
font-weight: bold;

transition:
    transform 0.15s ease,
    background 0.15s ease,
    border-color 0.15s ease;
```

}

.gameButton:hover {
transform: translateY(-5px);
background: #252525;
border-color: #555;
}

.gameButton:active {
transform: translateY(0);
}

#loading,
#error {
text-align: center;
padding: 50px;
color: #aaa;
}

.hidden {
display: none !important;
}

/* Game screen */

#gameScreen {
position: fixed;
inset: 0;
background: #000;

```
display: flex;
flex-direction: column;
z-index: 1000;
```

}

.gameTopbar {
height: 55px;
flex-shrink: 0;

```
display: flex;
align-items: center;
justify-content: space-between;

padding: 0 12px;

background: #181818;
border-bottom: 1px solid #333;
```

}

.gameTopbar button {
border: none;
border-radius: 7px;
background: #292929;
color: white;

```
padding: 9px 15px;

font-size: 14px;
cursor: pointer;
```

}

.gameTopbar button:hover {
background: #3a3a3a;
}

#gameTitle {
font-weight: bold;
overflow: hidden;
white-space: nowrap;
text-overflow: ellipsis;

```
margin: 0 10px;
```

}

#gameFrame {
width: 100%;
height: calc(100vh - 55px);
border: none;
background: black;
}

```

**`public/script.js`**

:::writing{variant="document" id="81643" title="Render Game Hub script.js"}
const gamesContainer = document.getElementById("games");
const loading = document.getElementById("loading");
const error = document.getElementById("error");

const gameScreen = document.getElementById("gameScreen");
const gameFrame = document.getElementById("gameFrame");
const gameTitle = document.getElementById("gameTitle");

const backButton = document.getElementById("backButton");
const fullscreenButton = document.getElementById("fullscreenButton");


// Load the games automatically
async function loadGames() {
    try {
        const response = await fetch("/api/games");

        if (!response.ok) {
            throw new Error("Failed to load games");
        }

        const games = await response.json();

        loading.classList.add("hidden");

        if (games.length === 0) {
            gamesContainer.innerHTML = `
                <div id="loading">
                    No games found.<br><br>
                    Put some .html files inside the games folder.
                </div>
            `;

            return;
        }

        gamesContainer.innerHTML = "";

        games.forEach(game => {
            const button = document.createElement("button");

            button.className = "gameButton";
            button.textContent = game.title;

            button.addEventListener("click", () => {
                launchGame(game);
            });

            gamesContainer.appendChild(button);
        });

    } catch (err) {
        console.error(err);

        loading.classList.add("hidden");
        error.classList.remove("hidden");
    }
}


// Launch a game
function launchGame(game) {
    gameTitle.textContent = game.title;

    gameFrame.src = game.url;

    gameScreen.classList.remove("hidden");

    document.body.style.overflow = "hidden";
}


// Return to game list
function closeGame() {
    gameFrame.src = "about:blank";

    gameScreen.classList.add("hidden");

    document.body.style.overflow = "";
}


backButton.addEventListener("click", closeGame);


// Fullscreen
fullscreenButton.addEventListener("click", async () => {
    try {
        if (gameFrame.requestFullscreen) {
            await gameFrame.requestFullscreen();
        }
    } catch (error) {
        console.error(error);
    }
});


// ESC / browser back
document.addEventListener("keydown", event => {
    if (event.key === "Escape") {
        if (!gameScreen.classList.contains("hidden")) {
            closeGame();
        }
    }
});


// Start
loadGames();
```

### Your Render folder

Put it together like this:

```text
your-project/
│
├── server.js
├── package.json
│
├── public/
│   ├── index.html
│   ├── style.css
│   └── script.js
│
└── games/
    ├── blockworld.html
    ├── snake.html
    ├── tetris.html
    └── whatever.html
```

Your `package.json` can be:

```json
{
  "name": "game-hub",
  "version": "1.0.0",
  "main": "server.js",
  "scripts": {
    "start": "node server.js"
  },
  "dependencies": {
    "express": "^4.21.2"
  }
}
```

Now the **really nice part** is that you don't touch `index.html` when adding games.

Drop:

```text
games/
└── mario.html
```

into the folder → deploy Render → **Mario** automatically appears as a button.

Rename:

```text
crazy-driving-game.html
```

and it'll automatically display as:

**Crazy Driving Game**

This is also compatible with your idea of having **Code.org point at the Render site**. The Code.org side only needs to load your game hub; Render handles discovering and serving the games.
