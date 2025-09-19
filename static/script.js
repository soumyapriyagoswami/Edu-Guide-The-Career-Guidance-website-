document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('quizForm');
    if (!form) {
        console.error('Error: quizForm element not found');
        return;
    }

    // Insert simple fadeIn keyframes for the motivational message (only once)
    (function ensureStyles() {
        if (document.getElementById('dgp-extra-styles')) return;
        const s = document.createElement('style');
        s.id = 'dgp-extra-styles';
        s.textContent = `
            @keyframes dgpfadeIn { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
            .dgpmotivation { animation: dgpfadeIn 0.5s ease forwards; }
        `;
        document.head.appendChild(s);
    })();

    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const answers = [];
        document.querySelectorAll('.question').forEach(q => {
            const selected = q.querySelector('input:checked');
            if (selected) {
                answers.push(selected.value);
            }
        });
        
        if (answers.length !== 5) {
            alert('Please answer all 5 questions!');
            return;
        }
        
        try {
            const response = await fetch('/submit_quiz', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ answers: answers })
            });

            if (!response.ok) {
                // try to get JSON error; if not possible, throw generic
                let errText = `HTTP error: ${response.status}`;
                try {
                    const errorData = await response.json();
                    errText = errorData.error || errText;
                } catch (_) {}
                throw new Error(errText);
            }

            const data = await response.json();
            
            if (!data.suggestion || !data.scores || !data.ai_careers) {
                throw new Error('Invalid response structure: missing suggestion, scores, or ai_careers');
            }

            const elements = {
                streamName: document.getElementById('streamName'),
                streamDesc: document.getElementById('streamDesc'),
                careers: document.getElementById('careers'),
                degrees: document.getElementById('degrees'),
                careerLink: document.getElementById('careerLink'),
                scienceScore: document.getElementById('scienceScore'),
                scienceBar: document.getElementById('scienceBar'),
                artsScore: document.getElementById('artsScore'),
                artsBar: document.getElementById('artsBar'),
                commerceScore: document.getElementById('commerceScore'),
                commerceBar: document.getElementById('commerceBar'),
                results: document.getElementById('results')
            };

            for (const [key, element] of Object.entries(elements)) {
                if (!element) {
                    throw new Error(`DOM element not found: ${key}`);
                }
            }

            // Update UI with response
            elements.streamName.textContent = data.suggestion.name;
            elements.streamDesc.textContent = data.suggestion.description || '';
            elements.careers.textContent = (data.suggestion.careers || []).join(', ');
            elements.degrees.textContent = (data.suggestion.degrees || []).join(', ');
            elements.careerLink.href = `/career/${String(data.suggestion.name).toLowerCase().replace(/\s+/g, '-')}`;
            
            for (let i = 0; i < 3; i++) {
                const careerElement = document.getElementById(`aiCareerName${i}`);
                if (careerElement) {
                    careerElement.textContent = data.ai_careers[i] || 'Explore more';
                }
            }
            
            const total = answers.length;
            elements.scienceScore.textContent = data.scores.science;
            elements.scienceBar.style.width = (data.scores.science / total * 100) + '%';
            
            elements.artsScore.textContent = data.scores.arts;
            elements.artsBar.style.width = (data.scores.arts / total * 100) + '%';
            
            elements.commerceScore.textContent = data.scores.commerce;
            elements.commerceBar.style.width = (data.scores.commerce / total * 100) + '%';
            
            elements.results.style.display = 'block';
            elements.results.scrollIntoView({ behavior: 'smooth' });

            // ✅ Ensure confetti lib is loaded, then launch celebration
            try {
                await ensureConfettiLoaded();
                launchConfetti();
            } catch (err) {
                console.warn('Confetti failed to load or run:', err);
                // Not fatal — continue with motivation + sound
            }

            // Show motivational message and play a sound
            showMotivation("🌟 Awesome job! You’re on your way to a bright future 🚀");
            playSuccessSound();

        } catch (error) {
            console.error('Quiz submission error:', error.message, error.stack);
            alert(`Error: ${error.message}. Check the console for details.`);
        }
    });

    // Load an external script dynamically and return when ready
    function loadScript(url) {
        return new Promise((resolve, reject) => {
            // avoid loading twice
            if (document.querySelector(`script[src="${url}"]`)) {
                // if already there, wait briefly for it to initialize
                setTimeout(() => {
                    (typeof confetti === 'function') ? resolve() : resolve();
                }, 200);
                return;
            }
            const s = document.createElement('script');
            s.src = url;
            s.async = true;
            s.onload = () => resolve();
            s.onerror = () => reject(new Error('Failed to load ' + url));
            document.body.appendChild(s);
        });
    }

    // Ensure confetti library is available (loads it if necessary)
    async function ensureConfettiLoaded() {
        if (typeof confetti === 'function' || typeof window.confetti === 'function') {
            return;
        }
        // CDN for canvas-confetti
        const url = 'https://cdn.jsdelivr.net/npm/canvas-confetti@1.6.0/dist/confetti.browser.min.js';
        await loadScript(url);
        if (!(typeof confetti === 'function' || typeof window.confetti === 'function')) {
            throw new Error('confetti not available after loading script');
        }
    }

    // Confetti animation (uses global confetti)
    function launchConfetti() {
        if (!(typeof confetti === 'function' || typeof window.confetti === 'function')) {
            console.warn('Confetti not available — skipping animation');
            return;
        }
        const duration = 2500;
        const end = Date.now() + duration;

        (function frame() {
            // burst from left & right
            confetti({ particleCount: 6, angle: 60, spread: 55, origin: { x: 0 } });
            confetti({ particleCount: 6, angle: 120, spread: 55, origin: { x: 1 } });

            // occasional center burst
            confetti({ particleCount: 8, spread: 80, origin: { x: 0.5, y: 0.3 } });

            if (Date.now() < end) {
                requestAnimationFrame(frame);
            }
        })();
    }

    // Show motivational message at top of results
    function showMotivation(text) {
        try {
            const results = document.getElementById('results');
            if (!results) return;

            // remove previous if present
            const prev = document.getElementById('dgpmotivation');
            if (prev) prev.remove();

            const msgBox = document.createElement('div');
            msgBox.id = 'dgpmotivation';
            msgBox.className = 'alert alert-info text-center fw-bold dgpmotivation';
            msgBox.style.marginBottom = '1rem';
            msgBox.textContent = text;

            results.prepend(msgBox);

            // auto-hide after 5s
            setTimeout(() => {
                msgBox.style.transition = 'opacity 0.6s ease';
                msgBox.style.opacity = '0';
                setTimeout(() => msgBox.remove(), 600);
            }, 5000);
        } catch (e) {
            console.warn('Failed to show motivation:', e);
        }
    }

    // Play a short success sound (non-blocking)
    function playSuccessSound() {
        try {
            const audio = new Audio("https://cdn.jsdelivr.net/gh/anars/blank-audio@master/1-sec.mp3");
            // small, neutral sound; change if you want a celebratory fanfare
            audio.play().catch(err => {
                // browsers sometimes block autoplay without user gesture; that's okay
                console.warn("Audio play blocked or failed:", err);
            });
        } catch (e) {
            console.warn('Failed to play sound:', e);
        }
    }
});
