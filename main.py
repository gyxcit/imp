from flask import Flask, render_template, jsonify, request, send_from_directory
import os
from pathlib import Path
from mutagen import File as MutagenFile
from mutagen.mp3 import MP3
from mutagen.id3 import ID3
import traceback
import json
from datetime import datetime
import time

print("📦 Imports de base OK")

# Importer le système d'attention
from attention_system import AttentionDetector
print("✅ AttentionDetector importé")

from flask_socketio import SocketIO, emit
print("✅ Flask-SocketIO importé")

print("⏳ Chargement de MultimodalSystem (MediaPipe)... cela peut prendre 30s-1min au premier démarrage")
from multimodal_system import MultimodalSystem
print("✅ MultimodalSystem importé")

import base64
import numpy as np
import cv2

app = Flask(__name__)

# Configuration
UPLOAD_FOLDER = 'music_files'
ALLOWED_EXTENSIONS = {'mp3', 'wav', 'ogg', 'm4a', 'flac'}
ANALYTICS_FILE = 'user_analytics.json'

if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = 50 * 1024 * 1024  # 50 MB max

playlist = []
current_index = 0
is_playing = False
state_version = 0

# Variables globales pour shuffle et repeat
shuffle_mode = False
repeat_mode = False

# NOUVEAU: Système d'attention
attention_detector = AttentionDetector()

# Système d'analyse comportementale (existant)
user_analytics = {
    'songs': {},
    'listening_patterns': {
        'total_playtime': 0,
        'total_sessions': 0,
        'avg_session_duration': 0,
        'preferred_time_of_day': [],
        'skip_rate': 0,
        'completion_rate': 0
    },
    'preferences': {
        'favorite_songs': [],
        'disliked_songs': [],
        'most_played': [],
        'recently_skipped': []
    },
    'adaptive_settings': {
        'ui_complexity': 'standard',
        'recommendation_aggressiveness': 'medium',
        'auto_skip_enabled': False,
        'smart_shuffle_enabled': False
    }
}

# Session en cours
current_session = {
    'start_time': None,
    'current_song': None,
    'song_start_time': None,
    'total_listening_time': 0
}

# Initialiser système multimodal
socketio = SocketIO(app, cors_allowed_origins="*")
multimodal_system = MultimodalSystem(attention_detector)

def load_analytics():
    """Charger les analytics depuis le fichier"""
    global user_analytics
    if os.path.exists(ANALYTICS_FILE):
        try:
            with open(ANALYTICS_FILE, 'r', encoding='utf-8') as f:
                user_analytics = json.load(f)
            print("Analytics chargées")
        except Exception as e:
            print(f"Erreur chargement analytics: {e}")

def save_analytics():
    """Sauvegarder les analytics dans le fichier"""
    try:
        with open(ANALYTICS_FILE, 'w', encoding='utf-8') as f:
            json.dump(user_analytics, f, indent=2, ensure_ascii=False)
    except Exception as e:
        print(f"Erreur sauvegarde analytics: {e}")

def init_song_stats(song_id):
    """Initialiser les statistiques d'une chanson"""
    if song_id not in user_analytics['songs']:
        user_analytics['songs'][song_id] = {
            'play_count': 0,
            'skip_count': 0,
            'total_listening_time': 0,
            'completion_count': 0,
            'last_played': None,
            'average_completion': 0,
            'rating': 0  # Auto-calculé basé sur le comportement
        }

def calculate_song_rating(song_id):
    """Calculer le rating d'une chanson basé sur le comportement"""
    stats = user_analytics['songs'].get(song_id, {})
    
    play_count = stats.get('play_count', 0)
    skip_count = stats.get('skip_count', 0)
    completion_count = stats.get('completion_count', 0)
    
    if play_count == 0:
        return 0
    
    # Formule de rating (0-100)
    completion_rate = (completion_count / play_count) * 100 if play_count > 0 else 0
    skip_penalty = (skip_count / play_count) * 50 if play_count > 0 else 0
    frequency_bonus = min(play_count * 5, 30)
    
    rating = completion_rate + frequency_bonus - skip_penalty
    rating = max(0, min(100, rating))
    
    return round(rating, 2)

