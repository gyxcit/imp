/**
 * Système d'analytics comportemental et adaptation de l'interface
 */

class BehavioralAnalytics {
    constructor() {
        this.sessionStartTime = null;
        this.currentSong = null;
        this.songStartTime = null;
        this.songDuration = 0;
        this.isTracking = false;
        this.insightsPanelVisible = false;
        
        this.init();
    }

    async init() {
        console.log('Initialisation du système d\'analytics...');
        
        // Démarrer une session
        await this.startSession();
        
        // Charger les stats initiales
        await this.loadStats();
        
        // Créer le panneau d'insights
        this.createInsightsPanel();
    }

    async startSession() {
        try {
            await fetch('/api/analytics/start-session', {
                method: 'POST'
            });
            this.sessionStartTime = Date.now();
            console.log('Session d\'analytics démarrée');
        } catch (error) {
            console.error('Erreur démarrage session:', error);
        }
    }

    trackSongStart(songFilename, duration) {
        this.currentSong = songFilename;
        this.songStartTime = Date.now();
        this.songDuration = duration;
        this.isTracking = true;
        
        fetch('/api/analytics/song-start', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ song_id: songFilename })
        }).catch(err => console.error('Erreur track start:', err));
    }

    trackSongEnd(completed = false) {
        if (!this.isTracking || !this.currentSong) return;
        
        const listenedDuration = (Date.now() - this.songStartTime) / 1000;
        
        fetch('/api/analytics/song-end', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                song_id: this.currentSong,
                duration: this.songDuration,
                listened_duration: listenedDuration,
                completed: completed
            })
        }).catch(err => console.error('Erreur track end:', err));
        
        this.isTracking = false;
        this.currentSong = null;
    }

    trackSkip(songFilename) {
        fetch('/api/analytics/song-skip', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ song_id: songFilename })
        }).catch(err => console.error('Erreur track skip:', err));
    }

    async loadStats() {
        try {
            const response = await fetch('/api/analytics/get-stats');
            const stats = await response.json();
            console.log('Statistiques chargées:', stats);
            return stats;
        } catch (error) {
            console.error('Erreur chargement stats:', error);
            return null;
        }
    }

    createInsightsPanel() {
        const panel = document.createElement('div');
        panel.className = 'insights-panel';
        panel.id = 'insightsPanel';
        panel.innerHTML = `
            <div class="insights-header">
                <svg viewBox="0 0 24 24" width="20" height="20">
                    <path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z"/>
                </svg>
                <span>Insights personnalisés</span>
                <button class="insights-close-btn" id="insightsCloseBtn">
                    <svg viewBox="0 0 24 24" width="16" height="16">
                        <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                    </svg>
                </button>
            </div>
            <div class="insights-content" id="insightsContent">
                <div class="insights-loading">
                    <div class="spinner"></div>
                    <span>Analyse de vos habitudes d'écoute...</span>
                </div>
            </div>
        `;
        
        document.body.appendChild(panel);
        
        // Event listeners
        document.getElementById('insightsCloseBtn').addEventListener('click', () => {
            this.hideInsights();
        });
        
        // Afficher après 2 secondes
        setTimeout(() => {
            this.updateInsights();
        }, 2000);
    }

    async updateInsights() {
        const stats = await this.loadStats();
        if (!stats) return;
        
        const content = document.getElementById('insightsContent');
        const patterns = stats.listening_patterns;
        const preferences = stats.preferences;
        const adaptive = stats.adaptive_settings;
        
        content.innerHTML = `
            <div class="insight-card">
                <div class="insight-icon">📊</div>
                <div class="insight-text">
                    <div class="insight-title">Sessions d'écoute</div>
                    <div class="insight-value">${patterns.total_sessions} sessions</div>
                </div>
            </div>
            
            <div class="insight-card">
                <div class="insight-icon">${patterns.skip_rate < 20 ? '✅' : patterns.skip_rate < 40 ? '⚠️' : '❌'}</div>
                <div class="insight-text">
                    <div class="insight-title">Taux de skip</div>
                    <div class="insight-value">${patterns.skip_rate.toFixed(1)}%</div>
                </div>
            </div>
            
            <div class="insight-card">
                <div class="insight-icon">🎯</div>
                <div class="insight-text">
                    <div class="insight-title">Taux de complétion</div>
                    <div class="insight-value">${patterns.completion_rate.toFixed(1)}%</div>
                </div>
            </div>
            
            <div class="insight-separator"></div>
            
            <div class="insight-adaptive">
                <div class="insight-adaptive-header">Adaptations actives</div>
                <div class="insight-adaptive-items">
                    <div class="insight-adaptive-item">
                        <span class="adaptive-label">Interface</span>
                        <span class="adaptive-badge ${adaptive.ui_complexity}">${adaptive.ui_complexity}</span>
                    </div>
                    <div class="insight-adaptive-item">
                        <span class="adaptive-label">Recommandations</span>
                        <span class="adaptive-badge ${adaptive.recommendation_aggressiveness}">${adaptive.recommendation_aggressiveness}</span>
                    </div>
                    ${adaptive.smart_shuffle_enabled ? `
                    <div class="insight-adaptive-item">
                        <span class="adaptive-label">Smart Shuffle</span>
                        <span class="adaptive-badge active">Actif</span>
                    </div>
                    ` : ''}
                </div>
            </div>
            
            ${preferences.most_played.length > 0 ? `
            <div class="insight-separator"></div>
            <div class="insight-top-songs">
                <div class="insight-top-songs-header">Top chansons</div>
                ${preferences.most_played.slice(0, 3).map((item, index) => `
                    <div class="insight-top-song">
                        <span class="top-song-rank">${index + 1}</span>
                        <span class="top-song-name">${this.getSongName(item.song_id)}</span>
                        <span class="top-song-plays">${item.play_count} ×</span>
                    </div>
                `).join('')}
            </div>
            ` : ''}
            
            <button class="insight-reset-btn" id="resetAnalyticsBtn">
                Réinitialiser les données
            </button>
        `;
        
        // Event listener pour le reset
        document.getElementById('resetAnalyticsBtn')?.addEventListener('click', () => {
            this.resetAnalytics();
        });
    }

    getSongName(filename) {
        // Simplifier le nom de fichier
        return filename.replace(/\.(mp3|wav|flac|ogg|m4a)$/i, '').substring(0, 30);
    }

    toggleInsights() {
        const panel = document.getElementById('insightsPanel');
        if (panel) {
            if (this.insightsPanelVisible) {
                this.hideInsights();
            } else {
                this.showInsights();
            }
        }
    }

    showInsights() {
        const panel = document.getElementById('insightsPanel');
        if (panel) {
            panel.classList.add('show');
            this.insightsPanelVisible = true;
            this.updateInsights();
        }
    }

    hideInsights() {
        const panel = document.getElementById('insightsPanel');
        if (panel) {
            panel.classList.remove('show');
            this.insightsPanelVisible = false;
        }
    }

    async resetAnalytics() {
        if (confirm('Voulez-vous vraiment réinitialiser toutes les données d\'analytics ?')) {
            try {
                await fetch('/api/analytics/reset', { method: 'POST' });
                window.showNotification('Données réinitialisées');
                this.updateInsights();
            } catch (error) {
                console.error('Erreur reset:', error);
            }
        }
    }
}

// Initialiser le système
let behavioralAnalytics;
document.addEventListener('DOMContentLoaded', () => {
    behavioralAnalytics = new BehavioralAnalytics();
});

// Exposer la fonction toggle
window.toggleInsights = function() {
    if (behavioralAnalytics) {
        behavioralAnalytics.toggleInsights();
    }
};

// Garder l'ancienne fonction pour compatibilité
window.showInsights = function() {
    if (behavioralAnalytics) {
        behavioralAnalytics.showInsights();
    }
};

// Exposer les fonctions pour intégration avec script.js
window.trackSongStart = function(filename, duration) {
    if (behavioralAnalytics) {
        behavioralAnalytics.trackSongStart(filename, duration);
    }
};

window.trackSongEnd = function(completed) {
    if (behavioralAnalytics) {
        behavioralAnalytics.trackSongEnd(completed);
    }
};

window.trackSkip = function(filename) {
    if (behavioralAnalytics) {
        behavioralAnalytics.trackSkip(filename);
    }
};