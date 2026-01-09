// static/test-analyzers.js
class AnalyzerTester {
    constructor() {
        this.socket = null;
        this.stream = null;
        this.videoElement = null;
        this.audioContext = null;
        this.isCapturing = false;
        this.logs = [];
        
        // NOUVEAU: Canvas pour overlay de tracking
        this.trackingCanvas = null;
        this.trackingContext = null;
        this.lastHeadPosition = null;
        
        this.init();
    }

    init() {
        // Connexion WebSocket
        this.socket = io.connect(location.origin);
        
        // Événements WebSocket
        this.socket.on('connect', () => {
            this.updateStatus(true);
            this.addLog('✅ Connecté au serveur');
        });

        this.socket.on('disconnect', () => {
            this.updateStatus(false);
            this.addLog('❌ Déconnecté du serveur');
        });

        this.socket.on('video_result', (data) => {
            console.log('📹 Video data reçue:', data);
            this.updateVideoDisplay(data);
        });

        this.socket.on('audio_result', (data) => {
            console.log('🎤 Audio data reçue:', data);
            this.updateAudioDisplay(data);
        });

        this.socket.on('fusion_update', (data) => {
            console.log('🧠 Fusion data reçue:', data);
            this.updateFusionDisplay(data);
        });

        this.socket.on('error', (data) => {
            this.addLog(`❌ Erreur: ${data.message}`);
        });

        this.socket.on('stats_reset', (data) => {
            this.addLog('🔄 ' + data.message);
            this.resetDisplays();
        });

        // Préparer vidéo preview
        this.videoElement = document.getElementById('videoPreview');
        
        console.log('🎬 AnalyzerTester initialisé');
    }

    updateStatus(connected) {
        const statusEl = document.getElementById('connectionStatus');
        if (connected) {
            statusEl.className = 'status connected';
            statusEl.textContent = '🟢 Connecté';
        } else {
            statusEl.className = 'status disconnected';
            statusEl.textContent = '⚫ Déconnecté';
        }
    }

    addLog(message) {
        const now = new Date();
        const time = now.toLocaleTimeString();
        
        this.logs.unshift({ time, message });
        if (this.logs.length > 50) this.logs.pop();
        
        const logsContainer = document.getElementById('logsContainer');
        logsContainer.innerHTML = this.logs.map(log => `
            <div class="log-entry">
                <span class="log-time">[${log.time}]</span>
                <span>${log.message}</span>
            </div>
        `).join('');
    }

    async startCapture() {
        if (this.isCapturing) return;

        try {
            this.addLog('🎥 Demande permissions caméra/micro...');

            this.stream = await navigator.mediaDevices.getUserMedia({
                video: { width: 640, height: 480, frameRate: 15 },
                audio: { sampleRate: 16000 }
            });

            this.videoElement.srcObject = this.stream;
            this.videoElement.classList.remove('inactive');
            await this.videoElement.play();

            // NOUVEAU: Créer le canvas de tracking
            this.createTrackingOverlay();

            this.isCapturing = true;
            document.getElementById('startBtn').disabled = true;
            document.getElementById('stopBtn').disabled = false;

            this.addLog('✅ Capture démarrée');

            // Démarrer capture frames
            this.captureVideoFrames();
            // Démarrer capture audio
            this.captureAudio();

        } catch (error) {
            this.addLog(`❌ Erreur: ${error.message}`);
            console.error('Erreur détaillée:', error);
            alert('Veuillez autoriser l\'accès à la caméra et au micro');
        }
    }

    createTrackingOverlay() {
        const container = this.videoElement.parentElement;
        
        // Créer canvas overlay
        this.trackingCanvas = document.createElement('canvas');
        this.trackingCanvas.id = 'trackingOverlay';
        this.trackingCanvas.style.position = 'absolute';
        this.trackingCanvas.style.top = '0';
        this.trackingCanvas.style.left = '0';
        this.trackingCanvas.style.pointerEvents = 'none';
        this.trackingCanvas.style.zIndex = '10';
        this.trackingCanvas.style.borderRadius = '10px';
        
        // Même taille et position que la vidéo
        const videoRect = this.videoElement.getBoundingClientRect();
        this.trackingCanvas.width = this.videoElement.videoWidth || 640;
        this.trackingCanvas.height = this.videoElement.videoHeight || 480;
        this.trackingCanvas.style.width = '100%';
        this.trackingCanvas.style.height = '100%';
        
        container.style.position = 'relative';
        container.appendChild(this.trackingCanvas);
        
        this.trackingContext = this.trackingCanvas.getContext('2d');
        this.addLog('🎯 Overlay de tracking créé');
    }

