# analyzers/emotion_fusion.py
from typing import Dict

class EmotionFusion:
    def __init__(self):
        self.history = []
        self.max_history = 10
    
    def fuse_signals(self, video_state: Dict, audio_state: Dict) -> Dict:
        """
        Fusionne les analyses vidéo et audio
        Returns: état unifié pour attention_system
        """
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
    
    def _compute_attention(self, video: Dict, audio: Dict) -> int:
        """Calcul attention 0-100"""
        score = 100
        
        # Pénalité si pas de visage
        if not video.get('face_detected'):
            score -= 40
        
        # Bonus engagement visuel
        score = (score + video.get('engagement_score', 0)) / 2
        
        # Bonus si parole (interaction)
        if audio.get('speech_detected'):
            score = min(100, score + 10)
        
        return int(score)
    
    def _determine_emotion(self, video: Dict, audio: Dict) -> str:
        """Émotion dominante"""
        v_emotion = video.get('emotion_hint', 'neutral')
        a_emotion = audio.get('emotion_hint', 'neutral')
        
        # Vidéo prioritaire
        if v_emotion != 'neutral':
            return v_emotion
        
        return a_emotion
    
    def _detect_pattern(self, video: Dict, audio: Dict) -> str:
        """Détection patterns comportementaux"""
        if not video.get('face_detected') and not audio.get('speech_detected'):
            return 'absent'
        
        # Tête penchée + silence = sommeil?
        head_pose = video.get('head_pose', {})
        if abs(head_pose.get('pitch', 0)) > 30:
            return 'drowsy'
        
        return 'normal'