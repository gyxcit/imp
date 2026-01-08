let isPlaying = false;
let audioElement = new Audio();
let currentSong = null;
let isSeekingProgress = false;
let clientStateVersion = 0;
let updateInProgress = false;
let initialLoadDone = false;

// Précharger l'audio pour éviter les latences
audioElement.preload = 'auto';

// Exposer l'élément audio globalement pour l'adapter (Attention System)
window.audioElement = audioElement;
window.isPlaying = isPlaying;

// Initialiser le volume
audioElement.volume = 1.0;

// Gestion de la fin de la chanson avec repeat
audioElement.addEventListener('ended', async () => {
    console.log('Chanson terminée');

    // Tracker la fin de lecture complète
    if (window.trackSongEnd) {
        window.trackSongEnd(true);
    }

    // Vérifier le mode repeat
    try {
        const response = await fetch('/api/get-modes');
        const data = await response.json();

        if (data.repeat) {
            console.log('Mode repeat actif, relecture');
            audioElement.currentTime = 0;
            await audioElement.play();
        } else {
            console.log('Passage à la suivante');
            await nextSong();
        }
    } catch (error) {
        console.error('Erreur:', error);
        await nextSong();
    }
});

// Chargement des métadonnées
audioElement.addEventListener('loadedmetadata', () => {
    document.getElementById('totalTime').textContent = formatTime(audioElement.duration);

    // Tracker le début de lecture
    if (window.trackSongStart && currentSong) {
        window.trackSongStart(currentSong, audioElement.duration);
    }
});

// Mise à jour de la progression
audioElement.addEventListener('timeupdate', () => {
    if (!isSeekingProgress && audioElement.duration) {
        const progress = (audioElement.currentTime / audioElement.duration) * 100;
        document.getElementById('progressSlider').value = progress;

        document.getElementById('currentTime').textContent = formatTime(audioElement.currentTime);
        document.getElementById('totalTime').textContent = formatTime(audioElement.duration);
    }
});

// Gestion des erreurs audio
audioElement.addEventListener('error', (e) => {
    console.error('Erreur audio:', e);
    showNotification('Erreur de lecture du fichier audio');
});

// Événement quand l'audio peut être joué
audioElement.addEventListener('canplay', () => {
    console.log('Audio prêt à être joué');
});

// Slider de volume - TRACKER L'INTERACTION
const volumeSlider = document.getElementById('volumeSlider');
volumeSlider.addEventListener('input', () => {
    // Ne pas tracker si c'est une adaptation automatique
    if (window.isAdaptingVolume && window.isAdaptingVolume()) {
        return;
    }

    audioElement.volume = volumeSlider.value / 100;

    // Tracker le changement de volume manuel
    if (window.trackAttentionInteraction) {
        window.trackAttentionInteraction('volume', {
            volume: volumeSlider.value
        });
    }
});

