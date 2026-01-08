// static/multimodal-capture.js
class MultimodalCapture {
    constructor() {
        this.socket = null;
        this.stream = null;
        this.videoElement = null;
        this.audioContext = null;
        this.isCapturing = false;
    }

    async init() {
        // Connexion WebSocket
        this.socket = io.connect(location.origin);

        // Créer élément vidéo caché
        this.videoElement = document.createElement('video');
        this.videoElement.style.display = 'none';
        document.body.appendChild(this.videoElement);

        console.log('🎥 MultimodalCapture initialisé');
    }

    async startCapture() {
        if (this.isCapturing) return;

        try {
            // Demander permissions
            this.stream = await navigator.mediaDevices.getUserMedia({
                video: { width: 640, height: 480, frameRate: 15 },
                audio: { sampleRate: 16000 }
            });

            this.videoElement.srcObject = this.stream;
            await this.videoElement.play();

            // Démarrer envoi frames
            this.captureVideoFrames();

            // Démarrer envoi audio
            this.captureAudio();

            this.isCapturing = true;
            console.log('✅ Capture démarrée');

            // Notifier backend
            await fetch('/api/multimodal/start', { method: 'POST' });

        } catch (error) {
            console.error('❌ Erreur capture:', error);
            alert('Veuillez autoriser l\'accès à la caméra et au micro');
        }
    }

    captureVideoFrames() {
        if (!this.isCapturing) return;

        const canvas = document.createElement('canvas');
        canvas.width = 640;
        canvas.height = 480;
        const ctx = canvas.getContext('2d');

        const sendFrame = () => {
            if (!this.isCapturing) return;

            // Dessiner frame sur canvas
            ctx.drawImage(this.videoElement, 0, 0, 640, 480);

            // Convertir en base64
            const frameData = canvas.toDataURL('image/jpeg', 0.8);

            // Envoyer via WebSocket
            this.socket.emit('video_frame', { frame: frameData });

            // 10 FPS
            setTimeout(sendFrame, 100);
        };

        sendFrame();
    }

    captureAudio() {
        this.audioContext = new AudioContext({ sampleRate: 16000 });
        const source = this.audioContext.createMediaStreamSource(this.stream);
        const processor = this.audioContext.createScriptProcessor(4096, 1, 1);

        processor.onaudioprocess = (e) => {
            if (!this.isCapturing) return;

            const audioData = e.inputBuffer.getChannelData(0);

            // Conversion sécurisée en base64 pour éviter le Stack Overflow
            const buffer = new Float32Array(audioData);
            const bytes = new Uint8Array(buffer.buffer);
            let binary = '';
            for (let i = 0; i < bytes.byteLength; i++) {
                binary += String.fromCharCode(bytes[i]);
            }
            const base64 = btoa(binary);

            this.socket.emit('audio_chunk', { audio: base64 });
        };

        source.connect(processor);
        processor.connect(this.audioContext.destination);
    }

    async stopCapture() {
        this.isCapturing = false;

        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
        }

        if (this.audioContext) {
            this.audioContext.close();
        }

        await fetch('/api/multimodal/stop', { method: 'POST' });
        console.log('🛑 Capture arrêtée');
    }
}

// Initialiser au chargement
let multimodalCapture;
document.addEventListener('DOMContentLoaded', async () => {
    multimodalCapture = new MultimodalCapture();
    await multimodalCapture.init();
});

// Exposer globalement
window.startMultimodalCapture = () => multimodalCapture.startCapture();
window.stopMultimodalCapture = () => multimodalCapture.stopCapture();