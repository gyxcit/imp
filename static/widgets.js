/**
 * Système de widgets modulaires
 */

class WidgetManager {
    constructor() {
        this.widgets = [];
        this.shuffleMode = false;
        this.repeatMode = false;
        this.init();
    }

    async init() {
        console.log('Initialisation des widgets...');
        this.createInfoPanel();
        this.createQuickControls();
        this.initRippleEffect();
        this.initTooltips();
        
        // Charger l'état initial des modes
        await this.loadModes();
    }

    async loadModes() {
        try {
            const response = await fetch('/api/get-modes');
            const data = await response.json();
            this.shuffleMode = data.shuffle;
            this.repeatMode = data.repeat;
            this.updateButtonStates();
        } catch (error) {
            console.error('Erreur chargement modes:', error);
        }
    }

    createInfoPanel() {
        const panel = document.createElement('div');
        panel.className = 'info-panel';
        panel.id = 'infoPanel';
        panel.innerHTML = `
            <div class="info-panel-header">Statistiques</div>
            <div class="info-stat">
                <span class="info-stat-label">Chansons</span>
                <span class="info-stat-value" id="statTotalSongs">0</span>
            </div>
            <div class="info-stat">
                <span class="info-stat-label">Durée totale</span>
                <span class="info-stat-value" id="statTotalDuration">0:00</span>
            </div>
            <div class="info-stat">
                <span class="info-stat-label">En cours</span>
                <span class="info-stat-value">
                    <span class="status-badge" id="statStatus">
                        <span class="status-dot"></span>
                        <span>Arrêté</span>
                    </span>
                </span>
            </div>
        `;
        
        document.body.appendChild(panel);
        console.log('Panneau d\'infos créé');
        
        // Afficher après 1 seconde
        setTimeout(() => {
            panel.classList.add('show');
        }, 1000);
    }

    createQuickControls() {
        const controls = document.createElement('div');
        controls.className = 'quick-controls';
        controls.innerHTML = `
            <button class="quick-control-btn" id="quickShuffle" data-tooltip="Aléatoire">
                <svg viewBox="0 0 24 24">
                    <path d="M10.59 9.17L5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41l-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z"/>
                </svg>
            </button>
            <button class="quick-control-btn" id="quickRepeat" data-tooltip="Répéter">
                <svg viewBox="0 0 24 24">
                    <path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z"/>
                </svg>
            </button>
            <button class="quick-control-btn" id="quickLike" data-tooltip="J'aime">
                <svg viewBox="0 0 24 24">
                    <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                </svg>
            </button>
            <button class="quick-control-btn" id="quickInfo" data-tooltip="Infos">
                <svg viewBox="0 0 24 24">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
                </svg>
            </button>
        `;
        
        document.body.appendChild(controls);
        console.log('Contrôles rapides créés');
        
        // Event listeners
        document.getElementById('quickInfo')?.addEventListener('click', () => {
            this.toggleInfoPanel();
        });
        
        document.getElementById('quickShuffle')?.addEventListener('click', () => {
            this.toggleShuffle();
        });
        
        document.getElementById('quickRepeat')?.addEventListener('click', () => {
            this.toggleRepeat();
        });
        
        document.getElementById('quickLike')?.addEventListener('click', () => {
            this.toggleLike();
        });
    }

    async toggleShuffle() {
        try {
            const response = await fetch('/api/toggle-shuffle', {
                method: 'POST'
            });
            const data = await response.json();
            this.shuffleMode = data.shuffle;
            this.updateButtonStates();
            
            const message = this.shuffleMode ? 'Mode aléatoire activé 🎲' : 'Mode aléatoire désactivé';
            this.showToast(message);
        } catch (error) {
            console.error('Erreur toggle shuffle:', error);
        }
    }

    async toggleRepeat() {
        try {
            const response = await fetch('/api/toggle-repeat', {
                method: 'POST'
            });
            const data = await response.json();
            this.repeatMode = data.repeat;
            this.updateButtonStates();
            
            const message = this.repeatMode ? 'Répétition activée 🔁' : 'Répétition désactivée';
            this.showToast(message);
        } catch (error) {
            console.error('Erreur toggle repeat:', error);
        }
    }

    toggleLike() {
        const btn = document.getElementById('quickLike');
        btn.classList.toggle('active');
        
        if (btn.classList.contains('active')) {
            this.showToast('Ajouté aux favoris ❤️');
        } else {
            this.showToast('Retiré des favoris');
        }
    }