def update_adaptive_settings():
    """Mettre à jour les paramètres adaptatifs basés sur le comportement"""
    patterns = user_analytics['listening_patterns']
    
    # Déterminer la complexité UI basée sur l'engagement
    total_sessions = patterns.get('total_sessions', 0)
    if total_sessions < 5:
        user_analytics['adaptive_settings']['ui_complexity'] = 'simple'
    elif total_sessions < 20:
        user_analytics['adaptive_settings']['ui_complexity'] = 'standard'
    else:
        user_analytics['adaptive_settings']['ui_complexity'] = 'advanced'
    
    # Activer smart shuffle si beaucoup de skips
    skip_rate = patterns.get('skip_rate', 0)
    if skip_rate > 30:
        user_analytics['adaptive_settings']['smart_shuffle_enabled'] = True
    
    # Ajuster l'agressivité des recommandations
    completion_rate = patterns.get('completion_rate', 0)
    if completion_rate < 50:
        user_analytics['adaptive_settings']['recommendation_aggressiveness'] = 'high'
    elif completion_rate > 80:
        user_analytics['adaptive_settings']['recommendation_aggressiveness'] = 'low'

def get_recommended_songs():
    """Obtenir des recommandations basées sur le comportement"""
    # Trier les chansons par rating
    rated_songs = []
    for song in playlist:
        song_id = song['filename']
        init_song_stats(song_id)
        rating = calculate_song_rating(song_id)
        user_analytics['songs'][song_id]['rating'] = rating
        
        rated_songs.append({
            'song': song,
            'rating': rating,
            'stats': user_analytics['songs'][song_id]
        })
    
    # Trier par rating décroissant
    rated_songs.sort(key=lambda x: x['rating'], reverse=True)
    
    # Retourner le top 5
    return rated_songs[:5]

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def increment_state_version():
    global state_version
    state_version += 1

def extract_metadata(filepath, filename):
    """Extraire les métadonnées d'un fichier audio"""
    try:
        audio = MutagenFile(filepath)
        
        if audio is not None:
            title = None
            artist = None
            
            if hasattr(audio, 'tags') and audio.tags:
                if 'TIT2' in audio.tags:
                    title = str(audio.tags['TIT2'])
                if 'TPE1' in audio.tags:
                    artist = str(audio.tags['TPE1'])
                    
                if not title and 'title' in audio.tags:
                    title = str(audio.tags['title'][0]) if isinstance(audio.tags['title'], list) else str(audio.tags['title'])
                if not artist and 'artist' in audio.tags:
                    artist = str(audio.tags['artist'][0]) if isinstance(audio.tags['artist'], list) else str(audio.tags['artist'])
            
            if title and artist:
                return title.strip(), artist.strip()
    except Exception as e:
        print(f"Erreur lors de l'extraction des métadonnées de {filename}: {e}")
    
    name_without_ext = os.path.splitext(filename)[0]
    if ' - ' in name_without_ext:
        parts = name_without_ext.split(' - ', 1)
        return parts[1].strip(), parts[0].strip()
    else:
        return name_without_ext.strip(), 'Artiste inconnu'

def load_existing_music_files():
    """Charger tous les fichiers musicaux existants dans le dossier"""
    global playlist, current_index
    
    playlist = []
    
    if not os.path.exists(app.config['UPLOAD_FOLDER']):
        return
    
    files = os.listdir(app.config['UPLOAD_FOLDER'])
    audio_files = [f for f in files if allowed_file(f)]
    
    for filename in sorted(audio_files):
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        title, artist = extract_metadata(filepath, filename)
        
        song_data = {
            'title': title,
            'artist': artist,
            'filename': filename
        }
        playlist.append(song_data)
    
    if playlist:
        current_index = 0
        print(f"Chargé {len(playlist)} fichier(s) audio")
    else:
        current_index = 0
        print("Aucun fichier audio trouvé")

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/current')
def get_current():
    if not playlist:
        return jsonify({
            'song': {'title': 'Aucune musique', 'artist': 'Ajoutez des fichiers', 'filename': None},
            'is_playing': False,
            'index': -1,
            'total': 0,
            'state_version': state_version
        })
    
    return jsonify({
        'song': playlist[current_index],
        'is_playing': is_playing,
        'index': current_index,
        'total': len(playlist),
        'state_version': state_version
    })

