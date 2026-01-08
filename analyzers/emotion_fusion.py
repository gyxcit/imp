# analyzers/emotion_fusion.py
from typing import Dict
import time

class EmotionFusion:
    def __init__(self):
        self.history = []
        self.max_history = 10
        
        # NOUVEAU: Historique des mouvements de tête
        self.head_movement_history = []
        self.movement_window = 4.0  # 4 secondes pour plus de stabilité
        
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
        
        unified_state = {
            'attention_score': attention_score,
            'emotion': emotion,
            'pattern': pattern,
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
    
    def _compute_attention(self, video: Dict, audio: Dict) -> int:
        """Calcul attention 0-100 avec nouvelle logique et mouvements sophistiqués"""
        
        # Détection présence
        face_detected = video.get('face_detected', False)
        speech_detected = audio.get('speech_detected', False)
        head_movement = self._detect_significant_head_movement()
        
        # LOGIQUE AMÉLIORÉE :
        # 1. Pas de mouvement + pas d'audio = score TRÈS bas (5-15)
        if not head_movement and not speech_detected:
            if face_detected:
                return 10  # Présent mais totalement inactif
            else:
                return 5   # Absent et inactif
        
        # 2. Audio + mouvements de tête = score très haut (85-100)
        if head_movement and speech_detected:
            # Bonus basé sur la qualité des mouvements
            movement_quality = self._get_movement_quality()
            energy = audio.get('energy_level', 0)
            
            base_high_score = 85
            base_high_score += min(10, movement_quality * 2)  # +0 à +10
            base_high_score += min(5, energy // 20)           # +0 à +5
            
            return min(100, base_high_score)
        
        # 3. L'un des deux seulement = score moyen-bas (25-60)
        if head_movement or speech_detected:
            base_score = 30
            
            # Bonus selon la qualité
            if head_movement:
                movement_quality = self._get_movement_quality()
                base_score += 15 + (movement_quality * 10)  # +15 à +25
            
            if speech_detected:
                base_score += 10
                energy = audio.get('energy_level', 0)
                if energy > 30:
                    base_score += 10
            
            # Petit bonus si visage centré
            if face_detected:
                engagement = video.get('engagement_score', 0)
                if engagement > 70:
                    base_score += 5
        
        return max(5, min(100, base_score))
    
    def _detect_significant_head_movement(self) -> bool:
        """Détecter des mouvements significatifs sur 3 secondes - VERSION TRÈS STRICTE"""
        if len(self.head_movement_history) < 5:  # Exiger plus d'historique
            return False
        
        # Analyser les changements de direction avec seuils TRÈS élevés
        significant_yaw_changes = 0
        significant_pitch_changes = 0
        micro_movements = 0
        total_movement = 0
        
        for i in range(1, len(self.head_movement_history)):
            current = self.head_movement_history[i]
            previous = self.head_movement_history[i-1]
            
            # Changement yaw (gauche-droite) - SEUILS TRÈS STRICTS
            yaw_diff = abs(current['yaw'] - previous['yaw'])
            if yaw_diff > 20:  # Mouvement vraiment significatif > 20°
                significant_yaw_changes += 1
                total_movement += yaw_diff
            elif 0.5 <= yaw_diff <= 5:  # Micro-mouvements (redressements/tremblements)
                micro_movements += 1
            
            # Changement pitch (haut-bas) - SEUILS TRÈS STRICTS  
            pitch_diff = abs(current['pitch'] - previous['pitch'])
            if pitch_diff > 20:  # Mouvement vraiment significatif > 20°
                significant_pitch_changes += 1
                total_movement += pitch_diff
            elif 0.5 <= pitch_diff <= 5:  # Micro-mouvements
                micro_movements += 1
        
        # CRITÈRES TRÈS STRICTS:
        # 1. Rejeter immédiatement si trop de micro-mouvements (instabilité)
        if micro_movements > 5:  # Plus tolérant aux micro-mouvements
            return False
        
        # 2. Exiger un mouvement total minimum 
        if total_movement < 40:  # Au moins 40° de mouvement total
            return False
            
        # 3. Exiger plusieurs mouvements significatifs
        significant_movement = (
            significant_yaw_changes >= 3 or  # 3 mouvements dans une direction
            significant_pitch_changes >= 3 or 
            (significant_yaw_changes >= 2 and significant_pitch_changes >= 2)  # 2+2
        )
        
        return significant_movement
    
    def _get_movement_quality(self) -> float:
        """Calculer la qualité des mouvements (0-1) - VERSION TRÈS STRICTE"""
        if len(self.head_movement_history) < 3:
            return 0.0
        
        significant_movement = 0
        meaningful_changes = 0
        micro_movements = 0
        
        for i in range(1, len(self.head_movement_history)):
            current = self.head_movement_history[i]
            previous = self.head_movement_history[i-1]
            
            yaw_diff = abs(current['yaw'] - previous['yaw'])
            pitch_diff = abs(current['pitch'] - previous['pitch'])
            
            total_diff = yaw_diff + pitch_diff
            
            # Seuls les mouvements > 15° comptent vraiment
            if total_diff > 15:  # Seuil encore plus élevé
                significant_movement += total_diff
                meaningful_changes += 1
            # Les micro-mouvements (0.5-5°) pénalisent FORTEMENT la qualité
            elif 0.5 <= total_diff <= 5:
                micro_movements += 1
        
        # Pénalité FORTE pour les micro-mouvements
        penalty = micro_movements * 0.15  # Pénalité plus forte
        
        # Si trop de micro-mouvements, qualité = 0
        if micro_movements > 4:
            return 0.0
            
        # Qualité basée sur les mouvements significatifs uniquement
        quality = min(1.0, (significant_movement / 200) + (meaningful_changes / 6))
        quality = max(0.0, quality - penalty)
        
        return quality
    
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