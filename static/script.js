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
    // Si une adaptation est en cours, on l'annule pour rendre la main à l'utilisateur
    if (window.cancelVolumeAdaptation) {
        window.cancelVolumeAdaptation();
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

        if (!response.ok) throw new Error('Erreur réseau');

        const data = await response.json();
        console.log('Fichiers téléchargés:', data);
        showNotification(`${data.total} fichier(s) téléchargé(s)`);

        // Mettre à jour la playlist si elle est ouverte
        if (playlistOpen) {
            updatePlaylistMenu();
        }
    } catch (error) {
        console.error('Erreur lors du téléchargement:', error);
        showNotification('Erreur lors du téléchargement des fichiers');
    }
}

// ==========================================
// FONCTIONS DE CONTRÔLE MANQUANTES (AJOUTÉES)
// ==========================================

async function togglePlayPause() {
    try {
        const response = await fetch('/api/play-pause', { method: 'POST' });
        const data = await response.json();
        isPlaying = data.is_playing;
        window.isPlaying = isPlaying;
        updatePlayPauseIcon();
        if (isPlaying) audioElement.play();
        else audioElement.pause();
    } catch (error) {
        console.error('Erreur play/pause:', error);
    }
}

async function nextSong() {
    try {
        await fetch('/api/next', { method: 'POST' });
        await updateDisplay();
    } catch (e) { console.error(e); }
}

async function previousSong() {
    try {
        await fetch('/api/prev', { method: 'POST' });
        await updateDisplay();
    } catch (e) { console.error(e); }
}

async function clearPlaylist() {
    if (!confirm('Voulez-vous vraiment tout effacer ?')) return;
    try {
        await fetch('/api/clear', { method: 'POST' });
        await updateDisplay();
    } catch (e) { console.error(e); }
}

// ==========================================
// LOGIQUE DU SIDEBAR ET DES ANALYSES
// ==========================================

let analysisInterval = null;
let webcamStream = null;

// Initialiser Socket.IO pour recevoir les résultats d'analyse
const socket = io();

socket.on('connect', () => {
    console.log('✅ Connecté au serveur WebSocket');
});

// Écouter les résultats d'analyse vidéo pour mettre à jour l'UI
socket.on('video_result', (data) => {
    if (data && data.result) {
        // Dessiner l'overlay
        drawTrackingOverlay(data.result);

        // Mettre à jour les métriques UI avec les vraies données
        if (data.result.face_detected && data.result.head_pose) {
            // Arrêter la simulation si elle tourne encore
            if (analysisInterval) {
                clearInterval(analysisInterval);
                analysisInterval = null;
            }

            updateMetricsUI({
                headX: data.result.head_pose.yaw.toFixed(1),
                headY: data.result.head_pose.pitch.toFixed(1),
                energy: data.result.engagement_score || 0,
                voiceEmotion: window.lastVoiceEmotion || '--', // Sera mis à jour par audio_result
                faceEmotion: data.result.emotion_hint || '--',
                score: data.result.engagement_score || 0
            });
        }
    }
});

socket.on('force_refresh', (data) => {
    if (data.reason === 'low_attention') {
        showNotification(data.message);
        // Refresh UI state if needed
        setTimeout(updateDisplay, 500);
    }
});

