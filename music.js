
const audio = document.getElementById("audio");
const playBtn = document.getElementById("play");
const previousBtn = document.getElementById("previous");
const nextBtn = document.getElementById("next");
const shuffleBtn = document.getElementById("shuffle");
const repeatBtn = document.getElementById("repeat");

const progress = document.getElementById("progress");
const volume = document.getElementById("volume");
const currentTimeEl = document.getElementById("current-time");
const durationEl = document.getElementById("duration");

const songTitle = document.getElementById("song-title");
const songArtist = document.getElementById("song-artist");
const playlistEl = document.getElementById("playlist");
const filePicker = document.getElementById("file-picker");
const addMusicBtn = document.getElementById("add-music");
const artwork = document.getElementById("artwork");

const libraryTitle = document.getElementById("library-title");
const customPlaylistsEl = document.getElementById("custom-playlists");
const libraryTabs = document.querySelectorAll(".library-tab");

const createDialog = document.getElementById("create-playlist-dialog");
const createForm = document.getElementById("create-playlist-form");
const newPlaylistName = document.getElementById("new-playlist-name");

const addDialog = document.getElementById("add-to-playlist-dialog");
const addForm = document.getElementById("add-to-playlist-form");
const selectedSongName = document.getElementById("selected-song-name");
const targetPlaylist = document.getElementById("target-playlist");

const STORAGE_KEY = "neonwave-library-v2";

let songs = [];
let playlists = [];
let currentIndex = -1;
let currentView = "all";
let selectedPlaylistId = null;
let pendingSongId = null;

let isShuffle = false;
let repeatMode = 0; // 0 = off, 1 = song, 2 = playlist

// Restore saved library information.
// Audio file URLs themselves cannot survive a page refresh.
try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");

    songs = Array.isArray(saved.songs)
        ? saved.songs.map(song => ({
            ...song,
            url: null,
            duration: ""
        }))
        : [];

    playlists = Array.isArray(saved.playlists)
        ? saved.playlists
        : [];
} catch (error) {
    console.error("Could not load saved library:", error);
    songs = [];
    playlists = [];
}

function saveLibrary() {
    try {
        const savedSongs = songs.map(song => ({
            id: song.id,
            title: song.title,
            artist: song.artist,
            fileName: song.fileName,
            fileSize: song.fileSize,
            lastModified: song.lastModified,
            favorite: Boolean(song.favorite)
        }));

        localStorage.setItem(STORAGE_KEY, JSON.stringify({
            songs: savedSongs,
            playlists
        }));
    } catch (error) {
        console.error("Could not save library:", error);
        alert("Your browser could not save the library. Check browser storage.");
    }
}

function formatTime(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) return "0:00";

    const minutes = Math.floor(seconds / 60);
    const remainder = Math.floor(seconds % 60);

    return `${minutes}:${String(remainder).padStart(2, "0")}`;
}

function makeSongId(file) {
    return `${file.name}::${file.size}::${file.lastModified}`;
}

function findSong(id) {
    return songs.find(song => song.id === id);
}

function currentSong() {
    return currentIndex >= 0 ? songs[currentIndex] : null;
}

// Import new files or reconnect files after refreshing.
addMusicBtn.addEventListener("click", () => filePicker.click());

filePicker.addEventListener("change", event => {
    const files = Array.from(event.target.files || []);
    let addedCount = 0;
    let restoredCount = 0;

    for (const file of files) {
        if (!file.type.startsWith("audio/") &&
            !/\.(mp3|wav|ogg|m4a|aac|flac|opus|weba)$/i.test(file.name)) {
            continue;
        }

        const id = makeSongId(file);
        let song = findSong(id);

        if (song) {
            // Reconnect an already saved song.
            song.url = URL.createObjectURL(file);
            restoredCount++;
        } else {
            // Add a new song to the library.
            song = {
                id,
                title: file.name.replace(/\.[^/.]+$/, ""),
                artist: "Local audio",
                fileName: file.name,
                fileSize: file.size,
                lastModified: file.lastModified,
                favorite: false,
                url: URL.createObjectURL(file),
                duration: ""
            };

            songs.push(song);
            addedCount++;
        }
    }

    saveLibrary();
    renderLibrary();

    // Automatically load the first available song.
    if (currentIndex === -1) {
        const firstAvailable = songs.findIndex(song => song.url);
        if (firstAvailable !== -1) loadSong(firstAvailable);
    }

    filePicker.value = "";

    if (addedCount || restoredCount) {
        const parts = [];
        if (addedCount) parts.push(`${addedCount} new song(s) added`);
        if (restoredCount) parts.push(`${restoredCount} saved song(s) reconnected`);

        console.info(parts.join("; "));
    }
});