function formatTime(seconds) {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

async function updateDisplay() {
    if (updateInProgress) {
        console.log('Mise à jour déjà en cours, ignorée');
        return;
    }

    updateInProgress = true;

    try {
        const response = await fetch('/api/current');
        const data = await response.json();

        // Vérifier si l'état a changé
        const stateChanged = data.state_version !== clientStateVersion;
        clientStateVersion = data.state_version;

        // Mettre à jour l'affichage
        document.getElementById('songTitle').textContent = data.song.title;
        document.getElementById('songArtist').textContent = data.song.artist;

        if (data.total > 0) {
            document.getElementById('progress').textContent = `${data.index + 1} / ${data.total}`;
        } else {
            document.getElementById('progress').textContent = '0 / 0';
        }

        // Synchroniser l'état de lecture
        const wasPlaying = isPlaying;
        isPlaying = data.is_playing;
        window.isPlaying = isPlaying;

        // Charger le fichier audio si différent ou si l'état a changé
        if (data.song.filename && (data.song.filename !== currentSong || stateChanged)) {
            console.log(`Chargement de: ${data.song.filename}`);
            currentSong = data.song.filename;

            // Arrêter la lecture en cours
            audioElement.pause();
            audioElement.currentTime = 0;

            // Charger le nouveau fichier
            audioElement.src = `/music/${currentSong}`;

            // Attendre que le fichier soit chargé avant de jouer
            if (isPlaying) {
                try {
                    await audioElement.load();
                    await audioElement.play();
                    console.log('Lecture démarrée');
                } catch (error) {
                    console.error('Erreur de lecture:', error);
                    setTimeout(async () => {
                        try {
                            await audioElement.play();
                        } catch (e) {
                            console.error('Échec de la relecture:', e);
                        }
                    }, 100);
                }
            }
        } else if (isPlaying !== wasPlaying) {
            if (isPlaying) {
                try {
                    await audioElement.play();
                    console.log('Reprise de la lecture');
                } catch (error) {
                    console.error('Erreur de reprise:', error);
                }
            } else {
                audioElement.pause();
                console.log('Lecture mise en pause');
            }
        }

        updatePlayPauseIcon();

    } catch (error) {
        console.error('Erreur lors de la mise à jour:', error);
        showNotification('Erreur de connexion au serveur');
    } finally {
        updateInProgress = false;
    }
}

function updatePlayPauseIcon() {
    const playIcon = document.getElementById('playIcon');
    const pauseIcon = document.getElementById('pauseIcon');
    const playBtn = document.getElementById('playPauseBtn');

    if (isPlaying) {
        playIcon.style.display = 'none';
        pauseIcon.style.display = 'block';
        if (playBtn) playBtn.classList.add('playing');
    } else {
        playIcon.style.display = 'block';
        pauseIcon.style.display = 'none';
        if (playBtn) playBtn.classList.remove('playing');
    }
}

function showNotification(message) {
    const notif = document.getElementById('notification');
    notif.textContent = message;
    notif.classList.add('show');
    setTimeout(() => {
        notif.classList.remove('show');
    }, 3000);
}

async function uploadFiles(event) {
    const files = event.target.files;
    if (files.length === 0) return;

    const formData = new FormData();
    for (let file of files) {
        formData.append('files', file);
    }

    try {
        const response = await fetch('/api/upload', {
            method: 'POST',
            body: formData
        });

        const data = await response.json();
        showNotification(`${data.uploaded.length} fichier(s) ajouté(s)`);
        clientStateVersion = data.state_version;
        await updateDisplay();

        // Mettre à jour la playlist si ouverte
        if (playlistOpen) {
            updatePlaylistMenu();
        }
    } catch (error) {
        console.error('Erreur upload:', error);
        showNotification('Erreur lors de l\'ajout des fichiers');
    }

    event.target.value = '';
}

async function clearPlaylist() {
    if (confirm('Voulez-vous effacer toute la playlist ?')) {
        try {
            const response = await fetch('/api/clear', {
                method: 'POST'
            });
            const data = await response.json();

            audioElement.pause();
            audioElement.src = '';
            currentSong = null;
            isPlaying = false;
            clientStateVersion = data.state_version;

            document.getElementById('progressSlider').value = 0;
            document.getElementById('currentTime').textContent = '0:00';
            document.getElementById('totalTime').textContent = '0:00';

            await updateDisplay();

            // Mettre à jour la playlist si ouverte
            if (playlistOpen) {
                updatePlaylistMenu();
            }

            showNotification('Playlist effacée');
        } catch (error) {
            console.error('Erreur clear:', error);
            showNotification('Erreur lors de l\'effacement');
        }
    }
}

async function togglePlayPause() {
    try {
        const response = await fetch('/api/play-pause', {
            method: 'POST'
        });
        const data = await response.json();

        clientStateVersion = data.state_version;
        isPlaying = data.is_playing;
        window.isPlaying = isPlaying;

        // Tracker play/pause
        if (window.trackAttentionInteraction) {
            window.trackAttentionInteraction(isPlaying ? 'play' : 'pause');
        }

        if (isPlaying && audioElement.src) {
            try {
                await audioElement.play();
                console.log('Play activé');
            } catch (error) {
                console.error('Erreur de lecture:', error);
                showNotification('Impossible de lire le fichier');
            }
        } else {
            audioElement.pause();
            console.log('Pause activée');
        }

        updatePlayPauseIcon();
    } catch (error) {
        console.error('Erreur toggle:', error);
        showNotification('Erreur de connexion');
    }
}

async function nextSong() {
    // Tracker le skip
    if (window.trackAttentionInteraction) {
        window.trackAttentionInteraction('skip');
    }

    try {
        const response = await fetch('/api/next', {
            method: 'POST'
        });

        if (!response.ok) {
            console.log('Pas de chanson suivante');
            return;
        }

        const data = await response.json();
        clientStateVersion = data.state_version;

        if (data.song && data.song.filename) {
            console.log(`Passage à la chanson suivante: ${data.song.filename}`);
            currentSong = data.song.filename;

            audioElement.pause();
            audioElement.currentTime = 0;
            audioElement.src = `/music/${currentSong}`;
            document.getElementById('progressSlider').value = 0;

            isPlaying = data.is_playing;

            if (isPlaying) {
                try {
                    await audioElement.load();
                    await audioElement.play();
                    console.log('Lecture de la chanson suivante');
                } catch (error) {
                    console.error('Erreur de lecture:', error);
                }
            }

            await updateDisplay();

            if (playlistOpen) {
                updatePlaylistMenu();
            }
        }
    } catch (error) {
        console.error('Erreur next:', error);
        showNotification('Erreur lors du passage à la chanson suivante');
    }
}

async function previousSong() {
    // Tracker la navigation
    if (window.trackAttentionInteraction) {
        window.trackAttentionInteraction('seek');
    }

    try {
        const response = await fetch('/api/previous', {
            method: 'POST'
        });

        if (!response.ok) {
            console.log('Pas de chanson précédente');
            return;
        }

        const data = await response.json();
        clientStateVersion = data.state_version;

        if (data.song && data.song.filename) {
            console.log(`Passage à la chanson précédente: ${data.song.filename}`);
            currentSong = data.song.filename;

            audioElement.pause();
            audioElement.currentTime = 0;
            audioElement.src = `/music/${currentSong}`;
            document.getElementById('progressSlider').value = 0;

            isPlaying = data.is_playing;

            if (isPlaying) {
                try {
                    await audioElement.load();
                    await audioElement.play();
                    console.log('Lecture de la chanson précédente');
                } catch (error) {
                    console.error('Erreur de lecture:', error);
                }
            }

            await updateDisplay();

            // Mettre à jour la playlist si ouverte
            if (playlistOpen) {
                updatePlaylistMenu();
            }
        }
    } catch (error) {
        console.error('Erreur previous:', error);
        showNotification('Erreur lors du passage à la chanson précédente');
    }
}

// Slider de progression - TRACKER L'INTERACTION
const progressSlider = document.getElementById('progressSlider');
progressSlider.addEventListener('input', () => {
    isSeekingProgress = true;
    const time = (progressSlider.value / 100) * audioElement.duration;
    document.getElementById('currentTime').textContent = formatTime(time);
});

progressSlider.addEventListener('change', () => {
    const time = (progressSlider.value / 100) * audioElement.duration;
    audioElement.currentTime = time;
    isSeekingProgress = false;

    // Tracker le seek
    if (window.trackAttentionInteraction) {
        window.trackAttentionInteraction('seek', {
            position: time
        });
    }
});

// Gestion de la playlist
let playlistOpen = false;

function createPlaylistButton() {
    const playlistSelector = document.createElement('div');
    playlistSelector.className = 'playlist-selector';
    playlistSelector.innerHTML = `
        <button class="playlist-toggle-btn file-btn" id="playlistToggleBtn">
            <svg viewBox="0 0 24 24">
                <path d="M15 6H3v2h12V6zm0 4H3v2h12v-2zM3 16h8v-2H3v2zM17 6v8.18c-.31-.11-.65-.18-1-.18-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3V8h3V6h-5z"/>
            </svg>
            Liste
        </button>
        <div class="playlist-menu" id="playlistMenu" style="display: none;">
            <div class="playlist-menu-header">
                <span>Playlist</span>
                <span class="playlist-count" id="playlistCount">0 titre</span>
                <button class="refresh-btn" id="refreshPlaylistBtn" title="Recharger les fichiers">
                    <svg viewBox="0 0 24 24" width="16" height="16">
                        <path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/>
                    </svg>
                </button>
            </div>
            <div class="playlist-items" id="playlistItems">
                <div class="playlist-empty">
                    <svg viewBox="0 0 24 24">
                        <path d="M12 3v9.28c-.47-.17-.97-.28-1.5-.28C8.01 12 6 14.01 6 16.5S8.01 21 10.5 21c2.31 0 4.2-1.75 4.45-4H15V6h4V3h-7z"/>
                    </svg>
                    <div class="playlist-empty-text">Aucune musique</div>
                </div>
            </div>
        </div>
    `;

    document.querySelector('.file-controls').appendChild(playlistSelector);

    // Event listeners
    document.getElementById('playlistToggleBtn').addEventListener('click', (e) => {
        e.stopPropagation();
        togglePlaylistMenu();
    });

    // Bouton refresh
    document.getElementById('refreshPlaylistBtn').addEventListener('click', async (e) => {
        e.stopPropagation();
        await refreshPlaylistFromFolder();
    });

    // Fermer le menu si on clique ailleurs
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.playlist-selector')) {
            hidePlaylistMenu();
        }
    });

    // Charger la playlist initiale
    updatePlaylistMenu();
}