// --- FONCTIONS DE DESSIN DU TRACKER ---
function drawTrackingOverlay(result) {
    const canvas = document.getElementById('trackingOverlay');
    const video = document.getElementById('webcamFeed');

    if (!canvas || !video || !result) return;

    // Aligner la taille du canvas sur la vidéo
    if (canvas.width !== video.clientWidth || canvas.height !== video.clientHeight) {
        canvas.width = video.clientWidth;
        canvas.height = video.clientHeight;
    }

    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;

    // Nettoyer
    ctx.clearRect(0, 0, w, h);

    if (result.face_detected) {
        const score = result.engagement_score;
        const color = score > 70 ? '#00E676' : (score > 30 ? '#FFEB3B' : '#FF3D00');

        ctx.strokeStyle = color;
        ctx.lineWidth = 3;

        // Simuler une boîte autour du visage (centrée, car on n'envoie pas les coords exactes pour l'instant)
        // On utilise le "head_pose" pour décaler légèrement la boîte et donner l'impression de suivi
        const yaw = result.head_pose.yaw;
        const pitch = result.head_pose.pitch;

        const centerX = (w / 2) + (yaw * 2); // Décalage basé sur la rotation
        const centerY = (h / 2) + (pitch * 2);
        const boxSize = h * 0.5;

        // 1. Dessiner le cadre visage (style HUD)
        ctx.strokeRect(centerX - boxSize / 2, centerY - boxSize / 2, boxSize, boxSize);

        // 2. Dessiner la direction du regard (Flèche)
        const endX = centerX + (yaw * 3);
        const endY = centerY + (pitch * 3);

        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.lineTo(endX, endY);
        ctx.strokeStyle = 'cyan';
        ctx.stroke();

        // 3. Afficher le score
        ctx.fillStyle = color;
        ctx.font = 'bold 16px monospace';
        ctx.fillText(`ENGAGEMENT: ${score}%`, centerX - boxSize / 2, centerY - boxSize / 2 - 10);

        // 4. Afficher l'émotion
        if (result.emotion_hint) {
            ctx.fillStyle = 'white';
            ctx.fillText(`EMOTION: ${result.emotion_hint.toUpperCase()}`, centerX - boxSize / 2, centerY + boxSize / 2 + 20);
        }
    }
}

// Fonction pour envoyer les frames au serveur (à appeler quand la caméra est active)
function sendVideoFrame() {
    const video = document.getElementById('webcamFeed');
    if (!video || !webcamStream || video.paused || video.ended) return;

    // Créer un canvas temporaire pour capturer la frame
    const canvas = document.createElement('canvas');
    canvas.width = 300; // Résolution réduite pour performance
    canvas.height = 200;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Envoyer en base64
    const dataURL = canvas.toDataURL('image/jpeg', 0.6);
    socket.emit('video_frame', { frame: dataURL });
}

// --- AUDIO CAPTURE ---
let audioContext = null;
let scriptProcessor = null;
let microphone = null;

function startAudioCapture(stream) {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }

    // Créer la source
    microphone = audioContext.createMediaStreamSource(stream);

    // Créer le processeur (bufferSize, inputChannels, outputChannels)
    // 4096 = ~0.1s de latence à 44.1kHz, bon compromis
    scriptProcessor = audioContext.createScriptProcessor(4096, 1, 1);

    scriptProcessor.onaudioprocess = (audioProcessingEvent) => {
        // Send audio regardless of music playing state
        const inputBuffer = audioProcessingEvent.inputBuffer;
        const inputData = inputBuffer.getChannelData(0);

        // Convertir Float32Array en ArrayBuffer pour l'envoi
        // On envoie directement le buffer binaire encodé en base64
        const buffer = inputData.buffer;
        const base64Audio = arrayBufferToBase64(buffer);

        socket.emit('audio_chunk', { audio: base64Audio });
    };

    microphone.connect(scriptProcessor);
    scriptProcessor.connect(audioContext.destination);

    console.log('🎤 Capture audio démarrée');
}

function stopAudioCapture() {
    if (microphone) {
        microphone.disconnect();
        microphone = null;
    }
    if (scriptProcessor) {
        scriptProcessor.disconnect();
        scriptProcessor = null;
    }
    // Ne pas fermer le context pour pouvoir le réutiliser, ou le suspendre
    if (audioContext && audioContext.state !== 'closed') {
        audioContext.suspend();
    }
}

// Convertir ArrayBuffer en Base64
function arrayBufferToBase64(buffer) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
}