# ===== NOUVELLES ROUTES POUR LE SYSTÈME D'ATTENTION =====

@app.route('/api/attention/state')
def get_attention_state():
    """
    Obtenir l'état actuel du système d'attention
    Cette route est appelée fréquemment et RECALCULE l'attention
    pour détecter l'inactivité
    """
    # Appeler check pour recalculer selon le temps écoulé
    state = attention_detector.check_and_update_attention()
    return jsonify(state)

@app.route('/api/attention/track', methods=['POST'])
def track_attention():
    """Enregistrer une interaction utilisateur"""
    data = request.get_json()
    interaction_type = data.get('type')
    interaction_data = data.get('data', {})
    
    state = attention_detector.track_interaction(interaction_type, interaction_data)
    
    return jsonify({
        'success': True,
        'state': state
    })

@app.route('/api/attention/reset', methods=['POST'])
def reset_attention():
    """Réinitialiser le système d'attention"""
    attention_detector.reset()
    return jsonify({'success': True})

# ===== ROUTES ANALYTICS EXISTANTES =====

@app.route('/api/analytics/start-session', methods=['POST'])
def start_session():
    """Démarrer une session d'écoute"""
    user_analytics['listening_patterns']['total_sessions'] += 1
    save_analytics()
    
    # Tracker pour le système d'attention
    attention_detector.track_interaction('session_start')
    
    return jsonify({'success': True})

@app.route('/api/analytics/song-start', methods=['POST'])
def song_start():
    """Enregistrer le début de lecture d'une chanson"""
    data = request.get_json()
    song_id = data.get('song_id')
    
    if song_id:
        init_song_stats(song_id)
        
        user_analytics['songs'][song_id]['play_count'] += 1
        user_analytics['songs'][song_id]['last_played'] = datetime.now().isoformat()
        save_analytics()
        
        # Tracker pour le système d'attention
        attention_detector.track_interaction('play', {'song': song_id})
    
    return jsonify({'success': True})

@app.route('/api/analytics/song-end', methods=['POST'])
def song_end():
    """Enregistrer la fin de lecture d'une chanson"""
    data = request.get_json()
    song_id = data.get('song_id')
    duration = data.get('duration', 0)
    listened_duration = data.get('listened_duration', 0)
    completed = data.get('completed', False)
    
    if song_id and song_id in user_analytics['songs']:
        stats = user_analytics['songs'][song_id]
        stats['total_listening_time'] += listened_duration
        
        if completed:
            stats['completion_count'] += 1
        
        # Calculer le pourcentage d'écoute
        if duration > 0:
            completion_percentage = (listened_duration / duration) * 100
            stats['average_completion'] = completion_percentage
        
        # Mettre à jour le rating
        stats['rating'] = calculate_song_rating(song_id)
        
        save_analytics()
    
    return jsonify({'success': True})

@app.route('/api/analytics/song-skip', methods=['POST'])
def song_skip():
    """Enregistrer un skip"""
    data = request.get_json()
    song_id = data.get('song_id')
    
    if song_id:
        init_song_stats(song_id)
        user_analytics['songs'][song_id]['skip_count'] += 1
        
        # Ajouter aux skips récents
        if song_id not in user_analytics['preferences']['recently_skipped']:
            user_analytics['preferences']['recently_skipped'].append(song_id)
        
        # Garder seulement les 10 derniers
        user_analytics['preferences']['recently_skipped'] = \
            user_analytics['preferences']['recently_skipped'][-10:]
        
        # Calculer le skip rate global
        total_plays = sum(s.get('play_count', 0) for s in user_analytics['songs'].values())
        total_skips = sum(s.get('skip_count', 0) for s in user_analytics['songs'].values())
        
        if total_plays > 0:
            user_analytics['listening_patterns']['skip_rate'] = \
                round((total_skips / total_plays) * 100, 2)
        
        # Mettre à jour les paramètres adaptatifs
        update_adaptive_settings()
        
        save_analytics()
        
        # Tracker pour le système d'attention
        attention_detector.track_interaction('skip', {'song': song_id})
    
    return jsonify({'success': True})