// Library navigation.
libraryTabs.forEach(tab => {
    tab.addEventListener("click", () => {
        currentView = tab.dataset.view;
        selectedPlaylistId = null;

        libraryTabs.forEach(item => {
            item.classList.toggle("active", item === tab);
        });

        renderLibrary();
    });
});

function visibleSongs() {
    if (currentView === "favorites") {
        return songs.filter(song => song.favorite);
    }

    if (currentView === "playlists") {
        const playlist = playlists.find(
            item => item.id === selectedPlaylistId
        );

        return playlist
            ? playlist.songIds.map(findSong).filter(Boolean)
            : [];
    }

    return songs;
}

function renderLibrary() {
    if (currentView === "all") {
        libraryTitle.textContent = "YOUR LIBRARY";
    } else if (currentView === "favorites") {
        libraryTitle.textContent = "YOUR FAVORITES";
    } else {
        const selected = playlists.find(p => p.id === selectedPlaylistId);
        libraryTitle.textContent = selected
            ? selected.name
            : "YOUR PLAYLISTS";
    }

    renderCustomPlaylists();
    renderSongs();
}

function renderCustomPlaylists() {
    customPlaylistsEl.replaceChildren();

    if (currentView !== "playlists") return;

    const createButton = document.createElement("button");
    createButton.className = "create-playlist-btn";
    createButton.textContent = "+ CREATE PLAYLIST";
    createButton.addEventListener("click", () => {
        newPlaylistName.value = "";
        createDialog.showModal();
        newPlaylistName.focus();
    });

    customPlaylistsEl.appendChild(createButton);

    playlists.forEach(playlist => {
        const row = document.createElement("div");
        row.className = "saved-playlist";

        const openButton = document.createElement("button");
        openButton.textContent =
            `♫  ${playlist.name} (${playlist.songIds.length})`;
        openButton.classList.toggle(
            "selected",
            playlist.id === selectedPlaylistId
        );

        openButton.addEventListener("click", () => {
            selectedPlaylistId = playlist.id;
            renderLibrary();
        });

        const deleteButton = document.createElement("button");
        deleteButton.className = "delete-playlist";
        deleteButton.textContent = "×";
        deleteButton.title = `Delete ${playlist.name}`;
        deleteButton.setAttribute("aria-label", `Delete ${playlist.name}`);

        deleteButton.addEventListener("click", () => {
            if (!confirm(`Delete playlist "${playlist.name}"? Your songs will not be deleted.`)) {
                return;
            }

            playlists = playlists.filter(item => item.id !== playlist.id);

            if (selectedPlaylistId === playlist.id) {
                selectedPlaylistId = null;
            }

            saveLibrary();
            renderLibrary();
        });

        row.append(openButton, deleteButton);
        customPlaylistsEl.appendChild(row);
    });
}

