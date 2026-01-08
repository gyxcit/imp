let isPlaying = false;
let audioElement = new Audio();
let currentSong = null;
let isSeekingProgress = false;
let clientStateVersion = 0;
let updateInProgress = false;

// Précharger l'audio pour éviter les latences
audioElement.preload = 'auto';

// Initialiser le volume
audioElement.volume = 1.0;

// Gestion de la fin de la chanson
audioElement.addEventListener('ended', async () => {
    console.log('Chanson terminée, passage à la suivante');
    await nextSong();
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

// Chargement des métadonnées
audioElement.addEventListener('loadedmetadata', () => {
    document.getElementById('totalTime').textContent = formatTime(audioElement.duration);
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

// Slider de progression
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
});

// Slider de volume
const volumeSlider = document.getElementById('volumeSlider');
volumeSlider.addEventListener('input', () => {
    audioElement.volume = volumeSlider.value / 100;
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
                    // Réessayer après un court délai
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
            // L'état de lecture a changé sans changement de chanson
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
    
    if (isPlaying) {
        playIcon.style.display = 'none';
        pauseIcon.style.display = 'block';
    } else {
        playIcon.style.display = 'block';
        pauseIcon.style.display = 'none';
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
            
            // Maintenir l'état de lecture du serveur
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
        }
    } catch (error) {
        console.error('Erreur next:', error);
        showNotification('Erreur lors du passage à la chanson suivante');
    }
}

async function previousSong() {
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
            
            // Maintenir l'état de lecture du serveur
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
        }
    } catch (error) {
        console.error('Erreur previous:', error);
        showNotification('Erreur lors du passage à la chanson précédente');
    }
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

// Initialiser l'affichage
updateDisplay();

// Vérifier périodiquement la synchronisation (facultatif)
setInterval(() => {
    if (!updateInProgress) {
        updateDisplay();
    }
}, 30000); // Toutes les 30 secondes