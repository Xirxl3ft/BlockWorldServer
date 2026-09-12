let allGames = [];

const gameGrid = document.getElementById("gameGrid");
const searchBox = document.getElementById("searchBox");
const gameCount = document.getElementById("gameCount");
const loading = document.getElementById("loading");
const noResults = document.getElementById("noResults");

const gameModal = document.getElementById("gameModal");
const gameFrame = document.getElementById("gameFrame");
const currentGameName = document.getElementById("currentGameName");
const closeGame = document.getElementById("closeGame");


function formatGameName(name) {
    return name
        .replace(/[-_]+/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .split(" ")
        .map(word => {
            if (!word) return "";

            return word.charAt(0).toUpperCase() +
                   word.slice(1);
        })
        .join(" ");
}


function renderGames(games) {

    gameGrid.innerHTML = "";

    if (games.length === 0) {
        noResults.classList.remove("hidden");
        return;
    }

    noResults.classList.add("hidden");

    games.forEach(game => {

        const card = document.createElement("div");
        card.className = "game-card";

        const title = document.createElement("div");
        title.className = "game-title";
        title.textContent = formatGameName(game.name);

        const playButton = document.createElement("button");
        playButton.className = "play-button";
        playButton.textContent = "PLAY";

        playButton.addEventListener("click", () => {
            openGame(game);
        });

        card.appendChild(title);
        card.appendChild(playButton);

        gameGrid.appendChild(card);
    });
}


function openGame(game) {

    currentGameName.textContent = formatGameName(game.name);

    gameFrame.src = game.url;

    gameModal.classList.remove("hidden");

    document.body.style.overflow = "hidden";
}


function closeCurrentGame() {

    gameFrame.src = "about:blank";

    gameModal.classList.add("hidden");

    document.body.style.overflow = "";
}


async function loadGames() {

    loading.classList.remove("hidden");
    loading.textContent = "Loading games...";

    try {

        const response = await fetch("/api/games", {
            method: "GET",
            cache: "no-store"
        });

        if (!response.ok) {
            throw new Error(
                "Server returned HTTP " + response.status
            );
        }

        const data = await response.json();

        if (!data.ok) {
            throw new Error("Game API returned an error.");
        }

        if (!Array.isArray(data.games)) {
            throw new Error("Invalid game list received.");
        }

        allGames = data.games;

        gameCount.textContent =
            allGames.length + " GAMES";

        renderGames(allGames);

        loading.classList.add("hidden");

    } catch (error) {

        console.error("Could not load games:", error);

        loading.classList.remove("hidden");

        loading.textContent =
            "Could not load games. " +
            error.message;

        gameGrid.innerHTML = "";

        noResults.classList.add("hidden");
    }
}


searchBox.addEventListener("input", () => {

    const search = searchBox.value
        .toLowerCase()
        .trim();

    if (!search) {

        renderGames(allGames);

        return;
    }

    const filteredGames = allGames.filter(game => {

        const name =
            formatGameName(game.name).toLowerCase();

        const filename =
            game.file.toLowerCase();

        return (
            name.includes(search) ||
            filename.includes(search)
        );
    });

    renderGames(filteredGames);
});


closeGame.addEventListener("click", () => {
    closeCurrentGame();
});


gameModal.addEventListener("click", event => {

    if (event.target === gameModal) {
        closeCurrentGame();
    }
});


document.addEventListener("keydown", event => {

    if (event.key === "Escape") {

        if (!gameModal.classList.contains("hidden")) {
            closeCurrentGame();
        }

    }
});


loadGames();
