# Test MediaPipe

## Installation

Pour tester MediaPipe indépendamment du projet principal :

```bash
pip install -r requirements_mediapipe.txt
```

## Lancer le test

```bash
python test_mediapipe.py
```

## Fonctionnalités testées

Le fichier `test_mediapipe.py` démontre :

- ✅ **Détection faciale** avec MediaPipe Face Mesh (468 landmarks)
- ✅ **Détection d'émotions** basique :
  - Happy (sourire détecté)
  - Tired (yeux fermés)
  - Focused (neutre, yeux ouverts)
- ✅ **Détection yeux ouverts/fermés**
- ✅ **Estimation pose de la tête** (yaw/pitch)
- ✅ **Affichage en temps réel** des landmarks faciaux

## Utilisation

1. Lance la webcam automatiquement
2. Affiche les landmarks du visage en temps réel
3. Détecte et affiche :
   - Présence d'un visage
   - Émotion détectée
   - État des yeux (ouverts/fermés)
   - Orientation de la tête
4. Appuyer sur **'q'** pour quitter

## Comparaison avec Haar Cascades (utilisé actuellement)

### OpenCV Haar Cascades (système actuel)
- ✅ Très rapide (temps réel garanti)
- ✅ Pas de dépendances lourdes
- ✅ Détection visage, yeux, sourire
- ❌ Détection basique (rectangles)
- ❌ Pas de landmarks précis

### MediaPipe Face Mesh
- ✅ 468 landmarks précis du visage
- ✅ Meilleure estimation de pose
- ✅ Détection très précise des expressions
- ❌ Plus gourmand en ressources
- ❌ Dépendance TensorFlow Lite

## Pour intégrer MediaPipe au projet

Si vous souhaitez remplacer Haar par MediaPipe dans `video_analyzer.py` :

1. Ajouter `mediapipe>=0.10.9` à `requirements.txt`
2. Adapter la classe `VideoAnalyzer` en s'inspirant de `test_mediapipe.py`
