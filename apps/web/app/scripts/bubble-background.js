(function () {
    if (window.initBubbleBackground) {
        return;
    }

    function ensureLayer() {
        if (!document.body || !document.body.classList.contains("app-shell")) {
            return null;
        }

        var existing = document.querySelector(".dashboard-bubble-layer");
        if (existing) {
            return existing;
        }

        var layer = document.createElement("div");
        layer.className = "dashboard-bubble-layer";
        layer.setAttribute("aria-hidden", "true");
        layer.innerHTML = [
            '<div class="dashboard-orb dashboard-orb--left"></div>',
            '<div class="dashboard-orb dashboard-orb--right"></div>',
            '<div class="dashboard-orb dashboard-orb--top"></div>',
            '<div class="dashboard-orb dashboard-orb--bottom"></div>',
            '<div class="dashboard-orb dashboard-orb--mid"></div>',
            '<div class="dashboard-orb dashboard-orb--far-right"></div>',
        ].join("");
        document.body.insertBefore(layer, document.body.firstChild);
        return layer;
    }

    function startMotion(layer) {
        var prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
        if (prefersReducedMotion.matches) {
            return;
        }

        var orbs = Array.from(layer.querySelectorAll(".dashboard-orb"));
        var bubbleMotion = orbs.map(function (orb) {
            return {
                orb: orb,
                x: 0,
                y: 0,
                targetX: 0,
                targetY: 0,
                scaleX: 1,
                scaleY: 1,
                targetScaleX: 1,
                targetScaleY: 1,
                driftX: 10 + Math.random() * 14,
                driftY: 8 + Math.random() * 12,
                speed: 0.00045 + Math.random() * 0.00022,
                phase: Math.random() * Math.PI * 2,
            };
        });

        function settleBubbles() {
            bubbleMotion.forEach(function (motion) {
                motion.targetX = 0;
                motion.targetY = 0;
                motion.targetScaleX = 1;
                motion.targetScaleY = 1;
            });
        }

        function pushBubbles(pointerX, pointerY) {
            bubbleMotion.forEach(function (motion) {
                var rect = motion.orb.getBoundingClientRect();
                var centerX = rect.left + rect.width / 2;
                var centerY = rect.top + rect.height / 2;
                var deltaX = pointerX - centerX;
                var deltaY = pointerY - centerY;
                var distance = Math.hypot(deltaX, deltaY);
                var radius = Math.max(rect.width, rect.height) * 0.78;

                if (distance > radius) {
                    motion.targetX = 0;
                    motion.targetY = 0;
                    motion.targetScaleX = 1;
                    motion.targetScaleY = 1;
                    return;
                }

                var strength = Math.pow(1 - distance / radius, 2);
                var angle = distance === 0 ? -Math.PI / 2 : Math.atan2(deltaY, deltaX);
                var push = 44 * strength;
                motion.targetX = -Math.cos(angle) * push;
                motion.targetY = -Math.sin(angle) * push;
                motion.targetScaleX = 1 + strength * 0.06;
                motion.targetScaleY = 1 - strength * 0.05;
            });
        }

        function animateBubbles() {
            var now = performance.now();
            bubbleMotion.forEach(function (motion) {
                var idleX = Math.sin(now * motion.speed + motion.phase) * motion.driftX;
                var idleY = Math.cos(now * motion.speed * 0.82 + motion.phase * 1.2) * motion.driftY;
                var nextX = motion.targetX + idleX;
                var nextY = motion.targetY + idleY;
                motion.x += (nextX - motion.x) * 0.12;
                motion.y += (nextY - motion.y) * 0.12;
                motion.scaleX += (motion.targetScaleX - motion.scaleX) * 0.12;
                motion.scaleY += (motion.targetScaleY - motion.scaleY) * 0.12;
                motion.orb.style.setProperty("--push-x", motion.x.toFixed(2) + "px");
                motion.orb.style.setProperty("--push-y", motion.y.toFixed(2) + "px");
                motion.orb.style.setProperty("--bubble-scale-x", motion.scaleX.toFixed(3));
                motion.orb.style.setProperty("--bubble-scale-y", motion.scaleY.toFixed(3));
            });
            window.requestAnimationFrame(animateBubbles);
        }

        window.addEventListener("pointermove", function (event) {
            pushBubbles(event.clientX, event.clientY);
        });
        window.addEventListener("pointerleave", settleBubbles);
        window.addEventListener("blur", settleBubbles);
        window.requestAnimationFrame(animateBubbles);
    }

    function runEntryTransition(layer) {
        var entry = sessionStorage.getItem("linksee_bubble_transition");
        if (!entry) {
            return;
        }
        sessionStorage.removeItem("linksee_bubble_transition");
        document.body.classList.add("bubble-entering");
        window.setTimeout(function () {
            document.body.classList.remove("bubble-entering");
        }, 1400);
    }

    window.initBubbleBackground = function initBubbleBackground() {
        var layer = ensureLayer();
        if (!layer) {
            return;
        }
        startMotion(layer);
        runEntryTransition(layer);
    };
})();
