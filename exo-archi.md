# Architecture Complète - Lecteur Musical Intelligent

## 🎯 Vue d'ensemble

Application web de lecteur musical avec analyse multimodale en temps réel (vidéo + audio) pour détecter l'attention et l'engagement de l'utilisateur et adapter l'expérience d'écoute.

---

## 📐 Architecture Globale

```
┌──────────────────────────────────────────────────────────┐
│                     FRONTEND (HTML/JS)                    │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────┐ │
│  │  Lecteur    │  │   Caméra +   │  │    Widgets &    │ │
│  │   Audio     │  │   Micro      │  │    Analytics    │ │
│  │ (script.js) │  │ (WebSocket)  │  │  (widgets.js)   │ │
│  └──────┬──────┘  └───────┬──────┘  └────────┬────────┘ │
│         │                 │                   │           │
│         └─────────────────┼───────────────────┘           │
│                           │                               │
└───────────────────────────┼───────────────────────────────┘
                            │
                    WebSocket/HTTP
                            │
┌───────────────────────────┼───────────────────────────────┐
│                   BACKEND (Flask/Python)                   │
│                                                            │
│  ┌───────────────────────────────────────────────────┐   │
│  │              main.py (Serveur Flask)               │   │
│  │  - Routes API REST                                 │   │
│  │  - WebSocket (Flask-SocketIO)                      │   │
│  │  - Gestion playlist                                │   │
│  │  - Analytics utilisateur                           │   │
│  └───────────┬──────────────┬──────────────┬──────────┘   │
│              │              │              │               │
│    ┌─────────▼────────┐    │    ┌─────────▼──────────┐   │
│    │ AttentionDetector│    │    │ MultimodalSystem   │   │
│    │ (attention_      │◄───┼────┤ (multimodal_       │   │
│    │  system.py)      │    │    │  system.py)        │   │
│    │                  │    │    │                    │   │
│    │ - Score attention│    │    │ ┌───────────────┐  │   │
│    │ - Adaptations    │    │    │ │VideoAnalyzer  │  │   │
│    │ - Règles métier  │    │    │ │ (OpenCV +     │  │   │
│    └──────────────────┘    │    │ │  Haar Cascade)│  │   │
│                            │    │ └───────────────┘  │   │
│                            │    │ ┌───────────────┐  │   │
│                            │    │ │AudioAnalyzer  │  │   │
│                            │    │ │ (NumPy +      │  │   │
│                            │    │ │  Librosa opt.)│  │   │
│                            │    │ └───────────────┘  │   │
│                            │    │ ┌───────────────┐  │   │
│                            │    │ │EmotionFusion  │  │   │
│                            │    │ │ (Fusion des   │  │   │
│                            │    │ │  signaux A/V) │  │   │
│                            │    │ └───────────────┘  │   │
│                            │    └────────────────────┘   │
│                            │                             │
│                    ┌───────▼────────┐                    │
│                    │  user_analytics│                    │
│                    │      .json      │                    │
│                    └─────────────────┘                    │
└────────────────────────────────────────────────────────────┘
```

---

## 🏗️ Architecture par Couches

### 1️⃣ **COUCHE PRÉSENTATION (Frontend)**

#### **A. Interface Utilisateur (HTML/CSS)**
- **Fichier principal**: `templates/index.html`
- **Structure**:
  - Logo (haut gauche)
  - Lecteur audio central
  - Widgets latéraux (caméra, analyses, chansons validées)
  - Sélecteur de thèmes

#### **B. Styles**
- `style.css` : Styles principaux, layout grid
- `themes.css` : Thèmes dynamiques (neutral, energy, calm, focus, etc.)
- `theme-selector.css` : Sélecteur de thèmes
- `widget.css` : Styles des widgets
- `analytics.css` : Styles des analytics
- `attention-adapter.css` : Indicateurs visuels d'attention

#### **C. Scripts JavaScript**