@app.route('/api/analytics/get-stats')
def get_analytics_stats():
    """Obtenir les statistiques complètes"""
    # Mettre à jour les chansons les plus jouées
    most_played = sorted(
        [(song_id, stats) for song_id, stats in user_analytics['songs'].items()],
        key=lambda x: x[1].get('play_count', 0),
        reverse=True
    )[:5]
    
    user_analytics['preferences']['most_played'] = [
        {'song_id': song_id, 'play_count': stats['play_count']}
        for song_id, stats in most_played
    ]
    
    # Calculer le completion rate global
    total_plays = sum(s.get('play_count', 0) for s in user_analytics['songs'].values())
    total_completions = sum(s.get('completion_count', 0) for s in user_analytics['songs'].values())
    
    if total_plays > 0:
        user_analytics['listening_patterns']['completion_rate'] = \
            round((total_completions / total_plays) * 100, 2)
    
    return jsonify(user_analytics)

@app.route('/api/analytics/get-recommendations')
def get_recommendations():
    """Obtenir des recommandations personnalisées"""
    recommendations = get_recommended_songs()
    
    return jsonify({
        'recommendations': [
            {
                'title': r['song']['title'],
                'artist': r['song']['artist'],
                'filename': r['song']['filename'],
                'rating': r['rating'],
                'play_count': r['stats']['play_count'],
                'completion_rate': r['stats']['average_completion']
            }
            for r in recommendations
        ],
        'adaptive_settings': user_analytics['adaptive_settings']
    })

@app.route('/api/analytics/reset', methods=['POST'])
def reset_analytics():
    """Réinitialiser les analytics"""
    global user_analytics
    user_analytics = {
        'songs': {},
        'listening_patterns': {
            'total_playtime': 0,
            'total_sessions': 0,
            'avg_session_duration': 0,
            'preferred_time_of_day': [],
            'skip_rate': 0,
            'completion_rate': 0
        },
        'preferences': {
            'favorite_songs': [],
            'disliked_songs': [],
            'most_played': [],
            'recently_skipped': []
        },
        'adaptive_settings': {
            'ui_complexity': 'standard',
            'recommendation_aggressiveness': 'medium',
            'auto_skip_enabled': False,
            'smart_shuffle_enabled': False
        }
    }
    save_analytics()
    return jsonify({'success': True})

@app.route('/api/play-pause', methods=['POST'])
def play_pause():
    global is_playing
    if playlist:
        is_playing = not is_playing
        increment_state_version()
        
        # Tracker pour le système d'attention
        if is_playing:
            attention_detector.track_interaction('play')
        else:
            attention_detector.track_interaction('pause')
    
    return jsonify({
        'is_playing': is_playing,
        'state_version': state_version
    })

@app.route('/api/play-index', methods=['POST'])
def play_index():
    global current_index, is_playing
    data = request.get_json()
    index = data.get('index', 0)
    
    if 0 <= index < len(playlist):
        current_index = index
        is_playing = True
        increment_state_version()
        
        # Tracker pour le système d'attention
        attention_detector.track_interaction('playlist', {'index': index})
        
        return jsonify({
            'song': playlist[current_index],
            'index': current_index,
            'is_playing': is_playing,
            'state_version': state_version
        })
    
    return jsonify({'error': 'Invalid index'}), 400

@app.route('/api/next', methods=['POST'])
def next_song():
    global current_index, is_playing
    if playlist:
        if shuffle_mode:
            import random
            new_index = random.randint(0, len(playlist) - 1)
            if len(playlist) > 1 and new_index == current_index:
                new_index = (new_index + 1) % len(playlist)
            current_index = new_index
        else:
            current_index = (current_index + 1) % len(playlist)
        
        increment_state_version()
        
        # Tracker pour le système d'attention
        attention_detector.track_interaction('skip')
        
        return jsonify({
            'song': playlist[current_index],
            'index': current_index,
            'is_playing': is_playing,
            'state_version': state_version
        })
    return jsonify({'error': 'No songs'}), 404

@app.route('/api/previous', methods=['POST'])
def previous_song():
    global current_index, is_playing
    if playlist:
        current_index = (current_index - 1) % len(playlist)
        increment_state_version()
        
        # Tracker pour le système d'attention
        attention_detector.track_interaction('seek')
        
        return jsonify({
            'song': playlist[current_index],
            'index': current_index,
            'is_playing': is_playing,
            'state_version': state_version
        })
    return jsonify({'error': 'No songs'}), 404