    captureVideoFrames() {
        if (!this.isCapturing) return;

        const canvas = document.createElement('canvas');
        canvas.width = 640;
        canvas.height = 480;
        const ctx = canvas.getContext('2d');

        const sendFrame = () => {
            if (!this.isCapturing) return;

            ctx.drawImage(this.videoElement, 0, 0, 640, 480);
            const frameData = canvas.toDataURL('image/jpeg', 0.8);

            this.socket.emit('video_frame', { frame: frameData });

            setTimeout(sendFrame, 100); // 10 FPS
        };

        sendFrame();
    }

    captureAudio() {
        try {
            // Créer AudioContext uniquement si pas déjà créé
            if (!this.audioContext || this.audioContext.state === 'closed') {
                this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            }
            
            // Reprendre le contexte s'il est suspendu
            if (this.audioContext.state === 'suspended') {
                this.audioContext.resume();
            }

            const source = this.audioContext.createMediaStreamSource(this.stream);
            const processor = this.audioContext.createScriptProcessor(4096, 1, 1);

            processor.onaudioprocess = (e) => {
                if (!this.isCapturing) return;

                const audioData = e.inputBuffer.getChannelData(0);
                
                // Convertir en base64
                const float32Array = new Float32Array(audioData);
                const uint8Array = new Uint8Array(float32Array.buffer);
                
                let binary = '';
                uint8Array.forEach(byte => binary += String.fromCharCode(byte));
                const base64 = btoa(binary);

                this.socket.emit('audio_chunk', { audio: base64 });
            };

            source.connect(processor);
            processor.connect(this.audioContext.destination);
            
            this.addLog('🎤 Capture audio démarrée');
        } catch (error) {
            this.addLog(`❌ Erreur audio: ${error.message}`);
            console.error('Erreur audio détaillée:', error);
        }
    }

    updateVideoDisplay(data) {
        const result = data.result;

        // Visage détecté
        document.getElementById('faceDetected').textContent = 
            result.face_detected ? '✅ Oui' : '❌ Non';

        // Engagement
        const engagement = result.engagement_score;
        document.getElementById('engagementScore').textContent = `${engagement} / 100`;
        document.getElementById('engagementProgress').style.width = `${engagement}%`;

        // Position tête
        const yaw = Math.round(result.head_pose.yaw);
        const pitch = Math.round(result.head_pose.pitch);
        document.getElementById('headYaw').textContent = `${yaw}°`;
        document.getElementById('headPitch').textContent = `${pitch}°`;

        // NOUVEAU: Dessiner le tracking
        this.drawHeadTracking(result);

        // Émotion principale
        const emotionBadge = this.getEmotionBadge(result.emotion_hint);
        document.getElementById('videoEmotion').innerHTML = emotionBadge;

        // Données expression faciale (OpenCV)
        if (result.facial_expression) {
            const expr = result.facial_expression;
            
            // Confiance
            const confidence = Math.round(expr.confidence * 100);
            const confidenceEl = document.getElementById('expressionConfidence');
            if (confidenceEl) {
                confidenceEl.textContent = `${confidence}%`;
            }
        }

        // Frame count
        document.getElementById('frameCount').textContent = data.frame_count;
    }

