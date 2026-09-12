```javascript
const gameGrid = document.getElementById("gameGrid");
const searchBox = document.getElementById("searchBox");
const gameCount = document.getElementById("gameCount");
const loading = document.getElementById("loading");
const noResults = document.getElementById("noResults");

const gameModal = document.getElementById("gameModal");
const gameFrame = document.getElementById("gameFrame");
const currentGameName = document.getElementById("currentGameName");
const closeGame = document.getElementById("closeGame");

let games = [];


/*
    LOAD GAMES
*/

async function loadGames() {

    loading.classList.remove("hidden");

    gameGrid.innerHTML = "";

    try {

        const response = await fetch(
            "/api/games?t=" + Date.now()
        );

        if (!response.ok) {
            throw new Error(
                "Server returned " + response.status
            );
        }

        const data = await response.json();

        games = data.games || [];

        gameCount.textContent =
            games.length + " " +
            (games.length === 1 ? "GAME" : "GAMES");

        renderGames(games);

    } catch (error) {

        console.error(
            "Could not load games:",
            error
        );

        gameGrid.innerHTML = `
            <div style="
                grid-column: 1 / -1;
                text-align: center;
                padding: 60px 20px;
                color: #888;
            ">
                <h2>Could not load games</h2>
                <p>
                    Make sure the game server is running.
                </p>
            </div>
        `;

    } finally {

        loading.classList.add("hidden");
    }
}


/*
    RENDER GAME CARDS
*/

function renderGames(list) {

    gameGrid.innerHTML = "";

    noResults.classList.toggle(
        "hidden",
        list.length !== 0
    );

    list.forEach((game, index) => {

        const card =
            document.createElement("div");

        card.className = "game-card";

        const number =
            document.createElement("div");

        number.className = "game-number";

        number.textContent =
            "#" + String(index + 1).padStart(3, "0");


        const name =
            document.createElement("div");

        name.className = "game-name";

        name.textContent = game.name;


        const button =
            document.createElement("button");

        button.className = "play-button";

        button.textContent = "PLAY";


        button.addEventListener(
            "click",
            function(event) {

                event.stopPropagation();

                openGame(game);

            }
        );


        card.addEventListener(
            "click",
            function() {

                openGame(game);

            }
        );


        card.appendChild(number);

        card.appendChild(name);

        card.appendChild(button);

        gameGrid.appendChild(card);

    });
}


/*
    OPEN GAME
*/

function openGame(game) {

    currentGameName.textContent =
        game.name;

    gameFrame.src =
        game.url;

    gameModal.classList.remove(
        "hidden"
    );

    document.body.style.overflow =
        "hidden";
}


/*
    CLOSE GAME
*/

function closeCurrentGame() {

    gameFrame.src =
        "about:blank";

    gameModal.classList.add(
        "hidden"
    );

    document.body.style.overflow =
        "";

}


/*
    SEARCH
*/

searchBox.addEventListener(
    "input",
    function() {

        const query =
            searchBox.value
                .trim()
                .toLowerCase();

        if (!query) {

            renderGames(games);

            return;
        }

        const filtered =
            games.filter(game => {

                return (
                    game.name
                        .toLowerCase()
                        .includes(query) ||

                    game.file
                        .toLowerCase()
                        .includes(query)
                );

            });

        renderGames(filtered);

    }
);


/*
    CLOSE BUTTON
*/

closeGame.addEventListener(
    "click",
    closeCurrentGame
);


/*
    ESCAPE TO CLOSE
*/

document.addEventListener(
    "keydown",
    function(event) {

        if (
            event.key === "Escape" &&
            !gameModal.classList.contains("hidden")
        ) {

            closeCurrentGame();

        }

    }
);


/*
    CLOSE WHEN CLICKING OUTSIDE GAME
*/

gameModal.addEventListener(
    "click",
    function(event) {

        if (
            event.target === gameModal
        ) {

            closeCurrentGame();

        }

    }
);


/*
    INITIAL LOAD
*/

loadGames();

const gameGrid = document.getElementById("gameGrid");
const searchBox = document.getElementById("searchBox");
const gameCount = document.getElementById("gameCount");
const loading = document.getElementById("loading");
const noResults = document.getElementById("noResults");

const gameModal = document.getElementById("gameModal");
const gameFrame = document.getElementById("gameFrame");
const currentGameName = document.getElementById("currentGameName");
const closeGame = document.getElementById("closeGame");

let games = [];


/*
    LOAD GAMES
*/

async function loadGames() {

    loading.classList.remove("hidden");

    gameGrid.innerHTML = "";

    try {

        const response = await fetch(
            "/api/games?t=" + Date.now()
        );

        if (!response.ok) {
            throw new Error(
                "Server returned " + response.status
            );
        }

        const data = await response.json();

        games = data.games || [];

        gameCount.textContent =
            games.length + " " +
            (games.length === 1 ? "GAME" : "GAMES");

        renderGames(games);

    } catch (error) {

        console.error(
            "Could not load games:",
            error
        );

        gameGrid.innerHTML = `
            <div style="
                grid-column: 1 / -1;
                text-align: center;
                padding: 60px 20px;
                color: #888;
            ">
                <h2>Could not load games</h2>
                <p>
                    Make sure the game server is running.
                </p>
            </div>
        `;

    } finally {

        loading.classList.add("hidden");
    }
}


/*
    RENDER GAME CARDS
*/

function renderGames(list) {

    gameGrid.innerHTML = "";

    noResults.classList.toggle(
        "hidden",
        list.length !== 0
    );

    list.forEach((game, index) => {

        const card =
            document.createElement("div");

        card.className = "game-card";

        const number =
            document.createElement("div");

        number.className = "game-number";

        number.textContent =
            "#" + String(index + 1).padStart(3, "0");


        const name =
            document.createElement("div");

        name.className = "game-name";

        name.textContent = game.name;


        const button =
            document.createElement("button");

        button.className = "play-button";

        button.textContent = "PLAY";


        button.addEventListener(
            "click",
            function(event) {

                event.stopPropagation();

                openGame(game);

            }
        );


        card.addEventListener(
            "click",
            function() {

                openGame(game);

            }
        );


        card.appendChild(number);

        card.appendChild(name);

        card.appendChild(button);

        gameGrid.appendChild(card);

    });
}


/*
    OPEN GAME
*/

function openGame(game) {

    currentGameName.textContent =
        game.name;

    gameFrame.src =
        game.url;

    gameModal.classList.remove(
        "hidden"
    );

    document.body.style.overflow =
        "hidden";
}


/*
    CLOSE GAME
*/

function closeCurrentGame() {

    gameFrame.src =
        "about:blank";

    gameModal.classList.add(
        "hidden"
    );

    document.body.style.overflow =
        "";

}


/*
    SEARCH
*/

searchBox.addEventListener(
    "input",
    function() {

        const query =
            searchBox.value
                .trim()
                .toLowerCase();

        if (!query) {

            renderGames(games);

            return;
        }

        const filtered =
            games.filter(game => {

                return (
                    game.name
                        .toLowerCase()
                        .includes(query) ||

                    game.file
                        .toLowerCase()
                        .includes(query)
                );

            });

        renderGames(filtered);

    }
);


/*
    CLOSE BUTTON
*/

closeGame.addEventListener(
    "click",
    closeCurrentGame
);


/*
    ESCAPE TO CLOSE
*/

document.addEventListener(
    "keydown",
    function(event) {

        if (
            event.key === "Escape" &&
            !gameModal.classList.contains("hidden")
        ) {

            closeCurrentGame();

        }

    }
);


/*
    CLOSE WHEN CLICKING OUTSIDE GAME
*/

gameModal.addEventListener(
    "click",
    function(event) {

        if (
            event.target === gameModal
        ) {

            closeCurrentGame();

        }

    }
);


/*
    INITIAL LOAD
*/

loadGames();