**Script principal** (`script.js`) :
```javascript
- Contrôle lecteur audio (play/pause/next/prev)
- Gestion playlist locale
- Communication HTTP avec backend
- Mise à jour UI en temps réel
- Gestion événements utilisateur
```

**Theme Engine** (`theme-engine.js`) :
```javascript
- Application dynamique des thèmes
- Transitions fluides entre ambiances
- Adaptation selon émotions détectées
```

**Widgets Manager** (`widgets.js`) :
```javascript
- Gestion des widgets modulaires
- Panneaux d'information
- Contrôles rapides (shuffle, repeat)
- Tooltips et effets visuels
```

**Attention Adapter** (`attention-adapter.js`) :
```javascript
- Monitoring de l'attention utilisateur côté client
- Détection d'inactivité
- Tracking visibilité onglet (Page Visibility API)
- Adaptations UI selon niveau d'attention
- Communication avec AttentionDetector backend
```

**Analytics** (`analytics.js`) :
```javascript
- Affichage des métriques utilisateur
- Graphiques d'engagement
- Historique des interactions
```

**Multimodal Capture** (`multimodal-capture.js`) :
```javascript
- Capture webcam (MediaStream API)
- Capture microphone
- Envoi frames vidéo via WebSocket
- Envoi chunks audio via WebSocket
- Throttling pour optimiser la bande passante
```

---

### 2️⃣ **COUCHE COMMUNICATION (WebSocket + REST)**

#### **WebSocket Events** (via Flask-SocketIO)

**Client → Serveur** :
- `video_frame` : Frame webcam (base64)
- `audio_chunk` : Chunk audio microphone
- `track_interaction` : Interactions utilisateur (play, pause, skip, volume)

**Serveur → Client** :
- `attention_update` : Mise à jour score d'attention
- `theme_change` : Changement de thème suggéré
- `analysis_update` : Données d'analyse multimodale

#### **API REST** (Flask routes)

```python
GET  /                      # Page principale
GET  /api/playlist          # Récupérer la playlist
POST /api/upload            # Upload fichiers audio
POST /api/play/:index       # Jouer une chanson
POST /api/pause             # Mettre en pause
POST /api/next              # Chanson suivante
POST /api/previous          # Chanson précédente
POST /api/volume            # Changer volume
POST /api/shuffle           # Toggle shuffle mode
POST /api/repeat            # Toggle repeat mode
GET  /api/get-modes         # Récupérer modes shuffle/repeat
GET  /api/analytics         # Récupérer analytics utilisateur
GET  /api/attention/state   # État du système d'attention
POST /api/attention/track   # Enregistrer interaction
```

---

### 3️⃣ **COUCHE MÉTIER (Backend Python)**

#### **A. Serveur Principal** (`main.py`)

**Responsabilités** :
- Serveur Flask + SocketIO
- Gestion des routes API REST
- Gestion de la playlist (liste, upload, ordre)
- Extraction métadonnées audio (Mutagen)
- Orchestration des systèmes d'attention et multimodal
- Persistance analytics (`user_analytics.json`)
- Auto-skip basé sur l'attention

**Variables globales** :
```python
playlist = []                    # Liste des chansons
current_index = 0                # Index chanson actuelle
is_playing = False               # État lecture
shuffle_mode, repeat_mode        # Modes lecture
attention_detector               # Instance AttentionDetector
multimodal_system                # Instance MultimodalSystem
user_analytics                   # Dict analytics utilisateur
```

**Mécanisme d'auto-skip** :
```python
- Vérification périodique du score d'attention
- Si score < MIN_ATTENTION_THRESHOLD (65) pendant X secondes
- Skip automatique vers chanson suivante
- Cooldown entre skips (10 secondes)
```

#### **B. Système d'Attention** (`attention_system.py`)

**Classe** : `AttentionDetector`

**Objectif** : Estimer le niveau d'attention de l'utilisateur sans IA, par règles comportementales.

