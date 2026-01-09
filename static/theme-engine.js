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

        // Initialiser l'interface de sélection (binding unique)
        this.initThemeSelector();

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

    initThemeSelector() {
        // Event listeners (bind to existing elements in index.html)
        const toggleBtn = document.getElementById('themeToggleBtn');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', () => {
                this.toggleThemeMenu();
            });
        }

        document.querySelectorAll('.theme-option').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const theme = e.currentTarget.dataset.theme;
                this.applyTheme(theme);
                this.hideThemeMenu();
            });
        });

        const autoToggle = document.getElementById('autoVariationToggle');
        if (autoToggle) {
            autoToggle.addEventListener('change', (e) => {
                if (e.target.checked) {
                    this.startAutoVariations();
                } else {
                    this.stopAutoVariations();
                }
            });
        }

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