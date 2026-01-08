# analyzers/video_analyzer.py (version simplifiée avec OpenCV)
import cv2
import numpy as np
from typing import Dict
import os

class VideoAnalyzer:
    def __init__(self):
        # Charger cascade Haar pour détection visage (inclus dans OpenCV)
        cascade_path = cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
        self.face_cascade = cv2.CascadeClassifier(cascade_path)
        
        self.state = {
            'face_detected': False,
            'head_pose': {'pitch': 0, 'yaw': 0, 'roll': 0},
            'engagement_score': 100,
            'emotion_hint': 'neutral'
        }
        self.previous_center = None
    
    def analyze_frame(self, frame: np.ndarray) -> Dict:
        """
        Analyse une frame vidéo avec OpenCV
        Returns: dict avec face_detected, head_pose, engagement_score, emotion_hint
        """
        try:
            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            faces = self.face_cascade.detectMultiScale(
                gray,
                scaleFactor=1.1,
                minNeighbors=5,
                minSize=(30, 30)
            )
            
            if len(faces) == 0:
                self.state['face_detected'] = False
                self.state['engagement_score'] = max(0, self.state['engagement_score'] - 5)
                return self.state
            
            self.state['face_detected'] = True
            
            # Prendre le plus grand visage
            x, y, w, h = max(faces, key=lambda face: face[2] * face[3])
            
            # Calculer engagement
            self.state['engagement_score'] = self._calculate_engagement(x, y, w, h, frame.shape)
            
            # Estimation pose (simplifié basé sur position)
            self.state['head_pose'] = self._estimate_head_pose_simple(x, y, w, h, frame.shape)
            
            # Émotion (neutre par défaut)
            self.state['emotion_hint'] = 'neutral'
            
            return self.state
            
        except Exception as e:
            print(f"⚠️ Erreur analyse vidéo: {e}")
            return self.state
    
    def _calculate_engagement(self, x, y, w, h, frame_shape) -> int:
        """Score engagement basé sur taille et position du visage"""
        height, width = frame_shape[:2]
        
        # Taille relative du visage
        face_area = w * h
        frame_area = height * width
        face_ratio = face_area / frame_area
        
        # Centre du visage
        center_x = (x + w / 2) / width
        center_y = (y + h / 2) / height
        
        # Score basé sur taille (0.05 à 0.25 = optimal)
        size_score = 100
        if face_ratio < 0.05:
            size_score = 50  # Trop loin
        elif face_ratio > 0.35:
            size_score = 60  # Trop proche
        
        # Score basé sur centrage (0.3-0.7 horizontal, 0.2-0.6 vertical)
        center_score = 100
        if not (0.3 < center_x < 0.7):
            center_score -= 30
        if not (0.2 < center_y < 0.6):
            center_score -= 20
        
        # Stabilité (mouvement par rapport à frame précédente)
        stability_score = 100
        current_center = (center_x, center_y)
        if self.previous_center:
            distance = np.sqrt(
                (current_center[0] - self.previous_center[0])**2 +
                (current_center[1] - self.previous_center[1])**2
            )
            if distance > 0.1:  # Mouvement brusque
                stability_score = 70
        
        self.previous_center = current_center
        
        # Moyenne pondérée
        final_score = int(0.4 * size_score + 0.4 * center_score + 0.2 * stability_score)
        return max(0, min(100, final_score))
    
    def _estimate_head_pose_simple(self, x, y, w, h, frame_shape) -> Dict[str, float]:
        """Estimation simplifiée de la pose de la tête"""
        height, width = frame_shape[:2]
        
        # Yaw basé sur position horizontale
        center_x = (x + w / 2) / width
        yaw = (center_x - 0.5) * 100  # -50 (gauche) à +50 (droite)
        
        # Pitch basé sur position verticale
        center_y = (y + h / 2) / height
        pitch = (center_y - 0.4) * 100  # -40 (haut) à +60 (bas)
        
        return {
            'pitch': float(pitch),
            'yaw': float(yaw),
            'roll': 0.0
        }