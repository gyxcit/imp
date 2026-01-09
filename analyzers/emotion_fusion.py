# analyzers/emotion_fusion.py
from typing import Dict
import time

class EmotionFusion:
    def __init__(self):
        self.history = []
        self.max_history = 10
        
        # Historique des mouvements de tête
        self.head_movement_history = []
        self.movement_window = 4.0  # 4 secondes
        
        # NOUVEAU: Persistance des détections
        self.movement_detected_once = False
        self.speech_detected_once = False
        self.start_time = time.time() # Pour ignorer les faux positifs au démarrage
        
    def fuse_signals(self, video_state: Dict, audio_state: Dict) -> Dict:
        """
        Fusionne les analyses vidéo et audio
        Returns: état unifié pour attention_system
        """
        # Enregistrer mouvement de tête avec timestamp
        self._record_head_movement(video_state)
        
        # Score attention combiné
        attention_score = self._compute_attention(video_state, audio_state)
        
        # Émotion dominante
        emotion = self._determine_emotion(video_state, audio_state)
        
        # Détection patterns
        pattern = self._detect_pattern(video_state, audio_state)
        
        # NOUVEAU: Indicateurs booléens pour mouvement et parole
        # Une fois détecté, ça reste True
        movement_detected = self._detect_significant_head_movement()
        speech_detected = audio_state.get('speech_detected', False)
        
        # Période de chauffe (3 secondes) pour éviter les faux positifs au lancement
        if time.time() - self.start_time > 3.0:
            if movement_detected:
                self.movement_detected_once = True
            if speech_detected:
                self.speech_detected_once = True
        
        both_active = self.movement_detected_once and self.speech_detected_once
        
        unified_state = {
            'attention_score': attention_score,
            'emotion': emotion,
            'pattern': pattern,
            'movement_detected': self.movement_detected_once,
            'speech_detected': self.speech_detected_once,
            'both_active': both_active,
            'video': video_state,
            'audio': audio_state
        }
        
        # Historique
        self.history.append(unified_state)
        if len(self.history) > self.max_history:
            self.history.pop(0)
        
        return unified_state
    
    def _record_head_movement(self, video: Dict):
        """Enregistrer les mouvements de tête avec timestamp"""
        current_time = time.time()
        
        if video.get('face_detected'):
            head_pose = video.get('head_pose', {})
            yaw = head_pose.get('yaw', 0)
            pitch = head_pose.get('pitch', 0)
            
            self.head_movement_history.append({
                'timestamp': current_time,
                'yaw': yaw,
                'pitch': pitch
            })
        
        # Nettoyer l'historique > 4 secondes
        self.head_movement_history = [
            movement for movement in self.head_movement_history 
            if current_time - movement['timestamp'] <= self.movement_window
        ]
    
    def _detect_significant_head_movement(self) -> bool:
        """Détection basée sur la variance des positions sur ~60 frames (3 secondes)"""
        # Il faut un minimum de données (au moins 1 seconde pour commencer)
        if len(self.head_movement_history) < 20:
            return False
            
        # Analyser les 60 dernières frames (fenêtre glissante)
        # Avec le framerate de 20fps, cela représente 3 secondes d'historique
        # Cela permet de lisser les mouvements lents et capturer le rythme sur la durée
        recent_history = self.head_movement_history[-60:]
        
        # Extraction des séries de données
        yaws = [m['yaw'] for m in recent_history]
        pitches = [m['pitch'] for m in recent_history]
        
        def calculate_std_dev(data):
            """Calcul écart-type manuel"""
            if len(data) < 2: return 0.0
            avg = sum(data) / len(data)
            variance = sum([(x - avg) ** 2 for x in data]) / len(data)
            return variance ** 0.5
            
        # Calculer la dispersion autour de la moyenne
        yaw_std = calculate_std_dev(yaws)
        pitch_std = calculate_std_dev(pitches)
        
        # SEUILS (Baromètre):
        # L'utilisateur mentionne des variations de "1.2 à 1.3".
        # Un écart-type de 0.4 - 0.5 signifie une variation moyenne d'environ 0.5 degré autour du centre.
        # Cela capture les mouvements subtils mais ignore le "bruit" statique (tracking jitter).
        threshold = 0.8 # Seuil augmenté sur demande (était 0.5) pour éviter les faux positifs
        
        is_moving_yaw = yaw_std > threshold      # Variation latérale (Non/Rythme)
        is_moving_pitch = pitch_std > threshold  # Variation verticale (Oui/Rythme)
        
        return is_moving_yaw or is_moving_pitch
        
        return is_moving_yaw or is_moving_pitch

    def _get_movement_quality(self) -> float:
        """Calculer l'intensité du mouvement (0.0 à 1.0)"""
        if len(self.head_movement_history) < 3:
            return 0.0
            
        recent_history = self.head_movement_history[-15:] # 1.5 secondes
        total_delta = 0
        
        for i in range(1, len(recent_history)):
            curr = recent_history[i]
            prev = recent_history[i-1]
            total_delta += abs(curr['yaw'] - prev['yaw']) + abs(curr['pitch'] - prev['pitch'])
            
        # Normalisation : 30 degrés cumulés sur 1.5s = intensité 1.0
        intensity = min(1.0, total_delta / 30.0)
        return intensity

    def _compute_attention(self, video: Dict, audio: Dict) -> int:
        """Calcul attention unifié"""
        
        face_detected = video.get('face_detected', False)
        
        # 1. Pas de visage = Attention minimale
        if not face_detected:
            return 5
            
        # 2. Score de base provenant de l'analyseur vidéo (50 à 100)
        video_score = video.get('engagement_score', 50)
        
        attention_score = video_score
        
        # 3. Bonus Mouvement (Le mouvement est signe de vie/engagement ici)
        is_moving = self._detect_significant_head_movement()
        if is_moving:
            quality = self._get_movement_quality()
            # Si ça bouge, on valide l'engagement actif
            # On remonte les scores faibles vers le haut
            if attention_score < 70:
                attention_score += 15
            else:
                attention_score += 5
        
        # 4. Bonus Audio (Parler ou chanter = engagement)
        if audio.get('speech_detected', False):
            attention_score += 10
            
        return min(100, attention_score)
    
    def _determine_emotion(self, video: Dict, audio: Dict) -> str:
        """Émotion dominante avec priorité vidéo (DeepFace)"""
        
        # Utiliser l'émotion DeepFace directement
        if video.get('face_detected'):
            v_emotion = video.get('facial_expression', {}).get('emotion', 'neutral')
            confidence = video.get('facial_expression', {}).get('confidence', 0)
            
            # Si confiance élevée, prendre l'émotion vidéo
            if confidence > 0.6:
                return v_emotion
        
        # Sinon, combiner avec audio
        a_emotion = audio.get('emotion_hint', 'neutral')
        
        # Fallback sur audio
        return a_emotion if a_emotion != 'neutral' else 'neutral'
    
    def _detect_pattern(self, video: Dict, audio: Dict) -> str:
        """Détection patterns comportementaux"""
        if not video.get('face_detected') and not audio.get('speech_detected'):
            return 'absent'
        
        # Tête penchée + silence = sommeil?
        head_pose = video.get('head_pose', {})
        if abs(head_pose.get('pitch', 0)) > 30:
            return 'drowsy'
        
        return 'normal'