    updateButtonStates() {
        const shuffleBtn = document.getElementById('quickShuffle');
        const repeatBtn = document.getElementById('quickRepeat');
        
        if (shuffleBtn) {
            if (this.shuffleMode) {
                shuffleBtn.classList.add('active');
            } else {
                shuffleBtn.classList.remove('active');
            }
        }
        
        if (repeatBtn) {
            if (this.repeatMode) {
                repeatBtn.classList.add('active');
            } else {
                repeatBtn.classList.remove('active');
            }
        }
    }

    toggleInfoPanel() {
        const panel = document.getElementById('infoPanel');
        if (panel) {
            panel.classList.toggle('show');
        }
    }

    updateStats(totalSongs, totalDuration, status) {
        const totalSongsEl = document.getElementById('statTotalSongs');
        const totalDurationEl = document.getElementById('statTotalDuration');
        const statusEl = document.getElementById('statStatus');
        
        if (totalSongsEl) {
            totalSongsEl.textContent = totalSongs || 0;
        }
        
        if (totalDurationEl) {
            totalDurationEl.textContent = totalDuration || '0:00';
        }
        
        if (statusEl) {
            if (status === 'playing') {
                statusEl.className = 'status-badge playing';
                statusEl.innerHTML = '<span class="status-dot"></span><span>En lecture</span>';
            } else if (status === 'paused') {
                statusEl.className = 'status-badge paused';
                statusEl.innerHTML = '<span class="status-dot"></span><span>En pause</span>';
            } else {
                statusEl.className = 'status-badge';
                statusEl.innerHTML = '<span>Arrêté</span>';
            }
        }
    }

    initRippleEffect() {
        document.addEventListener('click', (e) => {
            if (e.target.closest('.btn, .file-btn, .quick-control-btn')) {
                const button = e.target.closest('.btn, .file-btn, .quick-control-btn');
                const ripple = document.createElement('span');
                ripple.className = 'ripple';
                
                const rect = button.getBoundingClientRect();
                const size = Math.max(rect.width, rect.height);
                const x = e.clientX - rect.left - size / 2;
                const y = e.clientY - rect.top - size / 2;
                
                ripple.style.width = ripple.style.height = `${size}px`;
                ripple.style.left = `${x}px`;
                ripple.style.top = `${y}px`;
                
                button.style.position = 'relative';
                button.style.overflow = 'hidden';
                button.appendChild(ripple);
                
                setTimeout(() => ripple.remove(), 600);
            }
        });
    }

    initTooltips() {
        const tooltip = document.createElement('div');
        tooltip.className = 'custom-tooltip';
        tooltip.id = 'customTooltip';
        document.body.appendChild(tooltip);
        
        document.addEventListener('mouseover', (e) => {
            const target = e.target.closest('[data-tooltip]');
            if (target) {
                const text = target.getAttribute('data-tooltip');
                tooltip.textContent = text;
                tooltip.classList.add('show');
                this.updateTooltipPosition(e, tooltip);
            }
        });
        
        document.addEventListener('mousemove', (e) => {
            if (tooltip.classList.contains('show')) {
                this.updateTooltipPosition(e, tooltip);
            }
        });
        
        document.addEventListener('mouseout', (e) => {
            const target = e.target.closest('[data-tooltip]');
            if (target) {
                tooltip.classList.remove('show');
            }
        });
    }

    updateTooltipPosition(e, tooltip) {
        const x = e.clientX;
        const y = e.clientY - 40;
        tooltip.style.left = `${x}px`;
        tooltip.style.top = `${y}px`;
        tooltip.style.transform = 'translateX(-50%)';
    }

    showToast(message) {
        if (window.showNotification) {
            window.showNotification(message);
        }
    }
}

// Initialiser les widgets au chargement
let widgetManager;
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM chargé, création du WidgetManager...');
    widgetManager = new WidgetManager();
});

// Exposer les fonctions pour mise à jour depuis script.js
window.updateWidgets = function(songTitle, isPlaying, totalSongs) {
    console.log('Mise à jour widgets:', songTitle, isPlaying, totalSongs);
    if (widgetManager) {
        const status = isPlaying ? 'playing' : 'paused';
        widgetManager.updateStats(totalSongs, '0:00', status);
    }
};