// Écouter les résultats audio
socket.on('audio_result', (data) => {
    if (data && data.result) {
        // Backend renvoie 'emotion_hint' not 'emotion'
        const emotionEn = data.result.emotion_hint || 'neutral';

        // Traduire en français
        const emotionMap = {
            'excited': 'Excité',
            'neutral': 'Neutre',
            'calm': 'Calme'
        };

        const emotion = emotionMap[emotionEn] || emotionEn;
        window.lastVoiceEmotion = emotion; // Stocker pour usage combiné

        const voiceElem = document.getElementById('voiceEmotion');
        if (voiceElem) {
            voiceElem.textContent = emotion;
        }

        console.log('🎤 Émotion vocale:', emotion, '(energy:', data.result.energy_level + ')');
    }
});

document.addEventListener('DOMContentLoaded', () => {
    initialLoad();
    initSidebarLogic();
});

function initSidebarLogic() {
    // 1. Gestion de la Caméra
    const cameraToggle = document.getElementById('cameraToggle');
    const videoElement = document.getElementById('webcamFeed');
    const placeholder = document.getElementById('cameraPlaceholder');
    let frameInterval = null;

    if (!cameraToggle || !videoElement || !placeholder) {
        console.warn('⚠️ Éléments sidebar non trouvés');
        return;
    }

    cameraToggle.addEventListener('change', async (e) => {
        if (e.target.checked) {
            try {
                // Feedback visuel
                placeholder.innerHTML = '<span>⏳ Activation...</span>';

                // Demander l'accès Vidéo ET Audio
                webcamStream = await navigator.mediaDevices.getUserMedia({
                    video: { width: 640, height: 360, frameRate: 15 },
                    audio: true
                });

                videoElement.srcObject = webcamStream;
                videoElement.classList.add('active');
                placeholder.style.display = 'none';

                // FORCER LA LECTURE EXPLICITEMENT
                try {
                    await videoElement.play();
                } catch (playErr) {
                    console.error("Erreur play() vidéo:", playErr);
                    showNotification("Erreur de lecture vidéo (autoplay bloqué ?)");
                }

                console.log('📷 Caméra activée');
                showNotification('Caméra et Micro activés');

                // --- CAPTURE VIDÉO ---
                if (frameInterval) clearInterval(frameInterval);
                frameInterval = setInterval(sendVideoFrame, 150); // ~10 FPS max pour le backend

                // --- CAPTURE AUDIO ---
                startAudioCapture(webcamStream);

            } catch (err) {
                console.error("Erreur accès caméra/micro:", err);
                e.target.checked = false;
                placeholder.style.display = 'flex';
                placeholder.innerHTML = `
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <path d="M21 21l-6-6m2-2l4-4V7l-7 5 7 5v-2c0-1.1.9-2 2-2z"></path>
                        <path d="M1 5v14c0 1.1.9 2 2 2h14l-2-2H3V7l-2-2z"></path>
                    </svg>
                    <span>Erreur d'accès</span>
                `;
                showNotification("Impossible d'accéder à la caméra/micro");
            }
        } else {
            // Arrêter la capture Vidéo
            if (frameInterval) clearInterval(frameInterval);
            frameInterval = null;

            // Arrêter la capture Audio
            stopAudioCapture();

            if (webcamStream) {
                webcamStream.getTracks().forEach(track => track.stop());
                webcamStream = null;
            }
            videoElement.pause();
            videoElement.srcObject = null;
            videoElement.classList.remove('active');
            placeholder.style.display = 'flex';
            placeholder.innerHTML = `
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <path d="M21 21l-6-6m2-2l4-4V7l-7 5 7 5v-2c0-1.1.9-2 2-2z"></path>
                    <path d="M1 5v14c0 1.1.9 2 2 2h14l-2-2H3V7l-2-2z"></path>
                </svg>
                <span>Inactif</span>
            `;

            // Nettoyer le tracking
            const canvas = document.getElementById('trackingOverlay');
            if (canvas) {
                const ctx = canvas.getContext('2d');
                ctx.clearRect(0, 0, canvas.width, canvas.height);
            }
            // Reset valeurs UI
            window.lastVoiceEmotion = '--';

            console.log('📷 Caméra désactivée');
            showNotification('Caméra désactivée');
        }
    });

    // 2. Gestion du Collapse Analysis
    const toggleBtn = document.getElementById('analysisToggleBtn');
    const content = document.getElementById('analysisContent');
    const chevron = document.getElementById('analysisChevron');

    if (toggleBtn && content && chevron) {
        toggleBtn.addEventListener('click', () => {
            content.classList.toggle('collapsed');
            chevron.classList.toggle('rotated');
        });
    }

    // 3. Démarrer la simulation SEULEMENT si pas de vraie donnée (fallback)
    // startAnalysisSimulation();
    console.log('✅ Sidebar initialisé');
}

