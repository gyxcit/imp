/**
 * Moteur de thèmes dynamiques avec variations aléatoires contrôlées
 */

class ThemeEngine {
    constructor() {
        this.themes = {
            neutral: {
                name: 'Neutre',
                className: 'theme-neutral',
                mood: 'neutral',
                particleCount: 15,
                particleSpeed: 20
            },
            energy: {
                name: 'Énergie',
                className: 'theme-energy',
                mood: 'energetic',
                particleCount: 35,
                particleSpeed: 10
            },
            calm: {
                name: 'Calme',
                className: 'theme-calm',
                mood: 'calm',
                particleCount: 12,
                particleSpeed: 30
            },
            focus: {
                name: 'Focus',
                className: 'theme-focus',
                mood: 'focused',
                particleCount: 10,
                particleSpeed: 35
            },
            sunset: {
                name: 'Coucher de soleil',
                className: 'theme-sunset',
                mood: 'warm',
                particleCount: 25,
                particleSpeed: 20
            },
            midnight: {
                name: 'Minuit',
                className: 'theme-midnight',
                mood: 'dark',
                particleCount: 30,
                particleSpeed: 25
            },
            sunsetDark: {
                name: 'Sombre chaleureux',
                className: 'theme-sunset-dark',
                mood: 'dark-warm',
                particleCount: 20,
                particleSpeed: 28
            },
            aurora: {
                name: 'Aurore',
                className: 'theme-aurora',
                mood: 'cool',
                particleCount: 22,
                particleSpeed: 18
            },
            lavender: {
                name: 'Lavande',
                className: 'theme-lavender',
                mood: 'dreamy',
                particleCount: 18,
                particleSpeed: 32
            },
            ocean: {
                name: 'Océan',
                className: 'theme-ocean',
                mood: 'aquatic',
                particleCount: 28,
                particleSpeed: 22
            },
            fire: {
                name: 'Feu',
                className: 'theme-fire',
                mood: 'intense',
                particleCount: 40,
                particleSpeed: 8
            }
        };

        this.currentTheme = 'neutral';
        this.variationTimer = null;
        this.particleContainer = null;
        this.mouseX = 50;
        this.mouseY = 50;
        
        this.init();
    }

    init() {
        // Créer le conteneur de particules
        this.createParticleContainer();
        
        // Créer l'interface de sélection de thème
        this.createThemeSelector();
        
        // Suivre la position de la souris
        this.trackMouse();
        
        // Appliquer le thème initial
        this.applyTheme('neutral');
        
        // Démarrer les variations automatiques
        this.startAutoVariations();
    }

    createParticleContainer() {
        this.particleContainer = document.createElement('div');
        this.particleContainer.className = 'ambient-particles';
        document.body.appendChild(this.particleContainer);
    }