function togglePlaylistMenu() {
    const menu = document.getElementById('playlistMenu');
    playlistOpen = !playlistOpen;
    menu.style.display = playlistOpen ? 'flex' : 'none';

    if (playlistOpen) {
        updatePlaylistMenu();
    }
}

function hidePlaylistMenu() {
    const menu = document.getElementById('playlistMenu');
    if (menu) {
        menu.style.display = 'none';
        playlistOpen = false;
    }
}

async function updatePlaylistMenu() {
    try {
        const response = await fetch('/api/playlist');
        const data = await response.json();

        const playlistItems = document.getElementById('playlistItems');
        const playlistCount = document.getElementById('playlistCount');

        if (!playlistItems || !playlistCount) return;

        // Mettre à jour le compteur
        const count = data.playlist.length;
        playlistCount.textContent = `${count} titre${count !== 1 ? 's' : ''}`;

        // Afficher les items
        if (data.playlist.length === 0) {
            playlistItems.innerHTML = `
                <div class="playlist-empty">
                    <svg viewBox="0 0 24 24">
                        <path d="M12 3v9.28c-.47-.17-.97-.28-1.5-.28C8.01 12 6 14.01 6 16.5S8.01 21 10.5 21c2.31 0 4.2-1.75 4.45-4H15V6h4V3h-7z"/>
                    </svg>
                    <div class="playlist-empty-text">Aucune musique</div>
                </div>
            `;
        } else {
            playlistItems.innerHTML = data.playlist.map((song, index) => {
                const isActive = index === data.current_index;
                const isPlayingClass = isActive && data.is_playing ? 'playing' : '';
                return `
                    <button class="playlist-item ${isActive ? 'active' : ''} ${isPlayingClass}" data-index="${index}">
                        <div class="playlist-item-icon">
                            <svg viewBox="0 0 24 24">
                                ${isActive && data.is_playing ?
                        '<path d="M6 4h4v16H6zm8 0h4v16h-4z"/>' :
                        '<path d="M8 5v14l11-7z"/>'}
                            </svg>
                        </div>
                        <div class="playlist-item-info">
                            <div class="playlist-item-title">${escapeHtml(song.title)}</div>
                            <div class="playlist-item-artist">${escapeHtml(song.artist)}</div>
                        </div>
                    </button>
                `;
            }).join('');

            // Ajouter les event listeners
            document.querySelectorAll('.playlist-item').forEach(item => {
                item.addEventListener('click', async () => {
                    const index = parseInt(item.dataset.index);
                    await playFromPlaylist(index);
                });
            });
        }
    } catch (error) {
        console.error('Erreur lors du chargement de la playlist:', error);
    }
}