function startAnalysisSimulation() {
    if (analysisInterval) clearInterval(analysisInterval);

    analysisInterval = setInterval(() => {
        // Ne mettre à jour que si la musique joue
        if (!window.isPlaying) return;

        updateMetricsUI({
            headX: (Math.random() * 20 - 10).toFixed(1),
            headY: (Math.random() * 20 - 10).toFixed(1),
            energy: Math.floor(Math.random() * 100),
            voiceEmotion: getRandomEmotion(['Joie', 'Calme', 'Neutre', 'Énergie']),
            faceEmotion: getRandomEmotion(['Heureux', 'Surpris', 'Neutre', 'Concentré']),
            score: Math.floor(Math.random() * 30) + 70
        });
    }, 1000);
}

function getRandomEmotion(list) {
    return list[Math.floor(Math.random() * list.length)];
}

function updateMetricsUI(data) {
    const headX = document.getElementById('headX');
    const headY = document.getElementById('headY');
    const energyVal = document.getElementById('energyVal');
    const energyBar = document.getElementById('energyBar');
    const voiceEmotion = document.getElementById('voiceEmotion');
    const faceEmotion = document.getElementById('faceEmotion');
    const finalScore = document.getElementById('finalScore');

    if (headX) headX.textContent = data.headX;
    if (headY) headY.textContent = data.headY;
    if (energyVal) energyVal.textContent = `${data.energy}%`;
    if (energyBar) energyBar.style.width = `${data.energy}%`;
    if (voiceEmotion) voiceEmotion.textContent = data.voiceEmotion;
    if (faceEmotion) faceEmotion.textContent = data.faceEmotion;

    if (finalScore) {
        finalScore.textContent = data.score;
        // Couleur dynamique du score
        if (data.score > 80) {
            finalScore.style.background = 'linear-gradient(45deg, #2ecc71, #27ae60)';
        } else if (data.score > 50) {
            finalScore.style.background = 'linear-gradient(45deg, #f1c40f, #f39c12)';
        } else {
            finalScore.style.background = 'linear-gradient(45deg, #e74c3c, #c0392b)';
        }
        finalScore.style.webkitBackgroundClip = 'text';
        finalScore.style.webkitTextFillColor = 'transparent';
        finalScore.style.backgroundClip = 'text';
    }
}

// Fonction pour ajouter une chanson validée
window.addValidatedSong = function (title, duration, score) {
    const list = document.getElementById('validatedList');
    if (!list) return;

    // Supprimer l'exemple statique s'il existe
    const example = list.querySelector('.validated-item');
    if (example && example.querySelector('.v-title').textContent === 'Midnight City') {
        example.remove();
    }

    const item = document.createElement('div');
    item.className = 'validated-item';
    item.innerHTML = `
        <div class="v-info">
            <span class="v-title">${title}</span>
            <span class="v-duration">${duration}</span>
        </div>
        <div class="v-score ${score >= 80 ? 'high' : 'medium'}">${score}%</div>
    `;
    list.appendChild(item);

    // Scroll vers le nouvel élément
    list.scrollTop = list.scrollHeight;
};

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