@app.route('/api/upload', methods=['POST'])
def upload_files():
    global playlist, current_index, is_playing
    
    if 'files' not in request.files:
        return jsonify({'error': 'No files'}), 400
    
    files = request.files.getlist('files')
    uploaded = []
    was_empty = len(playlist) == 0
    
    for file in files:
        if file and allowed_file(file.filename):
            filename = file.filename
            filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
            file.save(filepath)
            
            title, artist = extract_metadata(filepath, filename)
            
            song_data = {
                'title': title,
                'artist': artist,
                'filename': filename
            }
            playlist.append(song_data)
            uploaded.append(song_data)
    
    if was_empty and playlist:
        current_index = 0
        is_playing = False
        increment_state_version()
    
    return jsonify({
        'uploaded': uploaded,
        'total': len(playlist),
        'state_version': state_version
    })

@app.route('/api/playlist')
def get_playlist():
    return jsonify({
        'playlist': playlist,
        'current_index': current_index,
        'is_playing': is_playing
    })

@app.route('/api/clear', methods=['POST'])
def clear_playlist():
    global playlist, current_index, is_playing
    
    for song in playlist:
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], song['filename'])
        if os.path.exists(filepath):
            try:
                os.remove(filepath)
            except Exception as e:
                print(f"Erreur lors de la suppression de {filepath}: {e}")
    
    playlist = []
    current_index = 0
    is_playing = False
    increment_state_version()
    return jsonify({
        'success': True,
        'state_version': state_version
    })

@app.route('/api/reload-files', methods=['POST'])
def reload_files():
    load_existing_music_files()
    increment_state_version()
    return jsonify({
        'success': True,
        'total': len(playlist),
        'state_version': state_version
    })

@app.route('/music/<filename>')
def serve_music(filename):
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

@app.route('/api/toggle-shuffle', methods=['POST'])
def toggle_shuffle():
    global shuffle_mode
    shuffle_mode = not shuffle_mode
    return jsonify({
        'shuffle': shuffle_mode,
        'state_version': state_version
    })

@app.route('/api/toggle-repeat', methods=['POST'])
def toggle_repeat():
    global repeat_mode
    repeat_mode = not repeat_mode
    return jsonify({
        'repeat': repeat_mode,
        'state_version': state_version
    })

@app.route('/api/get-modes')
def get_modes():
    return jsonify({
        'shuffle': shuffle_mode,
        'repeat': repeat_mode
    })

@app.route('/api/multimodal/start', methods=['POST'])
def start_multimodal():
    """Démarrer capture multimodale"""
    multimodal_system.start()
    return jsonify({'success': True})

@app.route('/api/multimodal/stop', methods=['POST'])
def stop_multimodal():
    """Arrêter capture"""
    multimodal_system.stop()
    return jsonify({'success': True})

@socketio.on('video_frame')
def handle_video_frame(data):
    """Réception frame vidéo via WebSocket"""
    try:
        # Décoder base64 → numpy array
        img_data = base64.b64decode(data['frame'].split(',')[1])
        nparr = np.frombuffer(img_data, np.uint8)
        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        multimodal_system.add_video_frame(frame)
    except Exception as e:
        print(f"❌ Erreur frame: {e}")

@socketio.on('audio_chunk')
def handle_audio_chunk(data):
    """Réception chunk audio via WebSocket"""
    try:
        # Décoder base64 → numpy array
        audio_bytes = base64.b64decode(data['audio'])
        audio_array = np.frombuffer(audio_bytes, dtype=np.float32)
        
        multimodal_system.add_audio_chunk(audio_array)
    except Exception as e:
        print(f"❌ Erreur audio: {e}")

# Modifier run final
if __name__ == "__main__":
    print("🚀 Démarrage du serveur...")
    print("📦 Chargement des analytics...")
    load_analytics()
    print("🎵 Chargement des fichiers musique...")
    load_existing_music_files()
    print("✅ Serveur prêt sur http://localhost:5000")
    print("⏳ Attente de connexions...")
    socketio.run(app, debug=True, host='0.0.0.0', port=5000)
