"""
Système d'adaptation comportementale basé sur des règles
Estime le niveau d'attention sans IA
"""

import time
from datetime import datetime, timedelta
from typing import Dict, List, Tuple
import json

class AttentionDetector:
    """
    Détecte le niveau d'attention de l'utilisateur basé sur des signaux comportementaux
    États: attentif, semi-attentif, peu-attentif, pas-attentif
    """
    
    # Seuils de temps (en secondes)
    THRESHOLDS = {
        'interaction_timeout': 30,      # Temps sans interaction
        'semi_attentive': 120,          # 2 minutes
        'low_attention': 300,           # 5 minutes
        'no_attention': 600,            # 10 minutes
        'skip_burst_window': 60,        # Fenêtre pour détecter des skips rapides
        'pause_tolerance': 10,          # Tolérance pour pauses courtes
    }
    
    # Poids pour le calcul du score d'attention (0-100)
    WEIGHTS = {
        'time_since_interaction': 40,   # Temps sans interaction
        'skip_rate': 25,                # Fréquence de skips
        'manual_adjustments': 15,       # Ajustements manuels
        'pause_frequency': 10,          # Fréquence de pause/reprise
        'tab_switches': 10,             # Changements d'onglet
    }
    
    def __init__(self):
        self.state = {
            'attention_level': 'attentif',  # attentif, semi-attentif, peu-attentif, pas-attentif
            'attention_score': 100,          # Score 0-100
            'last_interaction': time.time(),
            'interactions': [],              # Historique des interactions
            'skips': [],                     # Historique des skips
            'volume_changes': [],            # Historique des changements de volume
            'pauses': [],                    # Historique des pauses
            'tab_switches': 0,               # Nombre de changements d'onglet
            'tab_switch_time': None,
            'current_song_start': None,
            'adaptive_actions': [],          # Actions adaptatives prises
        }
        
        self.adaptations = {
            'volume': 100,                   # Volume adaptatif (0-100)
            'music_style': 'engaging',       # engaging, comfortable, discrete, pause
            'ui_intensity': 'high',          # high, medium, low, minimal
        }
    
    def track_interaction(self, interaction_type: str, data: dict = None):
        """
        Enregistrer une interaction utilisateur
        Types: play, pause, skip, volume, seek, playlist, tab_visible, tab_hidden
        """
        now = time.time()
        
        interaction = {
            'type': interaction_type,
            'timestamp': now,
            'data': data or {}
        }
        
        self.state['interactions'].append(interaction)
        self.state['last_interaction'] = now
        
        # Traiter selon le type d'interaction
        if interaction_type == 'skip':
            self.state['skips'].append(now)
            self._clean_old_skips()
            
        elif interaction_type == 'volume':
            self.state['volume_changes'].append({
                'timestamp': now,
                'value': data.get('volume', 0)
            })
            
        elif interaction_type == 'pause':
            self.state['pauses'].append(now)
            
        elif interaction_type == 'tab_hidden':
            self.state['tab_switches'] += 1
            self.state['tab_switch_time'] = now
            
        elif interaction_type == 'tab_visible':
            if self.state['tab_switch_time']:
                duration = now - self.state['tab_switch_time']
                # Si l'utilisateur est revenu rapidement, c'est positif
                if duration < 30:
                    self.state['attention_score'] = min(100, self.state['attention_score'] + 5)
        
        # Recalculer le niveau d'attention
        self._calculate_attention()
        
        return self._get_current_state()
    
    def _clean_old_skips(self):
        """Nettoyer les skips de plus d'une minute"""
        now = time.time()
        window = self.THRESHOLDS['skip_burst_window']
        self.state['skips'] = [s for s in self.state['skips'] if now - s < window]
    
    def _calculate_attention(self):
        """
        Calculer le niveau d'attention basé sur plusieurs signaux
        Retourne un score de 0 (pas attentif) à 100 (très attentif)
        """
        now = time.time()
        score = 100
        
        # 1. Temps depuis la dernière interaction (40 points)
        time_since_interaction = now - self.state['last_interaction']
        if time_since_interaction > self.THRESHOLDS['no_attention']:
            score -= 40
        elif time_since_interaction > self.THRESHOLDS['low_attention']:
            score -= 30
        elif time_since_interaction > self.THRESHOLDS['semi_attentive']:
            score -= 15
        elif time_since_interaction > self.THRESHOLDS['interaction_timeout']:
            score -= 5
        
        # 2. Taux de skip (25 points)
        recent_skips = len(self.state['skips'])
        if recent_skips >= 5:  # 5+ skips en 1 minute
            score -= 25
        elif recent_skips >= 3:
            score -= 15
        elif recent_skips >= 1:
            score -= 5
        
        # 3. Ajustements manuels du volume (15 points) - Positif si ajustements
        recent_volume_changes = [
            v for v in self.state['volume_changes']
            if now - v['timestamp'] < 120  # 2 dernières minutes
        ]
        if len(recent_volume_changes) >= 3:
            score += 10  # Beaucoup d'ajustements = engagement
        elif len(recent_volume_changes) >= 1:
            score += 5
        
        # 4. Fréquence de pause/reprise (10 points)
        recent_pauses = [p for p in self.state['pauses'] if now - p < 300]  # 5 minutes
        if len(recent_pauses) >= 5:
            score -= 10  # Beaucoup de pauses = distraction
        elif len(recent_pauses) >= 3:
            score -= 5
        
        # 5. Changements d'onglet (10 points)
        if self.state['tab_switches'] > 10:
            score -= 10
        elif self.state['tab_switches'] > 5:
            score -= 5
        
        # Limiter entre 0 et 100
        score = max(0, min(100, score))
        self.state['attention_score'] = score
        
        # Déterminer le niveau d'attention
        if score >= 75:
            self.state['attention_level'] = 'attentif'
        elif score >= 50:
            self.state['attention_level'] = 'semi-attentif'
        elif score >= 25:
            self.state['attention_level'] = 'peu-attentif'
        else:
            self.state['attention_level'] = 'pas-attentif'
        
        # Adapter automatiquement
        self._adapt_player()
    
    def _adapt_player(self):
        """
        Adapter le lecteur selon le niveau d'attention
        """
        level = self.state['attention_level']
        
        if level == 'attentif':
            # Utilisateur engagé
            self.adaptations['volume'] = 100
            self.adaptations['music_style'] = 'engaging'
            self.adaptations['ui_intensity'] = 'high'
            
        elif level == 'semi-attentif':
            # Utilisateur moyennement engagé
            self.adaptations['volume'] = 90
            self.adaptations['music_style'] = 'comfortable'
            self.adaptations['ui_intensity'] = 'medium'
            
        elif level == 'peu-attentif':
            # Utilisateur distrait
            self.adaptations['volume'] = 70
            self.adaptations['music_style'] = 'discrete'
            self.adaptations['ui_intensity'] = 'low'
            
        else:  # pas-attentif
            # Utilisateur absent
            self.adaptations['volume'] = 40
            self.adaptations['music_style'] = 'pause'
            self.adaptations['ui_intensity'] = 'minimal'
        
        # Enregistrer l'action adaptative
        self.state['adaptive_actions'].append({
            'timestamp': time.time(),
            'level': level,
            'adaptations': dict(self.adaptations)
        })
    
    def _get_current_state(self):
        """Retourner l'état actuel pour le frontend"""
        return {
            'attention_level': self.state['attention_level'],
            'attention_score': self.state['attention_score'],
            'adaptations': self.adaptations,
            'time_since_interaction': time.time() - self.state['last_interaction'],
            'recent_skips': len(self.state['skips']),
            'tab_switches': self.state['tab_switches']
        }
    
    def get_state(self):
        """Obtenir l'état complet"""
        return self._get_current_state()
    
    def reset(self):
        """Réinitialiser le système"""
        self.__init__()