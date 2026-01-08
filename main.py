from flask import Flask, render_template, jsonify, request, send_from_directory
import os
from pathlib import Path
from mutagen import File as MutagenFile
from mutagen.mp3 import MP3
from mutagen.id3 import ID3
import traceback

app = Flask(__name__)

# Configuration
UPLOAD_FOLDER = 'music_files'
ALLOWED_EXTENSIONS = {'mp3', 'wav', 'ogg', 'm4a', 'flac'}

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
            # Essayer d'extraire le titre et l'artiste des tags
            title = None
            artist = None
            
            if hasattr(audio, 'tags') and audio.tags:
                # MP3 avec tags ID3
                if 'TIT2' in audio.tags:
                    title = str(audio.tags['TIT2'])
                if 'TPE1' in audio.tags:
                    artist = str(audio.tags['TPE1'])
                    
                # Tags génériques
                if not title and 'title' in audio.tags:
                    title = str(audio.tags['title'][0]) if isinstance(audio.tags['title'], list) else str(audio.tags['title'])
                if not artist and 'artist' in audio.tags:
                    artist = str(audio.tags['artist'][0]) if isinstance(audio.tags['artist'], list) else str(audio.tags['artist'])
            
            if title and artist:
                return title.strip(), artist.strip()
    except Exception as e:
        print(f"Erreur lors de l'extraction des métadonnées de {filename}: {e}")
    
    # Fallback : extraire du nom de fichier
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

@app.route('/api/play-pause', methods=['POST'])
def play_pause():
    global is_playing
    if playlist:
        is_playing = not is_playing
        increment_state_version()
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
            # Mode aléatoire
            import random
            new_index = random.randint(0, len(playlist) - 1)
            # Éviter de rejouer la même chanson
            if len(playlist) > 1 and new_index == current_index:
                new_index = (new_index + 1) % len(playlist)
            current_index = new_index
        else:
            # Mode normal
            current_index = (current_index + 1) % len(playlist)
        
        increment_state_version()
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
            
            # Extraire les métadonnées
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
    
    # Supprimer les fichiers physiques
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
    """Recharger les fichiers depuis le dossier music_files"""
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

# Routes pour shuffle et repeat
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

if __name__ == "__main__":
    # Charger les fichiers existants au démarrage
    load_existing_music_files()
    app.run(debug=True, host='0.0.0.0', port=5000)