    drawHeadTracking(result) {
        if (!this.trackingContext) {
            console.log('❌ trackingContext non disponible');
            return;
        }

        const canvas = this.trackingCanvas;
        const w = canvas.width;
        const h = canvas.height;
        
        // Effacer le canvas
        this.trackingContext.clearRect(0, 0, w, h);

        if (!result.face_detected) {
            // Afficher message "Aucun visage détecté"
            this.trackingContext.fillStyle = 'rgba(255, 0, 0, 0.9)';
            this.trackingContext.font = 'bold 18px Arial';
            this.trackingContext.textAlign = 'center';
            this.trackingContext.fillText('❌ Aucun visage détecté', w/2, h/2);
            
            // Afficher quand même les mains/bras si détectés
            this.drawHandsAndArms(result, w, h);
            return;
        }

        const headPose = result.head_pose;
        const yaw = headPose.yaw || 0;
        const pitch = headPose.pitch || 0;

        // Centre de l'écran comme référence
        const centerX = w / 2;
        const centerY = h / 2;

        // Calculer position de la tête basée sur yaw/pitch
        const headX = centerX + (yaw * 4); // Amplifier le mouvement
        const headY = centerY + (pitch * 3);

        // Dessiner le tracking de la tête
        this.trackingContext.strokeStyle = '#00ff00';
        this.trackingContext.fillStyle = 'rgba(0, 255, 0, 0.2)';
        this.trackingContext.lineWidth = 3;

        // Cercle principal (tête)
        this.trackingContext.beginPath();
        this.trackingContext.arc(headX, headY, 50, 0, 2 * Math.PI);
        this.trackingContext.stroke();
        this.trackingContext.fill();

        // Flèche de direction
        this.drawDirectionArrow(headX, headY, yaw, pitch);

        // Trail de mouvement
        this.drawMovementTrail(headX, headY);

        // Texte informations
        this.trackingContext.fillStyle = '#ffffff';
        this.trackingContext.font = '12px Arial';
        this.trackingContext.textAlign = 'left';
        this.trackingContext.fillText(`Yaw: ${yaw.toFixed(1)}°`, 10, 30);
        this.trackingContext.fillText(`Pitch: ${pitch.toFixed(1)}°`, 10, 50);
    }

    drawDirectionArrow(headX, headY, yaw, pitch) {
        const arrowLength = 30;
        const endX = headX + (yaw / 50) * arrowLength;
        const endY = headY + (pitch / 50) * arrowLength;

        this.trackingContext.strokeStyle = '#ff00ff';
        this.trackingContext.lineWidth = 3;
        this.trackingContext.beginPath();
        this.trackingContext.moveTo(headX, headY);
        this.trackingContext.lineTo(endX, endY);
        this.trackingContext.stroke();

        // Pointe de flèche
        const angle = Math.atan2(endY - headY, endX - headX);
        const arrowSize = 8;
        this.trackingContext.beginPath();
        this.trackingContext.moveTo(endX, endY);
        this.trackingContext.lineTo(
            endX - arrowSize * Math.cos(angle - Math.PI / 6),
            endY - arrowSize * Math.sin(angle - Math.PI / 6)
        );
        this.trackingContext.moveTo(endX, endY);
        this.trackingContext.lineTo(
            endX - arrowSize * Math.cos(angle + Math.PI / 6),
            endY - arrowSize * Math.sin(angle + Math.PI / 6)
        );
        this.trackingContext.stroke();
    }

    drawMovementTrail(currentX, currentY) {
        if (this.lastHeadPosition) {
            this.trackingContext.strokeStyle = 'rgba(255, 255, 0, 0.6)';
            this.trackingContext.lineWidth = 2;
            this.trackingContext.beginPath();
            this.trackingContext.moveTo(this.lastHeadPosition.x, this.lastHeadPosition.y);
            this.trackingContext.lineTo(currentX, currentY);
            this.trackingContext.stroke();
        }
        
        this.lastHeadPosition = { x: currentX, y: currentY };
    }

