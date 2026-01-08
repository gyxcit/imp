let isPlaying = false;
let audioElement = new Audio();
let currentSong = null;
let isSeekingProgress = false;

// Initialiser le volume
audioElement.volume = 1.0;

// Gestion de la fin de la chanson
audioElement.addEventListener('ended', async () => {
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
    const response = await fetch('/api/current');
    const data = await response.json();
    
    document.getElementById('songTitle').textContent = data.song.title;
    document.getElementById('songArtist').textContent = data.song.artist;
    document.getElementById('progress').textContent = `${data.index + 1} / ${data.total}`;
    
    isPlaying = data.is_playing;
    
    // Charger le fichier audio si différent
    if (data.song.filename && data.song.filename !== currentSong) {
        currentSong = data.song.filename;
        audioElement.src = `/music/${currentSong}`;
        
        if (isPlaying) {
            try {
                await audioElement.play();
            } catch (error) {
                console.error('Erreur de lecture:', error);
            }
        }
    }
    
    updatePlayPauseIcon();
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
        await updateDisplay();
    } catch (error) {
        showNotification('Erreur lors de l\'ajout des fichiers');
    }

    event.target.value = '';
}

async function clearPlaylist() {
    if (confirm('Voulez-vous effacer toute la playlist ?')) {
        await fetch('/api/clear');
        audioElement.pause();
        audioElement.src = '';
        currentSong = null;
        document.getElementById('progressSlider').value = 0;
        document.getElementById('currentTime').textContent = '0:00';
        document.getElementById('totalTime').textContent = '0:00';
        await updateDisplay();
        showNotification('Playlist effacée');
    }
}

async function togglePlayPause() {
    const response = await fetch('/api/play-pause');
    const data = await response.json();
    isPlaying = data.is_playing;
    
    if (isPlaying) {
        try {
            await audioElement.play();
        } catch (error) {
            console.error('Erreur de lecture:', error);
        }
    } else {
        audioElement.pause();
    }
    
    updatePlayPauseIcon();
}

async function nextSong() {
    const response = await fetch('/api/next');
    const data = await response.json();
    
    if (data.song) {
        currentSong = data.song.filename;
        audioElement.src = `/music/${currentSong}`;
        document.getElementById('progressSlider').value = 0;
        
        if (isPlaying) {
            try {
                await audioElement.play();
            } catch (error) {
                console.error('Erreur de lecture:', error);
            }
        }
        
        await updateDisplay();
    }
}

async function previousSong() {
    const response = await fetch('/api/previous');
    const data = await response.json();
    
    if (data.song) {
        currentSong = data.song.filename;
        audioElement.src = `/music/${currentSong}`;
        document.getElementById('progressSlider').value = 0;
        
        if (isPlaying) {
            try {
                await audioElement.play();
            } catch (error) {
                console.error('Erreur de lecture:', error);
            }
        }
        
        await updateDisplay();
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

// Initialiser l'affichage
updateDisplay();