function renderSongs() {
    playlistEl.replaceChildren();

    const visible = visibleSongs();

    if (visible.length === 0) {
        const message = document.createElement("p");
        message.className = "empty-message";

        if (currentView === "favorites") {
            message.textContent = "No favorites yet. Tap ♥ beside a song to save it here.";
        } else if (currentView === "playlists" && !selectedPlaylistId) {
            message.textContent = playlists.length
                ? "Choose a playlist above, or create a new one."
                : "Create your first playlist above.";
        } else if (currentView === "playlists") {
            message.textContent = "This playlist is empty. Add songs using ⋯.";
        } else {
            message.textContent = "Your library is empty. Click + ADD MUSIC to import audio.";
        }

        playlistEl.appendChild(message);
        return;
    }

    visible.forEach((song, index) => {
        const track = document.createElement("div");
        track.className = "track";

        if (song.id === currentSong()?.id) {
            track.classList.add("active");
        }

        if (!song.url) track.classList.add("unavailable");

        const number = document.createElement("span");
        number.className = "track-number";
        number.textContent = song.id === currentSong()?.id && !audio.paused
            ? "♫"
            : String(index + 1);

        const info = document.createElement("div");
        info.className = "track-info";

        const title = document.createElement("p");
        title.className = "track-title";
        title.textContent = song.title;

        const artist = document.createElement("p");
        artist.className = "track-artist";
        artist.textContent = song.url
            ? song.artist
            : "File needs to be selected again";

        info.append(title, artist);

        const actions = document.createElement("div");
        actions.className = "track-actions";

        const favoriteButton = document.createElement("button");
        favoriteButton.className = "favorite-btn";
        favoriteButton.textContent = song.favorite ? "♥" : "♡";
        favoriteButton.classList.toggle("favorited", song.favorite);
        favoriteButton.title = song.favorite
            ? "Remove from favorites"
            : "Add to favorites";
        favoriteButton.setAttribute("aria-label", favoriteButton.title);

        favoriteButton.addEventListener("click", event => {
            event.stopPropagation();

            song.favorite = !song.favorite;
            saveLibrary();
            renderLibrary();
        });

        const moreButton = document.createElement("button");
        moreButton.className = "track-more";
        moreButton.textContent = "⋯";
        moreButton.title = "Add to a playlist";
        moreButton.setAttribute("aria-label", moreButton.title);

        moreButton.addEventListener("click", event => {
            event.stopPropagation();
            openAddToPlaylist(song);
        });

        actions.append(favoriteButton, moreButton);

        const duration = document.createElement("span");
        duration.className = "track-duration";
        duration.textContent = song.duration || "—:—";

        track.append(number, info, duration, actions);

        track.addEventListener("click", () => {
            const actualIndex = songs.findIndex(item => item.id === song.id);

            if (!song.url) {
                alert(
                    `Please click + ADD MUSIC and select "${song.fileName}" again.`
                );
                return;
            }

            loadSong(actualIndex);
            playSong();
        });

        playlistEl.appendChild(track);
    });
}