    stopCapture() {
        if (!this.isCapturing) return;

        this.isCapturing = false;
        
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }

        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }

        this.videoElement.srcObject = null;
        this.videoElement.classList.add('inactive');

        // NOUVEAU: Supprimer l'overlay
        if (this.trackingCanvas) {
            this.trackingCanvas.remove();
            this.trackingCanvas = null;
            this.trackingContext = null;
        }

        document.getElementById('startBtn').disabled = false;
        document.getElementById('stopBtn').disabled = true;

        this.addLog('⏹️ Capture arrêtée');
    }

    updateAudioDisplay(data) {
        const result = data.result;

        // Parole
        document.getElementById('speechDetected').textContent = 
            result.speech_detected ? '✅ Oui' : '❌ Non';

        // Énergie
        const energy = result.energy_level;
        document.getElementById('energyLevel').textContent = `${energy}%`;
        document.getElementById('energyProgress').style.width = `${energy}%`;

        // Pitch
        document.getElementById('pitchValue').textContent = 
            `${Math.round(result.pitch)} Hz`;

        // Émotion
        const emotionBadge = this.getEmotionBadge(result.emotion_hint);
        document.getElementById('audioEmotion').innerHTML = emotionBadge;

        // Chunk count
        document.getElementById('chunkCount').textContent = data.chunk_count;
    }

    updateFusionDisplay(data) {
        // Score attention
        const attention = data.attention_score;
        document.getElementById('fusionAttention').textContent = `${attention} / 100`;
        document.getElementById('fusionProgress').style.width = `${attention}%`;

        // Émotion dominante
        const emotionBadge = this.getEmotionBadge(data.emotion);
        document.getElementById('fusionEmotion').innerHTML = emotionBadge;

        // Pattern
        const patternBadge = this.getPatternBadge(data.pattern);
        document.getElementById('fusionPattern').innerHTML = patternBadge;
        
        // NOUVEAU: Afficher les indicateurs mouvement/parole
        const movementIcon = data.movement_detected ? '✅ Oui' : '❌ Non';
        const speechIcon = data.speech_detected ? '✅ Oui' : '❌ Non';
        const bothIcon = data.both_active ? '✅ Actifs' : '❌ Inactifs';
        
        document.getElementById('movementIndicator').textContent = movementIcon;
        document.getElementById('speechIndicator').textContent = speechIcon;
        document.getElementById('bothIndicator').textContent = bothIcon;

        // Alerte pattern
        const alertEl = document.getElementById('patternAlert');
        if (data.pattern !== 'normal') {
            alertEl.classList.add('active');
            document.getElementById('patternMessage').textContent = 
                this.getPatternMessage(data.pattern);
        } else {
            alertEl.classList.remove('active');
        }

        this.addLog(`🧠 Fusion: Attention ${attention}/100, Pattern: ${data.pattern}, Mouvement: ${data.movement_detected}, Parole: ${data.speech_detected}`);
    }

    getEmotionBadge(emotion) {
        const emotionIcons = {
            'happy': '😊',
            'sad': '😢',
            'surprised': '😮',
            'focused': '🤔',
            'tired': '😴',
            'neutral': '😐',
            'absent': '❌',
            'excited': '🤩',
            'calm': '😌'
        };
        
        const colors = {
            'happy': 'success',
            'excited': 'warning',
            'calm': 'info',
            'neutral': 'info',
            'sad': 'danger',
            'tired': 'warning',
            'focused': 'info',
            'surprised': 'warning',
            'absent': 'danger'
        };
        
        const icon = emotionIcons[emotion] || '😐';
        const color = colors[emotion] || 'info';
        return `<span class="badge ${color}">${icon} ${emotion}</span>`;
    }

    getPatternBadge(pattern) {
        const colors = {
            'normal': 'success',
            'drowsy': 'warning',
            'absent': 'danger'
        };
        const color = colors[pattern] || 'info';
        return `<span class="badge ${color}">${pattern}</span>`;
    }

    getPatternMessage(pattern) {
        const messages = {
            'drowsy': 'Utilisateur semble somnolent (tête penchée)',
            'absent': 'Aucune présence détectée (pas de visage ni voix)'
        };
        return messages[pattern] || 'Pattern détecté';
    }

    resetDisplays() {
        // Vidéo
        document.getElementById('faceDetected').textContent = '❌ Non';
        document.getElementById('engagementScore').textContent = '0 / 100';
        document.getElementById('engagementProgress').style.width = '0%';
        document.getElementById('headYaw').textContent = '0°';
        document.getElementById('headPitch').textContent = '0°';
        document.getElementById('videoEmotion').innerHTML = '<span class="badge info">neutral</span>';
        document.getElementById('frameCount').textContent = '0';

        // Audio
        document.getElementById('speechDetected').textContent = '❌ Non';
        document.getElementById('energyLevel').textContent = '0%';
        document.getElementById('energyProgress').style.width = '0%';
        document.getElementById('pitchValue').textContent = '0 Hz';
        document.getElementById('audioEmotion').innerHTML = '<span class="badge info">neutral</span>';
        document.getElementById('chunkCount').textContent = '0';

        // Fusion
        document.getElementById('fusionAttention').textContent = '0 / 100';
        document.getElementById('fusionProgress').style.width = '0%';
        document.getElementById('fusionEmotion').innerHTML = '<span class="badge info">neutral</span>';
        document.getElementById('fusionPattern').innerHTML = '<span class="badge success">normal</span>';
        document.getElementById('patternAlert').classList.remove('active');
    }

    resetStats() {
        this.socket.emit('reset_stats');
    }
}

// Initialiser
let tester;
document.addEventListener('DOMContentLoaded', () => {
    tester = new AnalyzerTester();
});

// Fonctions globales pour les boutons
function startCapture() {
    tester.startCapture();
}

function stopCapture() {
    tester.stopCapture();
}

function resetStats() {
    tester.resetStats();
}