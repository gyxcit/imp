# analyzers/video_analyzer.py
import cv2
import numpy as np
from typing import Dict, Optional
import os

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
            },
            'hands_detected': False,
            'hands_count': 0,
            'hands_positions': [],  # Nouvelles positions pour visualisation
            'arms_detected': False,
            'arms_count': 0,
            'arms_positions': []   # Nouvelles positions des bras
        }
        
        self.previous_center = None
        self.emotion_history = []
        self.frame_skip = 0
        self.skip_interval = 2  # Analyser 1 frame sur 2
        
        # Charger les cascades Haar d'OpenCV
        cascade_path = cv2.data.haarcascades
        self.face_cascade = cv2.CascadeClassifier(cascade_path + 'haarcascade_frontalface_default.xml')
        self.profile_cascade = cv2.CascadeClassifier(cascade_path + 'haarcascade_profileface.xml')
        self.eye_cascade = cv2.CascadeClassifier(cascade_path + 'haarcascade_eye.xml')
        self.smile_cascade = cv2.CascadeClassifier(cascade_path + 'haarcascade_smile.xml')
        
        # Vérifier que les cascades sont chargées
        if self.face_cascade.empty():
            print("❌ ERREUR: Impossible de charger haarcascade_frontalface_default.xml")
        else:
            print(f"✅ Face cascade chargée: {cascade_path}haarcascade_frontalface_default.xml")
            
        if self.profile_cascade.empty():
            print("❌ ERREUR: Impossible de charger haarcascade_profileface.xml")
        else:
            print(f"✅ Profile cascade chargée: {cascade_path}haarcascade_profileface.xml")
        
        # Essayer de charger la cascade pour les mains (pas toujours disponible)
        try:
            self.hand_cascade = cv2.CascadeClassifier(cascade_path + 'haarcascade_hand.xml')
            self.hand_detection_enabled = not self.hand_cascade.empty()
        except:
            self.hand_detection_enabled = False
        
        print(f"✅ VideoAnalyzer initialisé avec OpenCV Haar Cascades (Face + Profil + {'Mains' if self.hand_detection_enabled else 'Pas de mains'})")
    
    def analyze_frame(self, frame: np.ndarray) -> Dict:
        """
        Analyse une frame vidéo avec OpenCV Haar Cascades
        Returns: dict avec face_detected, head_pose, engagement_score, emotion_hint, facial_expression
        """
        try:
            # Optimisation: analyser 1 frame sur N pour performance
            self.frame_skip += 1
            if self.frame_skip % self.skip_interval != 0:
                return self.state
            
            # Convertir en niveaux de gris pour Haar Cascades
            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            
            # Détecter les visages (face + profil)
            faces_front = self.face_cascade.detectMultiScale(
                gray,
                scaleFactor=1.1,
                minNeighbors=5,
                minSize=(30, 30)
            )
            
            faces_profile = self.profile_cascade.detectMultiScale(
                gray,
                scaleFactor=1.1,
                minNeighbors=5,
                minSize=(30, 30)
            )
            
            # Debug: afficher le nombre de visages détectés
            if len(faces_front) > 0 or len(faces_profile) > 0:
                print(f"🔍 Visages détectés: {len(faces_front)} frontaux, {len(faces_profile)} profils")
            
            # Combiner les détections
            all_faces = list(faces_front) + list(faces_profile)
            
            if len(all_faces) == 0:
                self._handle_no_face()
                return self.state
            
            # Prendre le plus grand visage (le plus proche)
            face = max(all_faces, key=lambda f: f[2] * f[3])
            x, y, w, h = face
            
            self.state['face_detected'] = True
            
            # Détection des mains et bras
            hands_detected, hands_count, hands_positions = self._detect_hands_and_arms(frame, gray)
            arms_detected, arms_count, arms_positions = self._detect_arms(frame, gray)
            
            self.state['hands_detected'] = hands_detected
            self.state['hands_count'] = hands_count
            self.state['hands_positions'] = hands_positions
            self.state['arms_detected'] = arms_detected
            self.state['arms_count'] = arms_count
            self.state['arms_positions'] = arms_positions
            
            # Déterminer si c'est un profil ou une face
            is_profile = len(faces_front) == 0 and len(faces_profile) > 0
            
            # ROI pour le visage
            face_roi_gray = gray[y:y+h, x:x+w]
            
            # Détection des yeux (moins fiable pour les profils)
            eyes = []
            if not is_profile:
                eyes = self.eye_cascade.detectMultiScale(face_roi_gray, scaleFactor=1.1, minNeighbors=10)
            eyes_open = len(eyes) >= 2 if not is_profile else True  # Assume yeux ouverts pour profil
            
            # Détection sourire (moins fiable pour les profils)
            smiles = []
            if not is_profile:
                smiles = self.smile_cascade.detectMultiScale(face_roi_gray, scaleFactor=1.8, minNeighbors=20)
            is_smiling = len(smiles) > 0 if not is_profile else False
            
            # Déterminer l'émotion basée sur les détections
            emotion = 'neutral'
            confidence = 0.6
            
            if is_profile:
                emotion = 'focused'  # Profil = concentration
                confidence = 0.7
            elif is_smiling:
                emotion = 'happy'
                confidence = 0.8
            elif not eyes_open:
                emotion = 'tired'
                confidence = 0.7
            else:
                emotion = 'focused' if eyes_open else 'neutral'
                confidence = 0.65
            
            # Mettre à jour l'état facial
            self.state['facial_expression'] = {
                'emotion': emotion,
                'confidence': confidence
            }
            
            # Émotion hint pour compatibilité, hands_detected
            self.state['emotion_hint'] = emotion
            
            # Calculer engagement basé sur position et émotion
            self.state['engagement_score'] = self._calculate_engagement(
                x, y, w, h, frame.shape, emotion, confidence, eyes_open
            )
            
            # Estimation pose basée sur position
            self.state['head_pose'] = self._estimate_head_pose(x, y, w, h, frame.shape)
            
            # Historique des émotions (lissage)
            self._update_emotion_history(emotion)
            
            return self.state
            
        except Exception as e:
            # En cas d'erreur
            self._handle_no_face()
            return self.state
    
    def _handle_no_face(self):
        """Gérer l'absence de visage détecté"""
        self.state['face_detected'] = False
        self.state['hands_detected'] = False
        self.state['hands_count'] = 0
        self.state['hands_positions'] = []
        self.state['arms_detected'] = False
        self.state['arms_count'] = 0
        self.state['arms_positions'] = []
        self.state['engagement_score'] = max(0, self.state['engagement_score'] - 10)
        self.state['facial_expression']['emotion'] = 'absent'
        self.state['emotion_hint'] = 'absent'
    
    def _calculate_engagement(self, x: int, y: int, w: int, h: int, 
                             frame_shape: tuple, emotion: str, confidence: float, eyes_open: bool = True) -> int:
        """Calculer le score d'engagement basé sur position, taille et émotion"""
        height, width = frame_shape[:2]
        
        # Taille relative du visage
        face_area = w * h
        frame_area = height * width
        face_ratio = face_area / frame_area
        
        # Score de taille (0.05 à 0.30 = optimal)
        size_score = 100
        if face_ratio < 0.03:
            size_score = 40  # Trop loin
        elif face_ratio < 0.05:
            size_score = 60
        elif face_ratio > 0.40:
            size_score = 50  # Trop proche
        
        # Centre du visage
        center_x = (x + w / 2) / width
        center_y = (y + h / 2) / height
        
        # Score de centrage (0.3-0.7 horizontal, 0.2-0.7 vertical)
        center_score = 100
        if not (0.25 < center_x < 0.75):
            center_score -= 40
        if not (0.15 < center_y < 0.70):
            center_score -= 30
        
        # Stabilité (mouvement)
        stability_score = 100
        current_center = (center_x, center_y)
        if self.previous_center:
            distance = np.sqrt(
                (current_center[0] - self.previous_center[0])**2 +
                (current_center[1] - self.previous_center[1])**2
            )
            if distance > 0.15:
                stability_score = 60
            elif distance > 0.08:
                stability_score = 80
        
        self.previous_center = current_center
        
        # Bonus/malus basé sur l'émotion
        emotion_bonus = 0
        if emotion == 'happy':
            emotion_bonus = 15
        elif emotion == 'focused':
            emotion_bonus = 10
        elif emotion == 'tired':
            emotion_bonus = -20
        elif emotion == 'absent':
            emotion_bonus = -30
        
        # Malus si yeux fermés
        if not eyes_open:
            emotion_bonus -= 25
        
        # NOUVEAU: Bonus mains et bras détectés
        if self.state['hands_detected']:
            emotion_bonus += 20  # Bonus significatif pour l'engagement
        if self.state['arms_detected']:
            emotion_bonus += 10  # Bonus modéré pour les bras
        
        # Bonus confiance élevée
        if confidence > 0.7:
            emotion_bonus += 5
        
        # Moyenne pondérée
        final_score = int(
            0.25 * size_score + 
            0.30 * center_score + 
            0.25 * stability_score + 
            0.20 * 100 +  # Bonus de base pour visage détecté
            emotion_bonus
        )
        
        return max(0, min(100, final_score))
    
    def _detect_hands_and_arms(self, frame: np.ndarray, gray: np.ndarray) -> tuple:
        """Détecter les mains et retourner les positions pour visualisation"""
        try:
            # Méthode 1: Cascade Haar si disponible
            if hasattr(self, 'hand_detection_enabled') and self.hand_detection_enabled:
                hands = self.hand_cascade.detectMultiScale(
                    gray,
                    scaleFactor=1.1,
                    minNeighbors=3,
                    minSize=(20, 20)
                )
                positions = [(x, y, w, h) for x, y, w, h in hands]
                return len(hands) > 0, len(hands), positions
            
            # Méthode 2: Détection basée sur la couleur de peau améliorée
            return self._detect_hands_by_skin_color_advanced(frame)
            
        except Exception:
            return False, 0, []
    
    def _detect_hands_by_skin_color_advanced(self, frame: np.ndarray) -> tuple:
        """Détection avancée des mains basée sur la couleur de peau"""
        try:
            # Convertir en HSV et YCrCb pour une meilleure détection
            hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
            ycrcb = cv2.cvtColor(frame, cv2.COLOR_BGR2YCrCb)
            
            # Plages de couleur pour la peau (HSV)
            lower_skin_hsv = np.array([0, 20, 70], dtype=np.uint8)
            upper_skin_hsv = np.array([20, 255, 255], dtype=np.uint8)
            
            # Plages de couleur pour la peau (YCrCb)
            lower_skin_ycrcb = np.array([0, 135, 85], dtype=np.uint8)
            upper_skin_ycrcb = np.array([255, 180, 135], dtype=np.uint8)
            
            # Masques de couleur de peau
            skin_mask_hsv = cv2.inRange(hsv, lower_skin_hsv, upper_skin_hsv)
            skin_mask_ycrcb = cv2.inRange(ycrcb, lower_skin_ycrcb, upper_skin_ycrcb)
            
            # Combiner les masques
            skin_mask = cv2.bitwise_and(skin_mask_hsv, skin_mask_ycrcb)
            
            # Nettoyer le masque
            kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7))
            skin_mask = cv2.morphologyEx(skin_mask, cv2.MORPH_CLOSE, kernel)
            skin_mask = cv2.morphologyEx(skin_mask, cv2.MORPH_OPEN, kernel)
            
            # Trouver les contours
            contours, _ = cv2.findContours(skin_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            
            # Filtrer et analyser les contours pour mains
            hand_contours = []
            hand_positions = []
            
            for contour in contours:
                area = cv2.contourArea(contour)
                if 800 < area < 8000:  # Taille mains
                    # Analyse de forme pour confirmer que c'est une main
                    hull = cv2.convexHull(contour)
                    hull_area = cv2.contourArea(hull)
                    solidity = float(area) / hull_area if hull_area > 0 else 0
                    
                    # Rectangle englobant
                    x, y, w, h = cv2.boundingRect(contour)
                    aspect_ratio = float(w) / h if h > 0 else 0
                    
                    # Critères pour une main
                    if 0.3 < solidity < 0.9 and 0.4 < aspect_ratio < 2.5:
                        hand_contours.append(contour)
                        hand_positions.append((x, y, w, h))
            
            hands_count = len(hand_contours)
            return hands_count > 0, hands_count, hand_positions
            
        except Exception:
            return False, 0, []
    
    def _detect_arms(self, frame: np.ndarray, gray: np.ndarray) -> tuple:
        """Détection des bras (zones plus larges que les mains)"""
        try:
            # Convertir en HSV et YCrCb
            hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
            ycrcb = cv2.cvtColor(frame, cv2.COLOR_BGR2YCrCb)
            
            # Masques de couleur peau (mêmes que les mains)
            lower_skin_hsv = np.array([0, 20, 70], dtype=np.uint8)
            upper_skin_hsv = np.array([20, 255, 255], dtype=np.uint8)
            lower_skin_ycrcb = np.array([0, 135, 85], dtype=np.uint8)
            upper_skin_ycrcb = np.array([255, 180, 135], dtype=np.uint8)
            
            skin_mask_hsv = cv2.inRange(hsv, lower_skin_hsv, upper_skin_hsv)
            skin_mask_ycrcb = cv2.inRange(ycrcb, lower_skin_ycrcb, upper_skin_ycrcb)
            skin_mask = cv2.bitwise_and(skin_mask_hsv, skin_mask_ycrcb)
            
            # Nettoyer avec un kernel plus large pour les bras
            kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (11, 11))
            skin_mask = cv2.morphologyEx(skin_mask, cv2.MORPH_CLOSE, kernel)
            skin_mask = cv2.morphologyEx(skin_mask, cv2.MORPH_OPEN, kernel)
            
            contours, _ = cv2.findContours(skin_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            
            arm_contours = []
            arm_positions = []
            
            for contour in contours:
                area = cv2.contourArea(contour)
                # Bras sont plus grands que les mains
                if 5000 < area < 25000:
                    x, y, w, h = cv2.boundingRect(contour)
                    aspect_ratio = float(w) / h if h > 0 else 0
                    
                    # Bras sont généralement plus allongés
                    if 0.2 < aspect_ratio < 4.0:
                        arm_contours.append(contour)
                        arm_positions.append((x, y, w, h))
            
            arms_count = len(arm_contours)
            return arms_count > 0, arms_count, arm_positions
            
        except Exception:
            return False, 0, []
    
    def _estimate_head_pose(self, x: int, y: int, w: int, h: int, 
                           frame_shape: tuple) -> Dict[str, float]:
        """Estimation simplifiée de la pose de la tête"""
        height, width = frame_shape[:2]
        
        # Yaw (rotation horizontale)
        center_x = (x + w / 2) / width
        yaw = (center_x - 0.5) * 100  # -50 (gauche) à +50 (droite)
        
        # Pitch (inclinaison verticale)
        center_y = (y + h / 2) / height
        pitch = (center_y - 0.4) * 100  # -40 (haut) à +60 (bas)
        
        return {
            'pitch': float(pitch),
            'yaw': float(yaw),
            'roll': 0.0
        }
    
    def _update_emotion_history(self, emotion: str):
        """Lisser les émotions avec historique"""
        self.emotion_history.append(emotion)
        if len(self.emotion_history) > 5:
            self.emotion_history.pop(0)
        
        # Émotion dominante sur les 5 dernières
        if len(self.emotion_history) >= 3:
            from collections import Counter
            most_common = Counter(self.emotion_history).most_common(1)[0][0]
            if most_common != emotion and most_common != 'absent':
                self.state['emotion_hint'] = most_common