**États d'attention** :
- `attentif` (100-80%)
- `semi-attentif` (79-60%)
- `peu-attentif` (59-40%)
- `pas-attentif` (<40%)

**Signaux analysés** :
```python
WEIGHTS = {
    'time_since_interaction': 40%,  # Temps sans interaction
    'skip_rate': 25%,               # Fréquence de skips
    'manual_adjustments': 15%,      # Ajustements manuels (volume, seek)
    'pause_frequency': 10%,         # Pauses/reprises
    'tab_switches': 10%,            # Changements d'onglet
}
```

**Seuils de temps** :
```python
interaction_timeout: 3s      # Temps avant décrément score
semi_attentive: 8s           # Passage semi-attentif
low_attention: 15s           # Passage peu-attentif
no_attention: 30s            # Passage pas-attentif
skip_burst_window: 20s       # Fenêtre détection skips rapides
```

**Méthodes principales** :
```python
track_interaction(type, data)  # Enregistrer interaction
update_attention_level()       # Recalculer score attention
apply_adaptation()             # Appliquer adaptations
get_state()                    # État actuel
```

**Adaptations** :
- Ajustement volume automatique
- Suggestions de changement de playlist/style
- Modification intensité UI
- Skip automatique si désengagement prolongé

#### **C. Système Multimodal** (`multimodal_system.py`)

**Classe** : `MultimodalSystem`

**Objectif** : Fusionner analyses vidéo et audio pour enrichir le score d'attention.

**Architecture multi-thread** :
```python
Thread 1: VideoAnalyzer      # Analyse frames webcam
Thread 2: AudioAnalyzer       # Analyse audio microphone
Thread 3: EmotionFusion       # Fusion des deux
```

**Queues de traitement** :
```python
video_queue = Queue(maxsize=10)
audio_queue = Queue(maxsize=10)
```

**Flux de données** :
```
WebSocket → add_video_frame() → video_queue → VideoAnalyzer
WebSocket → add_audio_chunk() → audio_queue → AudioAnalyzer
                                     ↓
                               EmotionFusion
                                     ↓
                          AttentionDetector.update()
```

---

### 4️⃣ **COUCHE ANALYSE (Analyzers)**

#### **A. Video Analyzer** (`analyzers/video_analyzer.py`)

**Technologies** : OpenCV + Haar Cascades

**Analyses** :
1. **Détection visage** :
   - Haar Cascade frontal + profile
   - Validation par stabilité (historique frames)

2. **Pose de la tête** (Head Pose Estimation) :
   ```python
   yaw   # Rotation gauche/droite (-90° à +90°)
   pitch # Inclinaison haut/bas (-90° à +90°)
   roll  # Rotation tête sur épaule
   ```
   - Calcul via position relative du visage
   - Lissage exponentiel (smoothing_factor=0.15)

3. **Expression faciale** :
   - Détection yeux (Haar Cascade)
   - Détection sourire (Haar Cascade)
   - Estimation émotion : `happy`, `neutral`, `sad`, `surprised`
   - Confidence score

4. **Score d'engagement** :
   ```python
   Facteurs:
   - Position tête (centré = mieux)
   - Orientation (face caméra = mieux)
   - Expression (sourire = bonus)
   - Présence visage (absent = 0)
   ```

**Output** :
```python
{
    'face_detected': bool,
    'head_pose': {'pitch': float, 'yaw': float, 'roll': float},
    'engagement_score': int (0-100),
    'emotion_hint': str,
    'facial_expression': {
        'emotion': str,
        'confidence': float
    }
}
```

#### **B. Audio Analyzer** (`analyzers/audio_analyzer.py`)

**Technologies** : NumPy + Librosa (optionnel)

**Analyses** :
1. **Niveau d'énergie** (RMS - Root Mean Square) :
   ```python
   rms = sqrt(mean(audio_chunk^2))
   energy_level = min(100, int(rms * 1000))
   ```

