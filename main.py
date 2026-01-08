from flask import Flask, render_template, jsonify, request, send_from_directory
import os
from pathlib import Path

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

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/current')
def get_current():
    if not playlist:
        return jsonify({
            'song': {'title': 'Aucune musique', 'artist': 'Ajoutez des fichiers'},
            'is_playing': False,
            'index': 0,
            'total': 0
        })
    
    return jsonify({
        'song': playlist[current_index],
        'is_playing': is_playing,
        'index': current_index,
        'total': len(playlist)
    })

@app.route('/api/play-pause')
def play_pause():
    global is_playing
    if playlist:
        is_playing = not is_playing
    return jsonify({'is_playing': is_playing})

@app.route('/api/next')
def next_song():
    global current_index
    if playlist:
        current_index = (current_index + 1) % len(playlist)
        return jsonify({
            'song': playlist[current_index],
            'index': current_index
        })
    return jsonify({'error': 'No songs'})

@app.route('/api/previous')
def previous_song():
    global current_index
    if playlist:
        current_index = (current_index - 1) % len(playlist)
        return jsonify({
            'song': playlist[current_index],
            'index': current_index
        })
    return jsonify({'error': 'No songs'})

@app.route('/api/upload', methods=['POST'])
def upload_files():
    global playlist, current_index
    
    if 'files' not in request.files:
        return jsonify({'error': 'No files'}), 400
    
    files = request.files.getlist('files')
    uploaded = []
    
    for file in files:
        if file and allowed_file(file.filename):
            filename = file.filename
            filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
            file.save(filepath)
            
            # Extraire le titre et l'artiste du nom du fichier
            name_without_ext = os.path.splitext(filename)[0]
            if ' - ' in name_without_ext:
                artist, title = name_without_ext.split(' - ', 1)
            else:
                title = name_without_ext
                artist = 'Artiste inconnu'
            
            song_data = {
                'title': title.strip(),
                'artist': artist.strip(),
                'filename': filename
            }
            playlist.append(song_data)
            uploaded.append(song_data)
    
    if not current_index and playlist:
        current_index = 0
    
    return jsonify({
        'uploaded': uploaded,
        'total': len(playlist)
    })

@app.route('/api/playlist')
def get_playlist():
    return jsonify({'playlist': playlist})

@app.route('/api/clear')
def clear_playlist():
    global playlist, current_index, is_playing
    playlist = []
    current_index = 0
    is_playing = False
    return jsonify({'success': True})

@app.route('/music/<filename>')
def serve_music(filename):
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

if __name__ == "__main__":
    app.run(debug=True, host='0.0.0.0', port=5000)