async function playFromPlaylist(index) {
    // Tracker la sélection depuis la playlist
    if (window.trackAttentionInteraction) {
        window.trackAttentionInteraction('playlist', { index });
    }

    try {
        const response = await fetch('/api/play-index', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ index })
        });

        const data = await response.json();
        clientStateVersion = data.state_version;

        await updateDisplay();
        updatePlaylistMenu();

        console.log(`Lecture de la chanson ${index + 1}`);
    } catch (error) {
        console.error('Erreur lors de la lecture:', error);
        showNotification('Erreur lors de la lecture');
    }
}

// Fonction pour recharger depuis le dossier
async function refreshPlaylistFromFolder() {
    try {
        const btn = document.getElementById('refreshPlaylistBtn');
        if (btn) {
            btn.style.transform = 'rotate(360deg)';
            btn.style.transition = 'transform 0.5s ease';
        }

        const response = await fetch('/api/reload-files', {
            method: 'POST'
        });

        const data = await response.json();
        showNotification(`${data.total} fichier(s) trouvé(s)`);
        clientStateVersion = data.state_version;

        await updateDisplay();
        if (playlistOpen) {
            updatePlaylistMenu();
        }

        setTimeout(() => {
            if (btn) btn.style.transform = '';
        }, 500);
    } catch (error) {
        console.error('Erreur lors du rechargement:', error);
        showNotification('Erreur lors du rechargement');
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Event listeners
document.getElementById('playPauseBtn').addEventListener('click', togglePlayPause);
document.getElementById('nextBtn').addEventListener('click', nextSong);
document.getElementById('prevBtn').addEventListener('click', previousSong);
document.getElementById('addFilesBtn').addEventListener('click', () => {
    document.getElementById('fileInput').click();
});
document.getElementById('clearBtn').addEventListener('click', clearPlaylist);
document.getElementById('fileInput').addEventListener('change', uploadFiles);

// Gestion des raccourcis clavier
document.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && e.target === document.body) {
        e.preventDefault();
        togglePlayPause();
    } else if (e.code === 'ArrowRight') {
        nextSong();
    } else if (e.code === 'ArrowLeft') {
        previousSong();
    }
});