2. **Détection de parole** :
   - Seuil d'énergie : 0.06
   - `speech_detected = True` si énergie > seuil

3. **Pitch estimation** (fréquence vocale) :
   - Zero-crossing rate
   - Estimation fréquence fondamentale

4. **Émotion vocale** (si Librosa disponible) :
   - Analyse spectrale
   - Classification émotion : `neutral`, `happy`, `sad`, `angry`

**Output** :
```python
{
    'speech_detected': bool,
    'energy_level': int (0-100),
    'pitch': float,
    'emotion_hint': str
}
```

#### **C. Emotion Fusion** (`analyzers/emotion_fusion.py`)

**Classe** : `EmotionFusion`

**Objectif** : Fusionner signaux vidéo + audio pour score unifié.

**Méthode** : `fuse_signals(video_state, audio_state)`

**Étapes** :
1. **Calcul score d'attention combiné** :
   ```python
   video_weight = 0.6
   audio_weight = 0.4
   attention_score = (video.engagement * 0.6) + (audio.energy * 0.4)
   ```

2. **Détermination émotion dominante** :
   - Priorité : Expression faciale
   - Fallback : Émotion vocale
   - Historique pour stabilité

3. **Détection de patterns** :
   ```python
   'engaged'      # Visage + parole actifs
   'passive'      # Visage présent, pas de parole
   'listening'    # Écoute passive
   'absent'       # Rien détecté
   'distracted'   # Mouvements erratiques
   ```

4. **Indicateurs persistants** :
   ```python
   movement_detected_once  # True si mouvement détecté au moins 1 fois
   speech_detected_once    # True si parole détectée au moins 1 fois
   both_active             # True si les deux
   ```

**Output** :
```python
{
    'attention_score': int (0-100),
    'emotion': str,
    'pattern': str,
    'movement_detected': bool,
    'speech_detected': bool,
    'both_active': bool,
    'video': dict,
    'audio': dict
}
```

---

### 5️⃣ **COUCHE DONNÉES**

#### **A. Fichiers audio** (`music_files/`)
- Stockage des fichiers audio uploadés
- Formats supportés : MP3, WAV, OGG, M4A, FLAC

#### **B. Analytics utilisateur** (`user_analytics.json`)

**Structure** :
```json
{
  "songs": {
    "song_id": {
      "title": str,
      "artist": str,
      "duration": float,
      "play_count": int,
      "skip_count": int,
      "completion_rate": float,
      "avg_volume": float,
      "last_played": timestamp,
      "total_listen_time": float,
      "attention_scores": [int],
      "avg_attention": float
    }
  },
  "listening_patterns": {
    "total_playtime": float,
    "total_sessions": int,
    "avg_session_duration": float,
    "skip_rate": float,
    "completion_rate": float
  },
  "preferences": {
    "favorite_songs": [str],
    "disliked_songs": [str],
    "most_played": [str]
  },
  "adaptive_settings": {
    "ui_complexity": str,
    "auto_skip_enabled": bool,
    "smart_shuffle_enabled": bool
  }
}
```

---

## 🔄 Flux de Données Complets

### **Flux 1 : Lecture Audio**

```
1. User clique Play
   ↓
2. script.js → POST /api/play/:index
   ↓
3. main.py met à jour current_index, is_playing=True
   ↓
4. Retour données chanson (titre, artiste, URL)
   ↓
5. script.js charge audioElement.src et play()
   ↓
6. main.py track interaction 'play' → AttentionDetector
   ↓
7. AttentionDetector met à jour score d'attention
   ↓
8. Analytics mises à jour (play_count++, last_played, etc.)
```

### **Flux 2 : Analyse Multimodale Temps Réel**

