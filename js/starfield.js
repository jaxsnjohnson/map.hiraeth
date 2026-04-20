// Lightweight canvas starfield for Firefox (and others) to replace heavy CSS box-shadows.
(function initStarfield() {
    const canvas = document.getElementById('star-canvas');
    const container = document.getElementById('star-field');
    if (!canvas || !container) return;

    const root = document.documentElement;
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const useOffscreen = typeof OffscreenCanvas !== 'undefined';

    const STAR_COUNT = 450;
    const FPS = 30;
    const stars = [];
    let width = 0;
    let height = 0;
    let dpr = Math.max(1, Math.round(window.devicePixelRatio || 1));
    let lastFrame = 0;
    let running = false;

    const offscreen = useOffscreen ? new OffscreenCanvas(1, 1) : null;
    let bufferCtx = offscreen ? offscreen.getContext('2d') : null;
    const ctx = canvas.getContext('2d', { alpha: true });

    function randomBetween(min, max) {
        return min + Math.random() * (max - min);
    }

    function createStars() {
        stars.length = 0;
        for (let i = 0; i < STAR_COUNT; i++) {
            stars.push({
                x: Math.random(), // Normalized positions to allow responsive resize
                y: Math.random(),
                radius: randomBetween(0.6, 1.8),
                twinkleSpeed: randomBetween(0.25, 0.85),
                phase: Math.random() * Math.PI * 2
            });
        }
    }

    function resize() {
        const rect = container.getBoundingClientRect();
        const nextWidth = Math.max(1, Math.round(rect.width));
        const nextHeight = Math.max(1, Math.round(rect.height));
        const nextDpr = Math.max(1, Math.round(window.devicePixelRatio || 1));

        if (nextWidth === width && nextHeight === height && nextDpr === dpr) {
            return false;
        }

        width = nextWidth;
        height = nextHeight;
        dpr = nextDpr;

        canvas.width = width * dpr;
        canvas.height = height * dpr;
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        if (offscreen) {
            offscreen.width = width * dpr;
            offscreen.height = height * dpr;
            if (bufferCtx) {
                bufferCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
            }
        }

        return true;
    }

    function syncCanvasToContainer(now = performance.now()) {
        const resized = resize();
        if (resized || shouldRender()) {
            renderFrame(now);
        }
    }

    function shouldRender() {
        const theme = root.getAttribute('data-theme') || '';
        if (theme !== 'dark') return false;
        if (document.hidden) return false;
        return true;
    }

    function renderFrame(now) {
        if (!width || !height) return;

        const targetCtx = bufferCtx || ctx;
        targetCtx.clearRect(0, 0, width, height);

        const baseAlpha = 0.35;
        const maxAlpha = 0.7;
        const reduced = prefersReducedMotion.matches;

        for (const star of stars) {
            const alpha = reduced
                ? 0.55
                : baseAlpha + (maxAlpha - baseAlpha) * (0.5 + 0.5 * Math.sin(now * 0.001 * star.twinkleSpeed + star.phase));
            targetCtx.globalAlpha = alpha;
            targetCtx.beginPath();
            targetCtx.arc(star.x * width, star.y * height, star.radius, 0, Math.PI * 2);
            targetCtx.fillStyle = '#ffffff';
            targetCtx.fill();
        }

        if (bufferCtx) {
            ctx.clearRect(0, 0, width, height);
            ctx.drawImage(offscreen, 0, 0, width, height);
        }
    }

    function loop(now) {
        if (!running) return;
        const elapsed = now - lastFrame;
        if (elapsed >= 1000 / FPS) {
            lastFrame = now;
            if (shouldRender()) {
                renderFrame(now);
            } else {
                // Clear when hidden or light mode to avoid stale pixels.
                ctx.clearRect(0, 0, width, height);
                if (bufferCtx) bufferCtx.clearRect(0, 0, width, height);
            }
        }
        requestAnimationFrame(loop);
    }

    function start() {
        resize();
        createStars();
        running = true;
        lastFrame = performance.now();
        renderFrame(lastFrame);
        if (!prefersReducedMotion.matches) {
            requestAnimationFrame(loop);
        }
    }

    function restart() {
        running = false;
        ctx.clearRect(0, 0, width, height);
        if (bufferCtx) bufferCtx.clearRect(0, 0, width, height);
        start();
    }

    const debouncedResize = (() => {
        let timeout;
        return () => {
            clearTimeout(timeout);
            timeout = setTimeout(() => {
                syncCanvasToContainer();
            }, 120);
        };
    })();

    window.addEventListener('resize', debouncedResize);
    prefersReducedMotion.addEventListener('change', restart);
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden && running) {
            lastFrame = performance.now();
            renderFrame(lastFrame);
        }
    });

    if (typeof ResizeObserver === 'function') {
        const layoutObserver = new ResizeObserver(() => {
            syncCanvasToContainer();
        });
        layoutObserver.observe(container);
    }

    const themeObserver = new MutationObserver(() => {
        renderFrame(performance.now());
    });
    themeObserver.observe(root, { attributes: true, attributeFilter: ['data-theme'] });

    start();
})();