// Create and save custom playlists.
createForm.addEventListener("submit", event => {
    event.preventDefault();

    const name = newPlaylistName.value.trim();
    if (!name) return;

    const newPlaylist = {
        id: `playlist-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name,
        songIds: []
    };

    playlists.push(newPlaylist);
    selectedPlaylistId = newPlaylist.id;
    currentView = "playlists";

    libraryTabs.forEach(tab => {
        tab.classList.toggle("active", tab.dataset.view === "playlists");
    });

    saveLibrary();
    createDialog.close();
    renderLibrary();
});

document.getElementById("cancel-playlist").addEventListener("click", () => {
    createDialog.close();
});

// Add a song to a chosen playlist.
function openAddToPlaylist(song) {
    if (playlists.length === 0) {
        currentView = "playlists";
        libraryTabs.forEach(tab => {
            tab.classList.toggle("active", tab.dataset.view === "playlists");
        });

        renderLibrary();
        alert("Create a playlist first, then use ⋯ beside a song to add it.");
        return;
    }

    pendingSongId = song.id;
    selectedSongName.textContent = song.title;
    targetPlaylist.replaceChildren();

    playlists.forEach(playlist => {
        const option = document.createElement("option");
        option.value = playlist.id;
        option.textContent = playlist.name;
        targetPlaylist.appendChild(option);
    });

    addDialog.showModal();
}

addForm.addEventListener("submit", event => {
    event.preventDefault();

    const song = findSong(pendingSongId);
    const playlist = playlists.find(p => p.id === targetPlaylist.value);

    if (!song || !playlist) return;

    if (!playlist.songIds.includes(song.id)) {
        playlist.songIds.push(song.id);
        saveLibrary();
    }

    addDialog.close();
    renderLibrary();
});

document.getElementById("cancel-add").addEventListener("click", () => {
    addDialog.close();
});

// Playback functions.
function loadSong(index) {
    if (index < 0 || index >= songs.length) return;

    const song = songs[index];

    if (!song.url) {
        alert(`Please reselect "${song.fileName}" using + ADD MUSIC.`);
        return;
    }

    currentIndex = index;
    audio.src = song.url;

    songTitle.textContent = song.title;
    songArtist.textContent = song.artist;

    progress.value = 0;
    currentTimeEl.textContent = "0:00";
    durationEl.textContent = "0:00";

    playBtn.textContent = "▶";
    playBtn.title = "Play";
    artwork.classList.remove("playing");

    renderLibrary();
}

async function playSong() {
    if (songs.length === 0) {
        alert("Add some music first!");
        return;
    }

    if (currentIndex === -1) {
        const available = songs.findIndex(song => song.url);

        if (available === -1) {
            alert("Click + ADD MUSIC and select your music files first.");
            return;
        }

        loadSong(available);
    }

    try {
        await audio.play();
    } catch (error) {
        console.error("Playback failed:", error);
        songArtist.textContent = "Could not play this file. Try selecting it again.";
    }
}

function updatePlaybackUI() {
    const playing = !audio.paused;

    playBtn.textContent = playing ? "Ⅱ" : "▶";
    playBtn.title = playing ? "Pause" : "Play";
    artwork.classList.toggle("playing", playing);

    renderLibrary();
}

playBtn.addEventListener("click", () => {
    if (audio.paused) playSong();
    else audio.pause();
});

audio.addEventListener("play", updatePlaybackUI);
audio.addEventListener("pause", updatePlaybackUI);

function playIndex(index) {
    if (songs.length === 0) return;

    if (index >= songs.length) {
        if (repeatMode === 2) index = 0;
        else {
            audio.pause();
            audio.currentTime = 0;
            return;
        }
    }

    if (index < 0) index = songs.length - 1;

    // Skip songs whose files have not been reselected.
    for (let count = 0; count < songs.length; count++) {
        if (songs[index]?.url) {
            loadSong(index);
            playSong();
            return;
        }

        index++;

        if (index >= songs.length) {
            if (repeatMode === 2) index = 0;
            else return;
        }
    }
}

previousBtn.addEventListener("click", () => {
    if (songs.length === 0) return;

    if (audio.currentTime > 3) {
        audio.currentTime = 0;
        return;
    }

    playIndex(currentIndex - 1);
});

nextBtn.addEventListener("click", () => {
    if (songs.length === 0) return;

    if (isShuffle && songs.length > 1) {
        const available = songs
            .map((song, index) => ({ song, index }))
            .filter(item => item.song.url && item.index !== currentIndex);

        if (available.length) {
            const choice = available[Math.floor(Math.random() * available.length)];
            playIndex(choice.index);
        }
    } else {
        playIndex(currentIndex + 1);
    }
});

shuffleBtn.addEventListener("click", () => {
    isShuffle = !isShuffle;
    shuffleBtn.classList.toggle("active", isShuffle);
    shuffleBtn.setAttribute("aria-pressed", String(isShuffle));
});

repeatBtn.addEventListener("click", () => {
    repeatMode = (repeatMode + 1) % 3;

    repeatBtn.classList.toggle("active", repeatMode !== 0);
    repeatBtn.textContent = repeatMode === 1 ? "↻¹" : "↻";
    repeatBtn.title = [
        "Repeat off",
        "Repeat current song",
        "Repeat playlist"
    ][repeatMode];

    repeatBtn.setAttribute("aria-pressed", String(repeatMode !== 0));
});

audio.addEventListener("loadedmetadata", () => {
    durationEl.textContent = formatTime(audio.duration);

    const song = currentSong();
    if (song) {
        song.duration = formatTime(audio.duration);
        renderLibrary();
    }
});

audio.addEventListener("timeupdate", () => {
    if (Number.isFinite(audio.duration) && audio.duration > 0) {
        progress.value = (audio.currentTime / audio.duration) * 100;
        currentTimeEl.textContent = formatTime(audio.currentTime);
    }
});

progress.addEventListener("input", () => {
    if (Number.isFinite(audio.duration) && audio.duration > 0) {
        audio.currentTime = (Number(progress.value) / 100) * audio.duration;
    }
});

audio.volume = Number(volume.value);

volume.addEventListener("input", () => {
    audio.volume = Number(volume.value);
});

audio.addEventListener("ended", () => {
    if (repeatMode === 1) {
        audio.currentTime = 0;
        playSong();
    } else if (isShuffle && songs.length > 1) {
        const available = songs
            .map((song, index) => ({ song, index }))
            .filter(item => item.song.url && item.index !== currentIndex);

        if (available.length) {
            playIndex(available[Math.floor(Math.random() * available.length)].index);
        }
    } else if (currentIndex < songs.length - 1 || repeatMode === 2) {
        playIndex(currentIndex + 1);
    } else {
        playBtn.textContent = "▶";
        artwork.classList.remove("playing");
        renderLibrary();
    }
});

// Initial display.
renderLibrary();