```
1. User active caméra/micro (toggle)
   ↓
2. multimodal-capture.js démarre MediaStream
   ↓
3. Capture frames à 2 FPS via canvas
   ↓
4. Conversion base64 → emit('video_frame')
   ↓
5. main.py @socketio.on('video_frame')
   ↓
6. multimodal_system.add_video_frame(frame)
   ↓
7. VideoAnalyzer.analyze_frame() [Thread 1]
   │ - Détection visage (Haar)
   │ - Estimation pose tête
   │ - Analyse expression
   │ - Calcul engagement_score
   ↓
8. AudioAnalyzer.analyze_audio() [Thread 2]
   │ - Calcul énergie (RMS)
   │ - Détection parole
   │ - Estimation pitch
   ↓
9. EmotionFusion.fuse_signals() [Thread 3]
   │ - Fusion des signaux
   │ - Calcul attention_score unifié
   │ - Détection patterns
   ↓
10. AttentionDetector.update() (injection score multimodal)
   ↓
11. emit('attention_update', state) → Client
   ↓
12. attention-adapter.js met à jour UI
    - Indicateur visuel attention
    - Adaptation volume si nécessaire
    - Suggestion changement thème
```

### **Flux 3 : Auto-Skip Intelligent**

```
1. AttentionDetector calcule score en continu
   ↓
2. Si score < 65 pendant X secondes
   ↓
3. main.py déclenche auto-skip
   ↓
4. POST /api/next (serveur lui-même)
   ↓
5. Passage à chanson suivante
   ↓
6. Notification UI "Changé automatiquement (faible engagement)"
   ↓
7. Cooldown 10 secondes avant prochain auto-skip
   ↓
8. Analytics : skip_count++, reason='low_attention'
```

### **Flux 4 : Adaptation Thème**

```
1. EmotionFusion détecte émotion dominante
   ↓
2. emit('theme_change', {emotion: 'happy'})
   ↓
3. theme-engine.js reçoit suggestion
   ↓
4. Si variations automatiques activées
   ↓
5. Application thème correspondant
   - happy → theme-energy
   - calm → theme-calm
   - sad → theme-sunset
   ↓
6. Transitions CSS fluides (0.5s)
```

---

## 🧩 Technologies Utilisées

### **Backend**
- **Flask** : Framework web Python
- **Flask-SocketIO** : Communication temps réel (WebSocket)
- **Mutagen** : Extraction métadonnées audio (MP3, ID3)
- **OpenCV** : Traitement d'image, détection visages
- **NumPy** : Calculs numériques (audio, vidéo)
- **Librosa** (optionnel) : Analyse audio avancée

### **Frontend**
- **Vanilla JavaScript** : Pas de framework lourd
- **Socket.IO Client** : WebSocket côté client
- **HTML5 Audio API** : Lecteur audio natif
- **MediaStream API** : Capture webcam/micro
- **Page Visibility API** : Détection onglet actif/inactif
- **Canvas API** : Traitement frames vidéo

### **Analyse Vidéo**
- **Haar Cascades** (OpenCV) :
  - `haarcascade_frontalface_default.xml`
  - `haarcascade_profileface.xml`
  - `haarcascade_eye.xml`
  - `haarcascade_smile.xml`

---

## 🎨 Système de Thèmes

**Thèmes disponibles** :
- `neutral` : Neutre, gris bleuté
- `energy` : Énergique, orange vif
- `calm` : Calme, bleu doux
- `focus` : Focus, violet profond
- `sunset` : Coucher de soleil, rose/orange
- `midnight` : Minuit, bleu sombre
- `sunsetDark` : Sombre chaleureux, marron/orange
- `aurora` : Aurore, vert/bleu
- `lavender` : Lavande, violet clair
- `ocean` : Océan, bleu turquoise
- `fire` : Feu, rouge/orange

**Variables CSS dynamiques** :
```css
--bg-primary, --bg-secondary
--text-primary, --text-secondary
--accent-color, --accent-glow
--card-bg, --border-color
--shadow-color
```

**Transitions** : 0.5s ease

---

## 📊 Analytics & Adaptations

