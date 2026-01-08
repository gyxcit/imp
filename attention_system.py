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
    
    # Seuils de temps (en secondes) - VERSION ULTRA RAPIDE POUR TESTS
    THRESHOLDS = {
        'interaction_timeout': 3,       # 3 secondes sans interaction
        'semi_attentive': 8,            # 8 secondes
        'low_attention': 15,            # 15 secondes
        'no_attention': 30,             # 30 secondes
        'skip_burst_window': 20,        # Fenêtre pour détecter des skips rapides
        'pause_tolerance': 5,           # Tolérance pour pauses courtes
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
            'attention_level': 'attentif',
            'attention_score': 100,
            'last_interaction': time.time(),
            'interactions': [],
            'skips': [],
            'volume_changes': [],
            'pauses': [],
            'tab_switches': 0,
            'tab_switch_time': None,
            'current_song_start': None,
            'adaptive_actions': [],
        }
        
        self.adaptations = {
            'volume': 100,
            'music_style': 'engaging',
            'ui_intensity': 'high',
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
        
        print(f"[ATTENTION] Interaction: {interaction_type}")  # DEBUG
        
        # Traiter selon le type d'interaction
        if interaction_type == 'skip':
            self.state['skips'].append(now)
            self._clean_old_skips()
            print(f"[ATTENTION] Skips récents: {len(self.state['skips'])}")  # DEBUG
            
        elif interaction_type == 'volume':
            self.state['volume_changes'].append({
                'timestamp': now,
                'value': data.get('volume', 0)
            })
            print(f"[ATTENTION] Volume changé: {data.get('volume')}")  # DEBUG
            
        elif interaction_type == 'pause':
            self.state['pauses'].append(now)
            print(f"[ATTENTION] Pause enregistrée")  # DEBUG
            
        elif interaction_type == 'tab_hidden':
            self.state['tab_switches'] += 1
            self.state['tab_switch_time'] = now
            print(f"[ATTENTION] Tab caché (total: {self.state['tab_switches']})")  # DEBUG
            
        elif interaction_type == 'tab_visible':
            if self.state['tab_switch_time']:
                duration = now - self.state['tab_switch_time']
                if duration < 30:
                    self.state['attention_score'] = min(100, self.state['attention_score'] + 5)
                    print(f"[ATTENTION] Retour rapide, bonus +5")  # DEBUG
        
        # Recalculer le niveau d'attention
        self._calculate_attention()
        
        return self._get_current_state()
    
    def _clean_old_skips(self):
        """Nettoyer les skips de plus de 20 secondes"""
        now = time.time()
        window = self.THRESHOLDS['skip_burst_window']
        old_count = len(self.state['skips'])
        self.state['skips'] = [s for s in self.state['skips'] if now - s < window]
        new_count = len(self.state['skips'])
        if old_count != new_count:
            print(f"[ATTENTION] Nettoyage skips: {old_count} -> {new_count}")  # DEBUG
    
    def _calculate_attention(self):
        """
        Calculer le niveau d'attention basé sur plusieurs signaux
        Retourne un score de 0 (pas attentif) à 100 (très attentif)
        """
        now = time.time()
        score = 100
        old_score = self.state['attention_score']
        
        print(f"\n[ATTENTION] === Calcul du score ===")  # DEBUG
        
        # 1. Temps depuis la dernière interaction (40 points)
        time_since_interaction = now - self.state['last_interaction']
        interaction_penalty = 0
        
        if time_since_interaction > self.THRESHOLDS['no_attention']:  # 30s
            interaction_penalty = 40
        elif time_since_interaction > self.THRESHOLDS['low_attention']:  # 15s
            interaction_penalty = 30
        elif time_since_interaction > self.THRESHOLDS['semi_attentive']:  # 8s
            interaction_penalty = 15
        elif time_since_interaction > self.THRESHOLDS['interaction_timeout']:  # 3s
            interaction_penalty = 5
        
        score -= interaction_penalty
        print(f"[ATTENTION] Temps inactivité: {time_since_interaction:.1f}s -> Pénalité: -{interaction_penalty}")
        
        # 2. Taux de skip (25 points)
        recent_skips = len(self.state['skips'])
        skip_penalty = 0
        
        if recent_skips >= 5:
            skip_penalty = 25
        elif recent_skips >= 3:
            skip_penalty = 15
        elif recent_skips >= 1:
            skip_penalty = 5
        
        score -= skip_penalty
        print(f"[ATTENTION] Skips: {recent_skips} -> Pénalité: -{skip_penalty}")
        
        # 3. Ajustements manuels du volume (15 points) - BONUS
        recent_volume_changes = [
            v for v in self.state['volume_changes']
            if now - v['timestamp'] < 120
        ]
        volume_bonus = 0
        
        if len(recent_volume_changes) >= 3:
            volume_bonus = 10
        elif len(recent_volume_changes) >= 1:
            volume_bonus = 5
        
        score += volume_bonus
        print(f"[ATTENTION] Volume ajusté: {len(recent_volume_changes)} fois -> Bonus: +{volume_bonus}")
        
        # 4. Fréquence de pause/reprise (10 points)
        recent_pauses = [p for p in self.state['pauses'] if now - p < 300]
        pause_penalty = 0
        
        if len(recent_pauses) >= 5:
            pause_penalty = 10
        elif len(recent_pauses) >= 3:
            pause_penalty = 5
        
        score -= pause_penalty
        print(f"[ATTENTION] Pauses: {len(recent_pauses)} -> Pénalité: -{pause_penalty}")
        
        # 5. Changements d'onglet (10 points)
        tab_penalty = 0
        if self.state['tab_switches'] > 10:
            tab_penalty = 10
        elif self.state['tab_switches'] > 5:
            tab_penalty = 5
        
        score -= tab_penalty
        print(f"[ATTENTION] Changements tab: {self.state['tab_switches']} -> Pénalité: -{tab_penalty}")
        
        # Limiter entre 0 et 100
        score = max(0, min(100, score))
        self.state['attention_score'] = score
        
        # Déterminer le niveau d'attention
        old_level = self.state['attention_level']
        
        if score >= 75:
            self.state['attention_level'] = 'attentif'
        elif score >= 50:
            self.state['attention_level'] = 'semi-attentif'
        elif score >= 25:
            self.state['attention_level'] = 'peu-attentif'
        else:
            self.state['attention_level'] = 'pas-attentif'
        
        print(f"[ATTENTION] Score: {old_score} -> {score}")
        print(f"[ATTENTION] Niveau: {old_level} -> {self.state['attention_level']}")
        print(f"[ATTENTION] === Fin calcul ===\n")
        
        # Adapter automatiquement
        self._adapt_player()
    
    def _adapt_player(self):
        """
        Adapter le lecteur selon le niveau d'attention
        """
        level = self.state['attention_level']
        
        if level == 'attentif':
            self.adaptations['volume'] = 100
            self.adaptations['music_style'] = 'engaging'
            self.adaptations['ui_intensity'] = 'high'
            
        elif level == 'semi-attentif':
            self.adaptations['volume'] = 90
            self.adaptations['music_style'] = 'comfortable'
            self.adaptations['ui_intensity'] = 'medium'
            
        elif level == 'peu-attentif':
            self.adaptations['volume'] = 70
            self.adaptations['music_style'] = 'discrete'
            self.adaptations['ui_intensity'] = 'low'
            
        else:  # pas-attentif
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
        """Obtenir l'état complet SANS recalculer (lecture seule)"""
        # Recalculer UNIQUEMENT le temps depuis dernière interaction
        # SANS changer le score ni le niveau
        now = time.time()
        
        return {
            'attention_level': self.state['attention_level'],
            'attention_score': self.state['attention_score'],
            'adaptations': self.adaptations,
            'time_since_interaction': now - self.state['last_interaction'],
            'recent_skips': len(self.state['skips']),
            'tab_switches': self.state['tab_switches']
        }

    def check_and_update_attention(self):
        """
        Vérifier et mettre à jour l'attention (appelé périodiquement)
        Cette méthode DOIT être appelée toutes les X secondes pour détecter l'inactivité
        """
        print(f"\n[ATTENTION] === CHECK PÉRIODIQUE ===")
        self._calculate_attention()
        return self.get_state()
    
    def reset(self):
        """Réinitialiser le système"""
        print("[ATTENTION] === RESET DU SYSTÈME ===")
        self.__init__()