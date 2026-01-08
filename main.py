from flask import Flask, render_template, jsonify
import os

app = Flask(__name__)

# Playlist de démonstration
playlist = [
    {"title": "Clair de Lune", "artist": "Claude Debussy"},
    {"title": "Gymnopédie No. 1", "artist": "Erik Satie"},
    {"title": "Nocturne Op. 9 No. 2", "artist": "Frédéric Chopin"},
    {"title": "Moonlight Sonata", "artist": "Ludwig van Beethoven"},
    {"title": "The Four Seasons", "artist": "Antonio Vivaldi"},
]

current_index = 0
is_playing = False

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/current')
def get_current():
    return jsonify({
        'song': playlist[current_index],
        'is_playing': is_playing,
        'index': current_index,
        'total': len(playlist)
    })

@app.route('/api/play-pause')
def play_pause():
    global is_playing
    is_playing = not is_playing
    return jsonify({'is_playing': is_playing})

@app.route('/api/next')
def next_song():
    global current_index
    current_index = (current_index + 1) % len(playlist)
    return jsonify({
        'song': playlist[current_index],
        'index': current_index
    })

@app.route('/api/previous')
def previous_song():
    global current_index
    current_index = (current_index - 1) % len(playlist)
    return jsonify({
        'song': playlist[current_index],
        'index': current_index
    })

if __name__ == "__main__":
    app.run(debug=True, host='0.0.0.0', port=5000)
