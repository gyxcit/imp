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
        this.isAdaptingVolume = false; // Flag pour éviter les boucles
        this.fadeInterval = null; // Intervalle pour le fade volume

        this.init();
    }

    async init() {
        console.log('🎯 Initialisation du système d\'adaptation d\'attention...');

        // Démarrer le monitoring
        this.startMonitoring();

        // Tracker la visibilité de l'onglet
        this.trackTabVisibility();

        // Créer l'indicateur d'attention dans l'UI
        this.createAttentionIndicator();

        // NOUVEAU: Tracker l'activité globale (souris, clavier, clics)
        this.setupGlobalListeners();

        // Charger l'état initial
        await this.updateState();
    }

    startMonitoring() {
        // Vérifier l'attention toutes les 2 secondes (PLUS RAPIDE)
        this.checkInterval = setInterval(() => {
            this.checkAttention();
        }, 2000);

        console.log('⏰ Monitoring d\'attention démarré (vérification toutes les 2s)');
    }

    async checkAttention() {
        try {
            const response = await fetch('/api/attention/state');
            const data = await response.json();

            const oldScore = this.state.attention_score;
            const newScore = data.attention_score;

            if (oldScore !== newScore) {
                console.log(`📊 Score changé: ${oldScore} → ${newScore}`);
            }

            this.state = data;

            // Appliquer les adaptations
            this.applyAdaptations();

            // Mettre à jour l'indicateur visuel
            this.updateIndicator();

            // Mettre à jour le widget d'infos
            this.updateInfoWidget();

        } catch (error) {
            console.error('❌ Erreur check attention:', error);
        }
    }

    async trackInteraction(type, data = {}) {
        this.lastInteractionTime = Date.now();

        console.log(`🔔 Tracking interaction: ${type}`, data);

        try {
            const response = await fetch('/api/attention/track', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type, data })
            });

            const result = await response.json();
            console.log('✅ Réponse tracking:', result.state);

            if (result.state) {
                this.state = result.state;
                this.applyAdaptations();
                this.updateIndicator();
                this.updateInfoWidget();
            }
        } catch (error) {
            console.error('❌ Erreur track interaction:', error);
        }
    }

    trackTabVisibility() {
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.tabVisible = false;
                this.trackInteraction('tab_hidden');
                console.log('👁️ Tab caché');
            } else {
                this.tabVisible = true;
                this.trackInteraction('tab_visible');
                console.log('👁️ Tab visible');
            }
        });
    }

    setupGlobalListeners() {
        // Tracker l'activité générale toutes les 2 secondes max
        const throttleDelay = 2000;
        let lastActivity = 0;

        const trackActivity = (type) => {
            const now = Date.now();
            if (now - lastActivity > throttleDelay) {
                lastActivity = now;
                // On envoie un event générique 'user_activity' qui maintiendra l'attention
                this.trackInteraction('user_activity', { source: type });
            }
        };

        // Clics et boutons souris (capture=true pour passer outre stopPropagation)
        document.addEventListener('mousedown', () => trackActivity('mousedown'), true);

        // Clavier
        document.addEventListener('keydown', () => trackActivity('keydown'), true);

        // Scroll & Molette (window pour être plus sûr)
        window.addEventListener('scroll', () => trackActivity('scroll'), true);
        window.addEventListener('wheel', () => trackActivity('wheel'), true);

        // Touch (mobile)
        document.addEventListener('touchstart', () => trackActivity('touchstart'), true);

        // Input changes
        document.addEventListener('input', () => trackActivity('input'), true);

        console.log('🖱️ Global listeners activés (sans mousemove)');
    }

    applyAdaptations() {
        const { volume, music_style, ui_intensity } = this.state.adaptations;

        console.log('🎨 Application adaptations:', { volume, music_style, ui_intensity });

        // 1. Adapter le volume progressivement
        this.adaptVolume(volume);

        // 2. Adapter le style musical (influencer le shuffle intelligent)
        this.adaptMusicStyle(music_style);

        // 3. Adapter l'interface visuelle
        this.adaptUI(ui_intensity);
    }

    cancelVolumeAdaptation() {
        if (this.fadeInterval) {
            clearInterval(this.fadeInterval);
            this.fadeInterval = null;
        }
        this.isAdaptingVolume = false;

        // Retirer la classe visuelle si elle existe
        const volumeSlider = document.getElementById('volumeSlider');
        if (volumeSlider) {
            volumeSlider.classList.remove('auto-updating');
        }

        console.log('🛑 Adaptation volume annulée par l\'utilisateur');
    }

    adaptVolume(targetVolume) {
        if (!window.audioElement) return;

        // Annuler toute adaptation en cours
        if (this.fadeInterval) {
            clearInterval(this.fadeInterval);
        }

        const currentVolume = window.audioElement.volume * 100;
        const diff = targetVolume - currentVolume;

        // Si la différence est minime, on ignore ou on applique directement
        if (Math.abs(diff) < 1) return;

        console.log(`🔊 Adaptation volume: ${currentVolume.toFixed(0)}% → ${targetVolume}%`);

        // Marquer qu'on est en train d'adapter le volume
        this.isAdaptingVolume = true;

        // Transition douce du volume (fade) - 60 FPS (16ms)
        // Durée de transition : environ 1 seconde
        const duration = 1000;
        const intervalTime = 16;
        const steps = duration / intervalTime;
        const increment = diff / steps;

        let step = 0;

        this.fadeInterval = setInterval(() => {
            if (step >= steps || !window.audioElement) {
                this.cancelVolumeAdaptation(); // Nettoyage propre
                return;
            }

            // Calculer le nouveau volume
            // On relit le volume courant au cas où il aurait changé légèrement
            let newVolume = (window.audioElement.volume * 100) + increment;

            // Bornes de sécurité
            newVolume = Math.max(0, Math.min(100, newVolume));

            // Mettre à jour le volume audio
            window.audioElement.volume = newVolume / 100;

            // Mettre à jour le slider visuel de manière synchronisée
            this.updateVolumeSlider(newVolume);

            // Mettre à jour le widget d'infos
            if (window.widgetManager && typeof window.widgetManager.updateVolume === 'function') {
                window.widgetManager.updateVolume(newVolume);
            }

            step++;
        }, intervalTime);
    }

    updateVolumeSlider(volume) {
        const volumeSlider = document.getElementById('volumeSlider');
        if (volumeSlider) {
            // Mettre à jour la valeur du slider
            volumeSlider.value = volume;

            // Ajouter une classe temporaire pour indiquer une mise à jour automatique
            volumeSlider.classList.add('auto-updating');

            // Retirer la classe après un court délai
            setTimeout(() => {
                volumeSlider.classList.remove('auto-updating');
            }, 100);
        }
    }

    adaptMusicStyle(style) {
        // Influencer le comportement du shuffle selon le style
        const body = document.body;

        // Retirer les anciennes classes
        body.classList.remove('music-engaging', 'music-comfortable', 'music-discrete', 'music-pause');

        // Ajouter la nouvelle classe
        body.classList.add(`music-${style}`);

        console.log(`🎵 Style musical: ${style}`);

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

        console.log(`🖥️ Intensité UI: ${intensity}`);

        // Adapter l'opacité des contrôles
        switch (intensity) {
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
            <div class="attention-label" id="attentionLabel">🎯 Attentif (100%)</div>
        `;

        document.body.appendChild(indicator);
        console.log('✅ Indicateur d\'attention créé');
    }

    updateIndicator() {
        const indicator = document.getElementById('attentionIndicator');
        if (!indicator) return;

        const { attention_level, attention_score } = this.state;

        const levelMap = {
            'attentif': { emoji: '🎯', label: 'Attentif', class: 'level-high' },
            'semi-attentif': { emoji: '👀', label: 'Semi-attentif', class: 'level-medium' },
            'peu-attentif': { emoji: '💭', label: 'Peu attentif', class: 'level-low' },
            'pas-attentif': { emoji: '😴', label: 'Pas attentif', class: 'level-none' }
        };

        const level = levelMap[attention_level] || levelMap['attentif'];
        const score = Math.round(attention_score);

        // Mettre à jour l'indicateur
        const label = indicator.querySelector('.attention-label');
        const fill = indicator.querySelector('.attention-level-fill');

        if (label) {
            label.textContent = `${level.emoji} ${level.label} (${score}%)`;
        }

        if (fill) {
            fill.style.width = `${score}%`;
            fill.className = `attention-level-fill ${level.class}`;
        }

        indicator.className = `attention-indicator ${level.class}`;
    }

    updateInfoWidget() {
        const { attention_score } = this.state;
        const score = Math.round(attention_score);

        // Mettre à jour via le WidgetManager si disponible
        if (window.widgetManager && typeof window.widgetManager.updateAttentionScore === 'function') {
            window.widgetManager.updateAttentionScore(score);
            // Mettre à jour aussi le volume affiché
            if (this.state.adaptations && typeof window.widgetManager.updateVolume === 'function') {
                window.widgetManager.updateVolume(this.state.adaptations.volume);
            }
            console.log(`📊 Widget info mis à jour: ${score}/100`);
        }
    }

    async updateState() {
        try {
            const response = await fetch('/api/attention/state');
            const data = await response.json();

            console.log('📥 État initial chargé:', data);

            this.state = data;
            this.applyAdaptations();
            this.updateIndicator();
            this.updateInfoWidget();
        } catch (error) {
            console.error('❌ Erreur update state:', error);
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
window.trackAttentionInteraction = function (type, data) {
    if (attentionAdapter) {
        attentionAdapter.trackInteraction(type, data);
    }
};

window.getAttentionState = function () {
    return attentionAdapter ? attentionAdapter.state : null;
};

// Exposer la vérification si on est en train d'adapter le volume
window.isAdaptingVolume = function () {
    return attentionAdapter ? attentionAdapter.isAdaptingVolume : false;
};

// Exposer la fonction d'annulation
window.cancelVolumeAdaptation = function () {
    if (attentionAdapter) {
        attentionAdapter.cancelVolumeAdaptation();
    }
};