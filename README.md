# Lecteur Musical Intelligent

Application web de lecteur musical avec analyse multimodale en temps réel (vidéo + audio) pour détecter l'attention et l'engagement de l'utilisateur et adapter l'expérience d'écoute.

![Version](https://img.shields.io/badge/version-1.0-blue.svg)
![Python](https://img.shields.io/badge/python-3.12+-green.svg)
![Flask](https://img.shields.io/badge/flask-3.1.2-lightgrey.svg)

## 🎯 Fonctionnalités

### Lecture musicale
- 🎵 Support multi-formats (MP3, WAV, OGG, M4A, FLAC)
- ⏯️ Contrôles standards (play/pause, suivant/précédent, volume)
- 🔀 Modes shuffle et repeat
- 📋 Gestion de playlist dynamique avec upload de fichiers

### Intelligence artificielle multimodale
- 📹 **Analyse vidéo en temps réel** via webcam
  - Détection de visage (OpenCV + Haar Cascades)
  - Estimation de la pose de la tête (yaw, pitch, roll)
  - Reconnaissance d'expressions faciales
  - Calcul du score d'engagement (0-100)

- 🎤 **Analyse audio vocale** via microphone
  - Détection de parole
  - Mesure du niveau d'énergie
  - Estimation du pitch
  - Classification d'émotion vocale

- 🧠 **Fusion multimodale**
  - Score d'attention unifié (60% vidéo + 40% audio)
  - Détection de patterns comportementaux
  - Émotion dominante

### Adaptations intelligentes
- 🎚️ Ajustement automatique du volume selon l'engagement
- ⏭️ Auto-skip si attention faible prolongée
- 🎨 Changement de thème selon l'émotion détectée
- 💡 Recommandations basées sur l'historique d'écoute

### Analytics comportementales
- 📊 Suivi des écoutes (complètes, skips, pauses)
- ⭐ Calcul de ratings automatiques par chanson
- 📈 Analyse des patterns d'écoute
- 🎯 Insights personnalisés

## 🏗️ Architecture

```
┌──────────────────────────────────────────────────────────┐
│                     FRONTEND (HTML/JS)                    │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────┐ │
│  │  Lecteur    │  │   Caméra +   │  │    Widgets &    │ │
│  │   Audio     │  │   Micro      │  │    Analytics    │ │
│  │ (script.js) │  │ (WebSocket)  │  │  (widgets.js)   │ │
│  └──────┬──────┘  └───────┬──────┘  └────────┬────────┘ │
└─────────┼─────────────────┼───────────────────┼──────────┘
          │                 │                   │
          │     WebSocket + HTTP REST API       │
          │                 │                   │
┌─────────┼─────────────────┼───────────────────┼──────────┐
│         │        BACKEND (Flask/Python)       │          │
│  ┌──────▼──────┐    ┌─────▼─────────┐    ┌───▼────────┐ │
│  │   main.py   │◄───┤ MultimodalSys │◄───┤ Attention  │ │
│  │  (Serveur)  │    │  (Analyses)   │    │  Detector  │ │
│  └─────────────┘    └───────────────┘    └────────────┘ │
│                            │                             │
│              ┌─────────────┼─────────────┐               │
│              │                           │               │
│     ┌────────▼─────────┐    ┌───────────▼─────────┐     │
│     │ VideoAnalyzer    │    │ AudioAnalyzer       │     │
│     │ (OpenCV +        │    │ (NumPy)             │     │
│     │  Haar Cascades)  │    │                     │     │
│     └──────────────────┘    └─────────────────────┘     │
└──────────────────────────────────────────────────────────┘
```

### Stack technique

#### Backend
- **Flask** : Framework web Python
- **Flask-SocketIO** : Communication temps réel bidirectionnelle
- **OpenCV** : Traitement vidéo et détection faciale
- **NumPy** : Calculs numériques
- **Mutagen** : Extraction métadonnées audio

#### Frontend
- **HTML5/CSS3** : Structure et présentation
- **JavaScript ES6+** : Logique interactive
- **Socket.IO Client** : Communication WebSocket
- **Web APIs** : MediaDevices (webcam/micro), AudioContext

## 🚀 Installation

### Prérequis
- Python 3.12+
- Webcam (optionnel, pour analyses vidéo)
- Microphone (optionnel, pour analyses audio)

### Installation des dépendances

```bash
# Cloner le dépôt
git clone <repository-url>
cd assignement

# Installer les dépendances
pip install -r requirements.txt
```

### Dépendances principales
```
Flask==3.1.2
Flask-SocketIO==5.3.0
opencv-python==4.9.0
numpy>=1.24.0,<2.0.0
mutagen==1.47.0
python-socketio==5.11.0
librosa==0.10.2 (optionnel)
```

## 🎮 Utilisation

### Démarrage du serveur

```bash
python main.py
```

Le serveur démarre sur `http://127.0.0.1:5000`

### Interface utilisateur

1. **Ajouter des musiques**
   - Cliquez sur "+ Ajouter" pour uploader des fichiers
   - Ou placez vos fichiers dans le dossier `music_files/`

2. **Lecture**
   - Utilisez les contrôles play/pause, suivant/précédent
   - Ajustez le volume avec le slider
   - Activez shuffle/repeat selon vos préférences

3. **Analyses IA (optionnel)**
   - Activez le toggle "Caméra & Intelligence"
   - Autorisez l'accès à la webcam/micro dans votre navigateur
   - Les analyses démarrent automatiquement

4. **Thèmes**
   - Cliquez sur l'icône soleil pour ouvrir le sélecteur de thèmes
   - 11 thèmes disponibles (neutral, energy, calm, focus, etc.)
   - Changement automatique possible selon l'émotion détectée

5. **Analytics**
   - Consultez les métriques en temps réel dans les widgets latéraux
   - Score d'attention (0-100)
   - Position de la tête, émotions détectées
   - Historique des chansons écoutées

## 📊 Flux de données

### 1. Lecture audio
```
User → Play → Backend → Retour métadonnées → Frontend → Lecture audio
```

### 2. Analyse multimodale temps réel
```
Webcam/Micro → Frontend (capture) → WebSocket → Backend
  ↓
VideoAnalyzer (visage, pose, émotion)
AudioAnalyzer (énergie, pitch, parole)
  ↓
EmotionFusion (score attention unifié)
  ↓
AttentionDetector (adaptations)
  ↓
WebSocket → Frontend (mise à jour UI)
```

### 3. Auto-skip intelligent
```
Score < 65 pendant X secondes → Backend déclenche skip auto
→ Notification UI → Passage chanson suivante
```

## 🎨 Système de thèmes

11 thèmes disponibles :
- `neutral` : Neutre, gris bleuté
- `energy` : Énergique, orange vif
- `calm` : Calme, bleu doux
- `focus` : Focus, violet profond
- `sunset` : Coucher de soleil, rose/orange
- `midnight` : Minuit, bleu sombre
- `sunsetDark` : Sombre chaleureux
- `aurora` : Aurore, vert/bleu
- `lavender` : Lavande, violet clair
- `ocean` : Océan, bleu turquoise
- `fire` : Feu, rouge/orange

Variables CSS dynamiques :
```css
--bg-primary, --bg-secondary
--text-primary, --text-secondary
--accent-color, --accent-glow
--card-bg, --border-color
```

## 🔐 Sécurité & Performance

### Sécurité
- CORS activé pour WebSocket
- Taille max upload : 50 MB
- Validation types fichiers
- Pas de stockage serveur permanent (sauf analytics)

### Performance
- Throttling capture vidéo : 2 FPS
- Throttling capture audio : chunks 1024 samples
- Queue max size : 10 items
- Multi-threading pour analyses (non-bloquant)
- Lissage exponentiel (évite valeurs erratiques)

## 📁 Structure du projet

```
assignement/
├── main.py                      # Point d'entrée Flask + Socket.IO
├── attention_system.py          # Système de détection attention
├── multimodal_system.py         # Orchestration analyses IA
├── analyzers/
│   ├── video_analyzer.py        # Analyse faciale OpenCV
│   ├── audio_analyzer.py        # Analyse vocale
│   └── emotion_fusion.py        # Fusion multimodale
├── templates/
│   ├── index.html               # Interface principale
│   └── test_analyzers.html      # Page de test analyseurs
├── static/
│   ├── script.js                # Logique frontend principale
│   ├── style.css                # Styles principaux
│   ├── theme-engine.js          # Gestion thèmes
│   ├── widgets.js               # Composants UI
│   ├── analytics.js             # Analytics frontend
│   ├── attention-adapter.js     # Adaptations UI
│   ├── multimodal-capture.js    # Capture webcam/micro
│   └── test-analyzers.js        # Tests analyseurs
├── music_files/                 # Dossier musiques
├── user_analytics.json          # Analytics utilisateur
├── requirements.txt             # Dépendances Python
└── README.md                    # Ce fichier
```

## 🧪 Page de test

Une page de test dédiée est disponible sur `/test-analyzers` pour visualiser en détail les analyses :
- Affichage en temps réel des résultats vidéo/audio
- Tracking visuel de la tête
- Scores d'émotions détaillés
- Logs des événements
- Métriques de performance

## 🔧 Configuration

### Variables d'environnement (.env)
```env
FLASK_ENV=development
SECRET_KEY=your_secret_key_here
```

### Seuils configurables (attention_system.py)
```python
AUTO_SKIP_COOLDOWN = 10          # Cooldown auto-skip (secondes)
MIN_ATTENTION_THRESHOLD = 65     # Seuil d'engagement minimum
```

## 📝 Améliorations futures possibles

1. **IA/ML**
   - Modèles deep learning pour émotions (FER+, AffectNet)
   - Reconnaissance parole (Speech-to-Text)
   - Prédiction préférences musicales

2. **Fonctionnalités**
   - Playlists intelligentes
   - Recommandations collaboratives
   - Mode multi-utilisateurs
   - Synchronisation multi-devices

3. **Analyses**
   - Détection fatigue (bâillements, clignements)
   - Tracking regard (eye gaze)
   - Analyse posture corporelle
   - Biométrie (heart rate via webcam)

4. **Performance**
   - WebAssembly pour analyses côté client
   - Web Workers pour traitement parallèle
   - GPU acceleration (WebGL)

## 📚 Documentation complète

Pour plus de détails sur l'architecture :
- [`architecture.md`](architecture.md) : Vue d'ensemble de l'architecture
- [`exo-archi.md`](exo-archi.md) : Architecture détaillée par couches

## 🐛 Dépannage

### La webcam ne fonctionne pas
- Vérifiez les permissions du navigateur
- Utilisez HTTPS ou localhost
- Vérifiez qu'aucune autre application n'utilise la webcam

### Les analyses sont lentes
- Réduisez le taux de capture vidéo dans [`multimodal-capture.js`](static/multimodal-capture.js)
- Fermez d'autres applications gourmandes en ressources

### Les fichiers audio ne se chargent pas
- Vérifiez les formats supportés (MP3, WAV, OGG, M4A, FLAC)
- Vérifiez la taille des fichiers (max 50 MB)

## 🤝 Contributions

Les contributions sont les bienvenues ! N'hésitez pas à :
- Ouvrir des issues pour signaler des bugs
- Proposer des améliorations
- Soumettre des pull requests

## 📄 Licence

Ce projet est sous licence MIT.

## 👤 Auteur

**Regis**

---

**Version** : 1.0  
**Date** : Janvier 2026