/**
 * Système d'adaptation comportementale sans IA
 * Détecte le niveau d'attention et adapte le lecteur
 */

class AttentionAdapter {
    constructor() {
        this.state = {
            attention_level: 'attentif',
            attention_score: 100,
            adaptations: {
                volume: 100,
                music_style: 'engaging',
                ui_intensity: 'high'
            }
        };
        
        this.lastInteractionTime = Date.now();
        this.checkInterval = null;
        this.tabVisible = true;
        
        this.init();
    }

    async init() {
        console.log('Initialisation du système d\'adaptation d\'attention...');
        
        // Démarrer le monitoring
        this.startMonitoring();
        
        // Tracker la visibilité de l'onglet
        this.trackTabVisibility();
        
        // Créer l'indicateur d'attention dans l'UI
        this.createAttentionIndicator();
        
        // Charger l'état initial
        await this.updateState();
    }

    startMonitoring() {
        // Vérifier l'attention toutes les 10 secondes
        this.checkInterval = setInterval(() => {
            this.checkAttention();
        }, 10000);
    }

    async checkAttention() {
        try {
            const response = await fetch('/api/attention/state');
            const data = await response.json();
            
            this.state = data;
            
            // Appliquer les adaptations
            this.applyAdaptations();
            
            // Mettre à jour l'indicateur visuel
            this.updateIndicator();
            
        } catch (error) {
            console.error('Erreur check attention:', error);
        }
    }

    async trackInteraction(type, data = {}) {
        this.lastInteractionTime = Date.now();
        
        try {
            const response = await fetch('/api/attention/track', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type, data })
            });
            
            const result = await response.json();
            if (result.state) {
                this.state = result.state;
                this.applyAdaptations();
                this.updateIndicator();
            }
        } catch (error) {
            console.error('Erreur track interaction:', error);
        }
    }

    trackTabVisibility() {
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.tabVisible = false;
                this.trackInteraction('tab_hidden');
            } else {
                this.tabVisible = true;
                this.trackInteraction('tab_visible');
            }
        });
    }

    applyAdaptations() {
        const { volume, music_style, ui_intensity } = this.state.adaptations;
        
        // 1. Adapter le volume progressivement
        this.adaptVolume(volume);
        
        // 2. Adapter le style musical (influencer le shuffle intelligent)
        this.adaptMusicStyle(music_style);
        
        // 3. Adapter l'interface visuelle
        this.adaptUI(ui_intensity);
    }

    adaptVolume(targetVolume) {
        if (!window.audioElement) return;
        
        const currentVolume = window.audioElement.volume * 100;
        const diff = targetVolume - currentVolume;
        
        // Transition douce du volume (fade)
        if (Math.abs(diff) > 5) {
            const steps = 20;
            const increment = diff / steps;
            let step = 0;
            
            const fadeInterval = setInterval(() => {
                if (step >= steps || !window.audioElement) {
                    clearInterval(fadeInterval);
                    return;
                }
                
                const newVolume = currentVolume + (increment * step);
                window.audioElement.volume = Math.max(0, Math.min(1, newVolume / 100));
                
                // Mettre à jour le slider visuel
                const volumeSlider = document.getElementById('volumeSlider');
                if (volumeSlider) {
                    volumeSlider.value = newVolume;
                }
                
                step++;
            }, 50); // Transition sur 1 seconde
        }
    }

    adaptMusicStyle(style) {
        // Influencer le comportement du shuffle selon le style
        const body = document.body;
        
        // Retirer les anciennes classes
        body.classList.remove('music-engaging', 'music-comfortable', 'music-discrete', 'music-pause');
        
        // Ajouter la nouvelle classe
        body.classList.add(`music-${style}`);
        
        // Si "pause" et utilisateur pas attentif depuis longtemps
        if (style === 'pause' && window.isPlaying) {
            // Suggérer de mettre en pause (notification douce)
            this.suggestPause();
        }
    }

    adaptUI(intensity) {
        const playerContainer = document.querySelector('.player-container');
        if (!playerContainer) return;
        
        // Retirer les anciennes classes
        playerContainer.classList.remove('ui-high', 'ui-medium', 'ui-low', 'ui-minimal');
        
        // Ajouter la nouvelle classe
        playerContainer.classList.add(`ui-${intensity}`);
        
        // Adapter l'opacité des contrôles
        switch(intensity) {
            case 'high':
                this.setControlsOpacity(1);
                break;
            case 'medium':
                this.setControlsOpacity(0.9);
                break;
            case 'low':
                this.setControlsOpacity(0.7);
                break;
            case 'minimal':
                this.setControlsOpacity(0.5);
                break;
        }
    }

    setControlsOpacity(opacity) {
        const controls = document.querySelectorAll('.controls, .file-controls, .quick-controls');
        controls.forEach(control => {
            control.style.opacity = opacity;
            control.style.transition = 'opacity 2s ease';
        });
    }

    suggestPause() {
        // Notification subtile suggérant une pause
        if (window.showNotification) {
            window.showNotification('💤 Toujours là ? Profitez d\'une petite pause !');
        }
    }

    createAttentionIndicator() {
        const indicator = document.createElement('div');
        indicator.className = 'attention-indicator';
        indicator.id = 'attentionIndicator';
        indicator.innerHTML = `
            <div class="attention-level-bar">
                <div class="attention-level-fill" id="attentionLevelFill"></div>
            </div>
            <div class="attention-label" id="attentionLabel">Attentif</div>
        `;
        
        document.body.appendChild(indicator);
    }

    updateIndicator(state) {
        const indicator = document.getElementById('attentionIndicator');
        if (!indicator) return;
        
        const levelMap = {
            'attentif': { emoji: '🎯', label: 'Attentif', class: 'level-high' },
            'semi-attentif': { emoji: '👀', label: 'Semi-attentif', class: 'level-medium' },
            'peu-attentif': { emoji: '💭', label: 'Peu attentif', class: 'level-low' },
            'pas-attentif': { emoji: '😴', label: 'Pas attentif', class: 'level-none' }
        };
        
        const level = levelMap[state.attention_level] || levelMap['attentif'];
        const score = Math.round(state.attention_score);
        
        // Mettre à jour l'indicateur
        const label = indicator.querySelector('.attention-label');
        const fill = indicator.querySelector('.attention-level-fill');
        
        if (label) {
            label.textContent = `${level.emoji} ${level.label}`;
        }
        
        if (fill) {
            fill.style.width = `${score}%`;
            fill.className = `attention-level-fill ${level.class}`;
        }
        
        indicator.className = `attention-indicator ${level.class}`;
        
        // Mettre à jour le widget d'infos
        if (window.widgetManager) {
            window.widgetManager.updateAttentionScore(score);
        }
    }

    async updateState() {
        try {
            const response = await fetch('/api/attention/state');
            const data = await response.json();
            this.state = data;
            this.applyAdaptations();
            this.updateIndicator();
        } catch (error) {
            console.error('Erreur update state:', error);
        }
    }

    destroy() {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
        }
    }
}

// Initialiser le système
let attentionAdapter;
document.addEventListener('DOMContentLoaded', () => {
    attentionAdapter = new AttentionAdapter();
});

// Exposer les fonctions pour intégration avec script.js
window.trackAttentionInteraction = function(type, data) {
    if (attentionAdapter) {
        attentionAdapter.trackInteraction(type, data);
    }
};

window.getAttentionState = function() {
    return attentionAdapter ? attentionAdapter.state : null;
};