    createThemeSelector() {
        const selector = document.createElement('div');
        selector.className = 'theme-selector';
        selector.innerHTML = `
            <button class="theme-toggle-btn" id="themeToggleBtn" title="Changer de thème">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="5"/>
                    <line x1="12" y1="1" x2="12" y2="3"/>
                    <line x1="12" y1="21" x2="12" y2="23"/>
                    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
                    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                    <line x1="1" y1="12" x2="3" y2="12"/>
                    <line x1="21" y1="12" x2="23" y2="12"/>
                    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
                    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
                </svg>
            </button>
            <div class="theme-menu" id="themeMenu" style="display: none;">
                <div class="theme-menu-header">Ambiance</div>
                <div class="theme-grid">
                    ${Object.entries(this.themes).map(([key, theme]) => `
                        <button class="theme-option" data-theme="${key}" title="${theme.name}">
                            <span class="theme-dot ${theme.className}"></span>
                            <span class="theme-name">${theme.name}</span>
                        </button>
                    `).join('')}
                </div>
                <div class="theme-menu-footer">
                    <label class="auto-variation-toggle">
                        <input type="checkbox" id="autoVariationToggle" checked>
                        <span>Variations automatiques</span>
                    </label>
                </div>
            </div>
        `;
        
        document.querySelector('.file-controls').appendChild(selector);
        
        // Event listeners
        document.getElementById('themeToggleBtn').addEventListener('click', () => {
            this.toggleThemeMenu();
        });
        
        document.querySelectorAll('.theme-option').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const theme = e.currentTarget.dataset.theme;
                this.applyTheme(theme);
                this.hideThemeMenu();
            });
        });
        
        document.getElementById('autoVariationToggle').addEventListener('change', (e) => {
            if (e.target.checked) {
                this.startAutoVariations();
            } else {
                this.stopAutoVariations();
            }
        });

        // Fermer le menu si on clique ailleurs
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.theme-selector')) {
                this.hideThemeMenu();
            }
        });
    }

    toggleThemeMenu() {
        const menu = document.getElementById('themeMenu');
        menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
    }

    hideThemeMenu() {
        document.getElementById('themeMenu').style.display = 'none';
    }

    applyTheme(themeName) {
        if (!this.themes[themeName]) return;

        const theme = this.themes[themeName];
        
        // Retirer l'ancienne classe
        if (this.currentTheme) {
            document.body.classList.remove(this.themes[this.currentTheme].className);
        }
        
        // Ajouter la nouvelle classe
        document.body.classList.add(theme.className);
        this.currentTheme = themeName;
        
        // Mettre à jour les particules
        this.updateParticles(theme);
        
        // Animer le bouton play/pause si en lecture
        this.updatePlayingAnimation();
        
        // Sauvegarder la préférence
        localStorage.setItem('selectedTheme', themeName);
        
        console.log(`Thème appliqué : ${theme.name}`);
    }

    updateParticles(theme) {
        // Effacer les anciennes particules
        this.particleContainer.innerHTML = '';
        
        // Créer de nouvelles particules
        for (let i = 0; i < theme.particleCount; i++) {
            const particle = document.createElement('div');
            particle.className = 'particle';
            
            // Position aléatoire
            const left = Math.random() * 100;
            const delay = Math.random() * theme.particleSpeed;
            const drift = (Math.random() - 0.5) * 200;
            const size = 2 + Math.random() * 4;
            
            particle.style.left = `${left}%`;
            particle.style.animationDelay = `${delay}s`;
            particle.style.setProperty('--drift', `${drift}px`);
            particle.style.width = `${size}px`;
            particle.style.height = `${size}px`;
            
            this.particleContainer.appendChild(particle);
        }
    }

    trackMouse() {
        document.addEventListener('mousemove', (e) => {
            this.mouseX = (e.clientX / window.innerWidth) * 100;
            this.mouseY = (e.clientY / window.innerHeight) * 100;
            
            document.body.style.setProperty('--mouse-x', `${this.mouseX}%`);
            document.body.style.setProperty('--mouse-y', `${this.mouseY}%`);
        });
    }

    startAutoVariations() {
        this.stopAutoVariations();
        
        // Variation subtile toutes les 3 minutes
        this.variationTimer = setInterval(() => {
            this.applyRandomTheme();
        }, 180000); // 3 minutes
    }

    stopAutoVariations() {
        if (this.variationTimer) {
            clearInterval(this.variationTimer);
            this.variationTimer = null;
        }
    }

    applyRandomTheme() {
        const themeKeys = Object.keys(this.themes);
        const availableThemes = themeKeys.filter(key => key !== this.currentTheme);
        const randomTheme = availableThemes[Math.floor(Math.random() * availableThemes.length)];
        this.applyTheme(randomTheme);
    }

    updatePlayingAnimation() {
        const playBtn = document.getElementById('playPauseBtn');
        if (playBtn && window.isPlaying) {
            playBtn.classList.add('playing');
        } else if (playBtn) {
            playBtn.classList.remove('playing');
        }
    }

    // Restaurer le thème sauvegardé
    restoreSavedTheme() {
        const savedTheme = localStorage.getItem('selectedTheme');
        if (savedTheme && this.themes[savedTheme]) {
            this.applyTheme(savedTheme);
        }
    }
}

// Initialiser le moteur de thèmes
let themeEngine;
document.addEventListener('DOMContentLoaded', () => {
    themeEngine = new ThemeEngine();
    themeEngine.restoreSavedTheme();
});