### **Métriques Suivies**
1. **Par chanson** :
   - Nombre d'écoutes
   - Taux de complétion
   - Skips
   - Volume moyen
   - Scores d'attention

2. **Globales** :
   - Temps d'écoute total
   - Nombre de sessions
   - Durée moyenne session
   - Taux de skip global
   - Patterns temporels (heures d'écoute préférées)

### **Adaptations Automatiques**
1. **Volume** : Baisse progressive si désengagement
2. **Skip automatique** : Si attention < 65 pendant X temps
3. **Suggestions playlist** : Basées sur historique
4. **Thème** : Adapté à l'émotion détectée
5. **UI** : Complexité ajustée au niveau d'engagement

---

## 🚀 Démarrage & Configuration

### **Installation**
```bash
pip install -r requirements.txt
```

### **Dépendances principales**
```
Flask
Flask-SocketIO
mutagen
opencv-python
numpy
librosa (optionnel)
python-socketio
```

### **Lancement**
```bash
python main.py
```

Serveur démarre sur `http://127.0.0.1:5000`

---

## 🔐 Sécurité & Performance

### **Sécurité**
- CORS activé pour WebSocket
- Taille max upload : 50 MB
- Validation types fichiers
- Pas de stockage serveur permanent (sauf analytics)

### **Performance**
- Throttling capture vidéo : 2 FPS
- Throttling capture audio : chunks 1024 samples
- Queue max size : 10 items (évite surcharge mémoire)
- Multi-threading pour analyses (non-bloquant)
- Lissage exponentiel (évite valeurs erratiques)
- Skip frame si analyse trop lente

### **Optimisations**
- Préchargement audio (`preload='auto'`)
- Canvas offscreen pour traitement vidéo
- Historiques limités (max 10 items)
- Cooldowns sur actions fréquentes (auto-skip)

---

## 🎯 Points Forts de l'Architecture

1. **Séparation des préoccupations** :
   - Frontend/Backend bien séparés
   - Analyseurs modulaires indépendants
   - Système d'attention découplé du multimodal

2. **Extensibilité** :
   - Ajout facile de nouveaux analyseurs
   - Nouveaux patterns d'engagement
   - Nouveaux thèmes

3. **Temps réel** :
   - WebSocket pour communication bidirectionnelle
   - Multi-threading pour analyses parallèles
   - Mise à jour UI instantanée

4. **Résilience** :
   - Fallbacks si librosa absent
   - Gestion erreurs capture webcam/micro
   - Mode dégradé si analyses échouent

5. **Adaptabilité** :
   - Règles métier modifiables facilement
   - Seuils configurables
   - Modes d'adaptation désactivables

---

## 📝 Améliorations Futures Possibles

1. **IA/ML** :
   - Modèles deep learning pour émotions (FER+, AffectNet)
   - Reconnaissance parole (Speech-to-Text)
   - Prédiction préférences musicales

2. **Fonctionnalités** :
   - Playlists intelligentes
   - Recommandations collaboratives
   - Mode multi-utilisateurs
   - Synchronisation multi-devices

3. **Analyses** :
   - Détection fatigue (bâillements, clignements)
   - Tracking regard (eye gaze)
   - Analyse posture corporelle (pose estimation)
   - Biométrie (heart rate via webcam)

4. **Performance** :
   - WebAssembly pour analyses côté client
   - Web Workers pour traitement parallèle
   - GPU acceleration (WebGL)

---

## 📚 Références

- **OpenCV Haar Cascades** : https://docs.opencv.org/3.4/db/d28/tutorial_cascade_classifier.html
- **Flask-SocketIO** : https://flask-socketio.readthedocs.io/
- **MediaStream API** : https://developer.mozilla.org/en-US/docs/Web/API/MediaStream_API
- **Page Visibility API** : https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API
- **Mutagen** : https://mutagen.readthedocs.io/

---

**Version** : 1.0  
**Date** : Janvier 2026  
**Auteur** : Regis