// Initialisation au chargement de la page
async function initialLoad() {
    try {
        // SOLUTION 1 : Forcer le rechargement automatique au démarrage
        console.log('Rechargement automatique des fichiers...');
        const response = await fetch('/api/reload-files', {
            method: 'POST'
        });

        if (response.ok) {
            const data = await response.json();
            console.log(`${data.total} fichier(s) chargé(s) depuis le dossier`);
            clientStateVersion = data.state_version;
        }
    } catch (error) {
        console.log('Impossible de recharger les fichiers:', error);
    }

    await updateDisplay();
    initialLoadDone = true;
}

// Initialiser le bouton de playlist
document.addEventListener('DOMContentLoaded', () => {
    createPlaylistButton();

    // Créer le bouton d'insights - MODIFIÉ
    const insightsBtn = document.createElement('button');
    insightsBtn.className = 'file-btn';
    insightsBtn.id = 'insightsBtn';
    insightsBtn.innerHTML = `
        <svg viewBox="0 0 24 24" width="16" height="16">
            <path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z"/>
        </svg>
        Insights
    `;
    insightsBtn.addEventListener('click', () => {
        // MODIFIÉ : Utiliser toggleInsights au lieu de showInsights
        if (window.toggleInsights) {
            window.toggleInsights();
        }
    });

    document.querySelector('.file-controls').insertBefore(
        insightsBtn,
        document.querySelector('.playlist-selector')
    );
});

// Lancer le chargement initial
initialLoad();

// Vérifier périodiquement la synchronisation
setInterval(() => {
    if (!updateInProgress && playlistOpen) {
        updatePlaylistMenu();
    }
}, 5000);