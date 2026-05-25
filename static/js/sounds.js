/**
 * Q-Chat Sound Effects — Web Audio API
 * Generates all sounds programmatically (no external files needed)
 */

const QSounds = (() => {
    let ctx;

    function getContext() {
        if (!ctx || ctx.state === 'closed') {
            ctx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (ctx.state === 'suspended') {
            ctx.resume();
        }
        return ctx;
    }

    function playTone(freq, duration, type = 'sine', volume = 0.15, ramp = true) {
        try {
            const c = getContext();
            const osc = c.createOscillator();
            const gain = c.createGain();

            osc.type = type;
            osc.frequency.setValueAtTime(freq, c.currentTime);
            gain.gain.setValueAtTime(volume, c.currentTime);

            if (ramp) {
                gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration);
            }

            osc.connect(gain);
            gain.connect(c.destination);
            osc.start(c.currentTime);
            osc.stop(c.currentTime + duration);
        } catch (e) {
            // Silently fail if audio context unavailable
        }
    }

    function playChord(freqs, duration, type = 'sine', volume = 0.08) {
        freqs.forEach(f => playTone(f, duration, type, volume));
    }

    return {
        /** Short ascending tone — sent message */
        messageSend() {
            const c = getContext();
            try {
                const osc = c.createOscillator();
                const gain = c.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(600, c.currentTime);
                osc.frequency.linearRampToValueAtTime(900, c.currentTime + 0.08);
                gain.gain.setValueAtTime(0.1, c.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.12);
                osc.connect(gain);
                gain.connect(c.destination);
                osc.start(c.currentTime);
                osc.stop(c.currentTime + 0.12);
            } catch (e) {}
        },

        /** Soft notification chime — received message */
        messageReceive() {
            playTone(880, 0.1, 'sine', 0.12);
            setTimeout(() => playTone(1100, 0.15, 'sine', 0.08), 80);
        },

        /** Welcome / join tone */
        userJoin() {
            playTone(523, 0.15, 'sine', 0.08);
            setTimeout(() => playTone(659, 0.15, 'sine', 0.08), 120);
            setTimeout(() => playTone(784, 0.2, 'sine', 0.06), 240);
        },

        /** User leave tone */
        userLeave() {
            playTone(784, 0.12, 'sine', 0.08);
            setTimeout(() => playTone(659, 0.12, 'sine', 0.08), 100);
            setTimeout(() => playTone(523, 0.18, 'sine', 0.06), 200);
        },

        /** Ringing tone for incoming call */
        callRing() {
            let i = 0;
            const interval = setInterval(() => {
                playChord([440, 554], 0.15, 'sine', 0.1);
                setTimeout(() => playChord([440, 554], 0.15, 'sine', 0.1), 200);
                i++;
                if (i >= 3) clearInterval(interval);
            }, 600);
        },

        /** Call connected */
        callConnect() {
            playTone(440, 0.1, 'sine', 0.1);
            setTimeout(() => playTone(554, 0.1, 'sine', 0.1), 80);
            setTimeout(() => playTone(660, 0.15, 'sine', 0.08), 160);
        },

        /** Call ended */
        callEnd() {
            playTone(440, 0.2, 'sine', 0.1);
            setTimeout(() => playTone(330, 0.3, 'sine', 0.08), 150);
        },

        /** Error sound */
        error() {
            playTone(200, 0.15, 'square', 0.08);
            setTimeout(() => playTone(180, 0.2, 'square', 0.06), 120);
        },

        /** Subtle click */
        click() {
            playTone(1200, 0.03, 'sine', 0.05, false);
        }
    };
})();
