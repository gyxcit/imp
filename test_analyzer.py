# test_analyzers_app.py
from flask import Flask, render_template, jsonify
from flask_socketio import SocketIO, emit
import cv2
import numpy as np
import base64
from analyzers.video_analyzer import VideoAnalyzer
from analyzers.audio_analyzer import AudioAnalyzer
from analyzers.emotion_fusion import EmotionFusion
import time

app = Flask(__name__)
socketio = SocketIO(app, cors_allowed_origins="*")

# Initialiser les analyseurs
video_analyzer = VideoAnalyzer()
audio_analyzer = AudioAnalyzer()
fusion_engine = EmotionFusion()

# État global pour stocker les résultats
current_state = {
    'video': None,
    'audio': None,
    'fusion': None,
    'frame_count': 0,
    'audio_chunk_count': 0
}

# Variable globale pour le throttling
last_analysis_time = 0
ANALYSIS_INTERVAL = 0.5  # Analyser max 2 fois par seconde

@app.route('/')
def index():
    return render_template('test_analyzers.html')

@app.route('/api/stats')
def get_stats():
    """Obtenir les statistiques actuelles"""
    return jsonify(current_state)

@socketio.on('connect')
def handle_connect():
    print('✅ Client connecté')
    emit('connected', {'message': 'Connecté au serveur de test'})

@socketio.on('video_frame')
def handle_video_frame(data):
    """Traiter une frame vidéo avec throttling"""
    global last_analysis_time
    
    try:
        current_time = time.time()
        
        # Throttling: analyser max toutes les 0.5s
        if current_time - last_analysis_time < ANALYSIS_INTERVAL:
            return
        
        last_analysis_time = current_time
        
        # Décoder base64 → numpy array
        img_data = base64.b64decode(data['frame'].split(',')[1])
        nparr = np.frombuffer(img_data, np.uint8)
        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        # Analyser la frame (avec OpenCV Haar Cascades)
        video_result = video_analyzer.analyze_frame(frame)
        current_state['video'] = video_result
        current_state['frame_count'] += 1
        
        print(f"📹 Frame {current_state['frame_count']}: Face={video_result['face_detected']}, Engagement={video_result['engagement_score']}")
        
        # Fusion si audio disponible
        if current_state['audio']:
            fusion_result = fusion_engine.fuse_signals(
                current_state['video'],
                current_state['audio']
            )
            current_state['fusion'] = fusion_result
            print(f"🧠 Fusion: Attention={fusion_result['attention_score']}, Mouvements={len(fusion_engine.head_movement_history)}")
            emit('fusion_update', fusion_result)
        
        # Envoyer résultat vidéo
        emit('video_result', {
            'result': video_result,
            'frame_count': current_state['frame_count']
        })
        
    except Exception as e:
        print(f"❌ Erreur traitement frame: {e}")
        import traceback
        traceback.print_exc()
        emit('error', {'message': str(e)})

@socketio.on('audio_chunk')
def handle_audio_chunk(data):
    """Traiter un chunk audio"""
    try:
        audio_bytes = base64.b64decode(data['audio'])
        audio_array = np.frombuffer(audio_bytes, dtype=np.float32)

        audio_result = audio_analyzer.analyze_audio(audio_array)
        current_state['audio'] = audio_result
        current_state['audio_chunk_count'] += 1

        print(f"🎤 Chunk {current_state['audio_chunk_count']}: Speech={audio_result['speech_detected']}, Energy={audio_result['energy_level']}")

        if current_state['video']:
            fusion_result = fusion_engine.fuse_signals(
                current_state['video'],
                current_state['audio']
            )
            current_state['fusion'] = fusion_result
            emit('fusion_update', fusion_result)

        emit('audio_result', {
            'result': audio_result,
            'chunk_count': current_state['audio_chunk_count']
        })

    except Exception as e:
        import traceback
        traceback.print_exc()
        emit('error', {'message': f'Audio error: {e}'})

@socketio.on('reset_stats')
def handle_reset():
    """Réinitialiser les statistiques"""
    global current_state
    current_state = {
        'video': None,
        'audio': None,
        'fusion': None,
        'frame_count': 0,
        'audio_chunk_count': 0
    }
    emit('stats_reset', {'message': 'Statistiques réinitialisées'})
    print('🔄 Statistiques réinitialisées')

if __name__ == '__main__':
    print('🎬 Lancement de l\'application de test des analyseurs')
    print('📡 Accédez à http://localhost:5001')
    socketio.run(app, debug=True, host='0.0.0.0', port=5001)