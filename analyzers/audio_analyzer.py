# analyzers/audio_analyzer.py
import numpy as np
from typing import Dict
import warnings

# Supprimer les warnings de librosa
warnings.filterwarnings('ignore')

class AudioAnalyzer:
    def __init__(self, sample_rate=16000):
        self.sample_rate = sample_rate
        self.state = {
            'speech_detected': False,
            'energy_level': 0,
            'pitch': 0,
            'emotion_hint': 'neutral'
        }
        self._librosa_available = False
        
        # Essayer d'importer librosa
        try:
            import librosa
            self._librosa = librosa
            self._librosa_available = True
        except ImportError:
            print("⚠️ librosa non disponible, mode simplifié")
    
    def analyze_audio(self, audio_chunk: np.ndarray) -> Dict:
        """
        Analyse un chunk audio
        Returns: dict avec speech_detected, energy_level, pitch, emotion_hint
        """
        try:
            # Vérifier que le chunk n'est pas vide
            if len(audio_chunk) == 0:
                return self.state
            
            # Calcul RMS simple (sans librosa si nécessaire)
            rms = np.sqrt(np.mean(audio_chunk ** 2))
            energy = float(rms)
            
            # Normaliser l'énergie (typiquement entre 0 et 1)
            self.state['energy_level'] = min(100, int(energy * 1000))
            self.state['speech_detected'] = energy > 0.01
            
            if self.state['speech_detected']:
                # Estimation pitch simple via zero-crossing rate
                zero_crossings = np.sum(np.abs(np.diff(np.sign(audio_chunk)))) / 2
                estimated_pitch = (zero_crossings * self.sample_rate) / (2 * len(audio_chunk))
                self.state['pitch'] = float(estimated_pitch)
                
                # Émotion basique basée sur énergie
                if energy > 0.05:
                    self.state['emotion_hint'] = 'excited'
                elif energy > 0.02:
                    self.state['emotion_hint'] = 'neutral'
                else:
                    self.state['emotion_hint'] = 'calm'
            else:
                self.state['emotion_hint'] = 'neutral'
                self.state['pitch'] = 0
            
            return self.state
            
        except Exception as e:
            # En cas d'erreur, retourner l'état par défaut
            return self.state
            
        except Exception as e:
            print(f"❌ Erreur AudioAnalyzer: {e}")
            return self.state