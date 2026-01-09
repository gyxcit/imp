# analyzers/video_analyzer.py
import cv2
import numpy as np
from typing import Dict, Tuple, Optional
import math

class VideoAnalyzer:
    def __init__(self):
        self.state = {
            'face_detected': False,
            'head_pose': {'pitch': 0, 'yaw': 0, 'roll': 0},
            'engagement_score': 100,
            'emotion_hint': 'neutral',
            'facial_expression': {
                'emotion': 'neutral',
                'confidence': 0.0
            }
        }
        
        self.previous_center = None
        self.emotion_history = []
        self.frame_skip = 0
        self.skip_interval = 1 # Analyser chaque frame reçue, le throttling est géré en amont
        
        # Nouveau : tracker l'immobilité
        self.immobility_frames = 0
        self.movement_history = []
        
        # STABILISATION: Historique pour le lissage des valeurs
        self.pose_smoothing = {'yaw': 0.0, 'pitch': 0.0, 'roll': 0.0}
        self.smoothing_factor = 0.15  # 0.1 = très lent/stable, 0.9 = très réactif/nerveux
        
        # Utiliser Haar Cascades (toujours disponible, rapide)
        print("⏳ Chargement Haar Cascades...")
        cascade_path = cv2.data.haarcascades
        self.face_cascade = cv2.CascadeClassifier(cascade_path + 'haarcascade_frontalface_default.xml')
        self.profile_cascade = cv2.CascadeClassifier(cascade_path + 'haarcascade_profileface.xml')
        self.eye_cascade = cv2.CascadeClassifier(cascade_path + 'haarcascade_eye.xml')
        self.smile_cascade = cv2.CascadeClassifier(cascade_path + 'haarcascade_smile.xml')
        
        # Historique pour stabilité
        self.face_history = []
        self.blink_counter = 0
        self.last_eye_state = True
        
        print("✅ VideoAnalyzer initialisé avec OpenCV Haar Cascades")
    
    def analyze_frame(self, frame: np.ndarray) -> Dict:
        """Analyse une frame vidéo avec OpenCV"""
        try:
            self.frame_skip += 1
            if self.frame_skip % self.skip_interval != 0:
                return self.state
            
            height, width = frame.shape[:2]
            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            
            # Détecter le visage
            face_box = self._detect_face_cascade(gray)
            
            if face_box is None:
                self._handle_no_face()
                return self.state
            
            x, y, w, h = face_box
            self.state['face_detected'] = True
            
            # Calculer la pose de la tête
            self.state['head_pose'] = self._estimate_head_pose(x, y, w, h, width, height)
            
            # Analyser l'expression faciale
            face_roi = frame[y:y+h, x:x+w]
            face_roi_gray = gray[y:y+h, x:x+w]
            
            emotion, confidence = self._analyze_expression(face_roi, face_roi_gray)
            self.state['facial_expression'] = {
                'emotion': emotion,
                'confidence': confidence
            }
            self.state['emotion_hint'] = emotion
            
            # Calculer l'engagement
            self.state['engagement_score'] = self._calculate_engagement(
                x, y, w, h, width, height, emotion, confidence
            )
            
            self._update_emotion_history(emotion)
            
            return self.state
            
        except Exception as e:
            print(f"❌ Erreur analyse frame: {e}")
            self._handle_no_face()
            return self.state
    
    def _detect_face_cascade(self, gray: np.ndarray) -> Optional[Tuple]:
        """Détection de visage avec Haar Cascades"""
        
        # Détecter faces frontales
        faces = self.face_cascade.detectMultiScale(
            gray, scaleFactor=1.1, minNeighbors=5, minSize=(30, 30)
        )
        
        # Si pas de face, essayer profil
        if len(faces) == 0:
            faces = self.profile_cascade.detectMultiScale(
                gray, scaleFactor=1.1, minNeighbors=5, minSize=(30, 30)
            )
        
        if len(faces) == 0:
            return None
        
        # Prendre le plus grand visage
        face = max(faces, key=lambda f: f[2] * f[3])
        return tuple(face)
    
    def _estimate_head_pose(self, x: int, y: int, w: int, h: int, 
                           frame_width: int, frame_height: int) -> Dict:
        """Estimer la pose de la tête avec lissage (Smoothing)"""
        
        # Centre du visage
        face_center_x = (x + w / 2) / frame_width
        face_center_y = (y + h / 2) / frame_height
        
        # Yaw (gauche/droite) basé sur position horizontale relative
        raw_yaw = (face_center_x - 0.5) * 60
        
        # Pitch (haut/bas) basé sur position verticale relative
        raw_pitch = (face_center_y - 0.45) * 50
        
        # Roll (inclinaison)
        aspect_ratio = w / h if h > 0 else 1.0
        raw_roll = 0
        if aspect_ratio < 0.9:
            raw_roll = (0.9 - aspect_ratio) * 30
        elif aspect_ratio > 1.1:
            raw_roll = (aspect_ratio - 1.1) * -30
            
        # APPLIQUER LE LISSAGE (EMA)
        # Valeur = (Alpha * Nouvelle) + ((1-Alpha) * Ancienne)
        self.pose_smoothing['yaw'] = (self.smoothing_factor * raw_yaw) + \
                                    ((1 - self.smoothing_factor) * self.pose_smoothing['yaw'])
                                    
        self.pose_smoothing['pitch'] = (self.smoothing_factor * raw_pitch) + \
                                      ((1 - self.smoothing_factor) * self.pose_smoothing['pitch'])
                                      
        self.pose_smoothing['roll'] = (self.smoothing_factor * raw_roll) + \
                                     ((1 - self.smoothing_factor) * self.pose_smoothing['roll'])
        
        return {
            'yaw': round(self.pose_smoothing['yaw'], 1),
            'pitch': round(self.pose_smoothing['pitch'], 1),
            'roll': round(self.pose_smoothing['roll'], 1)
        }
    
    def _analyze_expression(self, face_roi: np.ndarray, face_roi_gray: np.ndarray) -> Tuple[str, float]:
        """Analyser l'expression faciale"""
        
        if face_roi.size == 0 or face_roi_gray.size == 0:
            return 'neutral', 0.5
        
        h, w = face_roi_gray.shape[:2]
        
        # Détecter les yeux
        eyes = self.eye_cascade.detectMultiScale(face_roi_gray, scaleFactor=1.1, minNeighbors=10)
        eyes_open = len(eyes) >= 2
        
        # Détecter sourire
        smiles = self.smile_cascade.detectMultiScale(face_roi_gray, scaleFactor=1.8, minNeighbors=20)
        is_smiling = len(smiles) > 0
        
        # Clignements
        if not eyes_open and self.last_eye_state:
            self.blink_counter += 1
        self.last_eye_state = eyes_open
        
        # Déterminer l'émotion
        emotion = 'neutral'
        confidence = 0.7
        
        if not eyes_open:
            emotion = 'tired'
            confidence = 0.8
        elif is_smiling:
            emotion = 'happy'
            confidence = 0.75
        elif eyes_open and not is_smiling:
            emotion = 'focused'
            confidence = 0.7
        
        # Clignements fréquents = fatigué
        if self.blink_counter > 20:
            emotion = 'tired'
            confidence = 0.85
            self.blink_counter = 0
        
        return emotion, confidence
    

    
    def _calculate_engagement(self, x: int, y: int, w: int, h: int,
                             frame_width: int, frame_height: int,
                             emotion: str, confidence: float) -> int:
        """Calculer le score d'engagement - NOUVELLE LOGIQUE
        
        Règle : Minimum 50 si visage détecté.
        Bonus :
        + Centrage (0-20 pts)
        + Proximité/Taille (0-20 pts)
        + Stabilité du regard (0-10 pts)
        """
        
        # 1. BASE SOLIDE (20 points)
        score = 20
        
        # 2. BONUS CENTRAGE (Max 30 points)
        # On calcule la distance du centre du visage par rapport au centre de l'image
        center_x = (x + w / 2) / frame_width
        center_y = (y + h / 2) / frame_height
        
        # Distance au centre (0 = centre parfait, 0.5 = bord)
        dist_from_center = np.sqrt((center_x - 0.5)**2 + (center_y - 0.5)**2)
        
        # Si on est dans le "cercle d'or" (rayon 0.3), on donne des points
        if dist_from_center < 0.15:
            score += 30  # Parfaitement centré
        elif dist_from_center < 0.3:
            score += 15  # Correctement centré
        
        # 3. BONUS PROXIMITÉ (Max 30 points)
        # Ratio de la surface du visage par rapport à l'image
        face_area = (w * h) / (frame_width * frame_height)
        
        if face_area > 0.15:     # Très proche / Gros plan
            score += 30
        elif face_area > 0.05:   # Distance normale
            score += 15
            
        # 4. BONUS FACE CAMÉRA (Max 20 points)
        # Si yaw et pitch sont faibles, l'utilisateur regarde l'écran
        # On élargit la tolérance pour permettre le mouvement (jamming) sans perdre de points
        yaw = abs(self.state['head_pose']['yaw'])
        pitch = abs(self.state['head_pose']['pitch'])
        
        if yaw < 25 and pitch < 25: # Tolérance élargie (était 15) pour maintenir le score pendant le head-banging
            score += 20

        # Cap à 100
        return min(100, int(score))

    def _handle_no_face(self):
        """Gérer l'absence de visage"""
        self.state['face_detected'] = False
        self.state['engagement_score'] = max(0, self.state['engagement_score'] - 10)
        self.state['facial_expression']['emotion'] = 'absent'
        self.state['emotion_hint'] = 'absent'
    
    def _update_emotion_history(self, emotion: str):
        """Mettre à jour l'historique des émotions"""
        self.emotion_history.append(emotion)
        if len(self.emotion_history) > 10:
            self.emotion_history.pop(0)
    
    def get_state(self) -> Dict:
        """Retourner l'état actuel"""
        return self.state.copy()
    
    def reset(self):
        """Réinitialiser l'analyseur"""
        self.state = {
            'face_detected': False,
            'head_pose': {'pitch': 0, 'yaw': 0, 'roll': 0},
            'engagement_score': 100,
            'emotion_hint': 'neutral',
            'facial_expression': {
                'emotion': 'neutral',
                'confidence': 0.0
            }
        }
        self.previous_center = None
        self.emotion_history = []
        self.blink_counter = 0
        self.immobility_frames = 0
        self.movement_history = []
        print("🔄 VideoAnalyzer réinitialisé")
