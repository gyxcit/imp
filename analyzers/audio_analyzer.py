# analyzers/audio_analyzer.py
import numpy as np
import librosa
from typing import Dict

class AudioAnalyzer:
    def __init__(self, sample_rate=16000):
        self.sample_rate = sample_rate
        self.state = {
            'speech_detected': False,
            'energy_level': 0,
            'pitch': 0,
            'emotion_hint': 'neutral'
        }
    
    def analyze_audio(self, audio_chunk: np.ndarray) -> Dict:
        """
        Analyse un chunk audio
        Returns: dict avec speech_detected, energy_level, pitch, emotion_hint
        """
        # Détection parole (énergie RMS)
        rms = librosa.feature.rms(y=audio_chunk)[0]
        energy = float(np.mean(rms))
        
        self.state['energy_level'] = int(energy * 100)
        self.state['speech_detected'] = energy > 0.02
        
        if self.state['speech_detected']:
            # Extraction pitch
            pitches, magnitudes = librosa.piptrack(
                y=audio_chunk,
                sr=self.sample_rate
            )
            pitch = float(np.mean(pitches[pitches > 0]))
            self.state['pitch'] = pitch
            
            # Émotion basique (énergie haute = excité)
            if energy > 0.05:
                self.state['emotion_hint'] = 'excited'
            elif energy < 0.01:
                self.state['emotion_hint'] = 'calm'
            else:
                self.state['emotion_hint'] = 'neutral'
        
        return self.state