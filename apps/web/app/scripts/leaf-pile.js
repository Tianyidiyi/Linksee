(function () {
    var SVG_NS = "http://www.w3.org/2000/svg";
    var MAX_LEAVES = 150;
    var ACTIVE_LEAF_LIMIT = 28;
    var SPAWN_INTERVAL_MS = 520;

    var leafShapes = [
        {
            path: "M0 0L-10 -6L-20 -4L-28 -12L-42 -10L-54 -18L-76 -18L-60 -28L-70 -42L-54 -40L-42 -52L-56 -60L-50 -72L-62 -86L-42 -82L-30 -92L-24 -74L-14 -88L-10 -104L0 -126L10 -104L14 -88L24 -74L30 -92L42 -82L62 -86L50 -72L56 -60L42 -52L54 -40L70 -42L60 -28L76 -18L54 -18L42 -10L28 -12L20 -4L10 -6Z",
            veins: ["M0 0L0 -126", "M0 0L-62 -86", "M0 0L62 -86", "M0 0L-76 -18", "M0 0L76 -18", "M0 0L0 24"]
        },
        {
            path: "M0 0L-12 -8L-24 -6L-34 -16L-48 -14L-62 -24L-88 -22L-68 -34L-80 -50L-62 -48L-50 -62L-66 -72L-58 -86L-72 -102L-48 -96L-34 -108L-26 -86L-16 -100L-12 -118L0 -142L12 -118L16 -100L26 -86L34 -108L48 -96L72 -102L58 -86L66 -72L50 -62L62 -48L80 -50L68 -34L88 -22L62 -24L48 -14L34 -16L24 -6L12 -8Z",
            veins: ["M0 0L0 -142", "M0 0L-72 -102", "M0 0L72 -102", "M0 0L-88 -22", "M0 0L88 -22", "M0 0L0 28"]
        },
        {
            path: "M0 0L-8 -6L-18 -4L-26 -12L-36 -10L-48 -18L-68 -18L-54 -28L-62 -40L-48 -38L-36 -50L-48 -58L-44 -70L-56 -82L-36 -78L-24 -88L-18 -70L-10 -82L-8 -96L0 -116L8 -96L10 -82L18 -70L24 -88L36 -78L56 -82L44 -70L48 -58L36 -50L48 -38L62 -40L54 -28L68 -18L48 -18L36 -10L26 -12L18 -4L8 -6Z",
            veins: ["M0 0L0 -116", "M0 0L-56 -82", "M0 0L56 -82", "M0 0L-68 -18", "M0 0L68 -18", "M0 0L0 22"]
        }
    ];

    var leafPalettes = [
        { fill: "#e7c56b", stroke: "#b9882e", vein: "#9b6f22" },
        { fill: "#dca95a", stroke: "#a56d1f", vein: "#875516" },
        { fill: "#f0d78f", stroke: "#be9141", vein: "#9c742d" },
        { fill: "#cf8d4a", stroke: "#995920", vein: "#7c4615" },
        { fill: "#d9b45e", stroke: "#aa7830", vein: "#8c6024" }
    ];
    var leaves = [];
    var lastSpawn = 0;
    var layer;
    var svg;

    function randomBetween(min, max) {
        return min + Math.random() * (max - min);
    }

    function getFallBounds(width, side) {
        var centerGap = width < 720 ? width * 0.42 : width * 0.28;
        if (side === "left") {
            return {
                minX: 28,
                maxX: centerGap
            };
        }
        return {
            minX: width - centerGap,
            maxX: width - 28
        };
    }

    function clamp(value, min, max) {
        return Math.min(Math.max(value, min), max);
    }

    function createSvgElement(tagName, attrs) {
        var element = document.createElementNS(SVG_NS, tagName);
        Object.keys(attrs || {}).forEach(function (name) {
            element.setAttribute(name, attrs[name]);
        });
        return element;
    }

    function createLeafNode(shape, palette, opacity) {
        var group = createSvgElement("g", {
            class: "leaf-pile-leaf",
            opacity: opacity.toFixed(2)
        });
        group.appendChild(createSvgElement("path", {
            d: shape.path,
            fill: palette.fill,
            "fill-opacity": "0.68",
            stroke: palette.stroke,
            "stroke-width": "1.15",
            "stroke-linecap": "round",
            "stroke-linejoin": "round"
        }));
        shape.veins.forEach(function (vein) {
            group.appendChild(createSvgElement("path", {
                d: vein,
                fill: "none",
                stroke: palette.vein,
                "stroke-width": "0.95",
                "stroke-linecap": "round",
                "stroke-linejoin": "round",
                opacity: "0.78"
            }));
        });
        return group;
    }

    function applyLeafTransform(leaf) {
        leaf.node.setAttribute(
            "transform",
            "translate(" + leaf.x.toFixed(2) + " " + leaf.y.toFixed(2) + ") " +
            "rotate(" + leaf.rotation.toFixed(2) + ") " +
            "scale(" + leaf.scale.toFixed(3) + " " + (leaf.scale * leaf.squash).toFixed(3) + ")"
        );
        leaf.node.setAttribute("opacity", Math.max(0, leaf.opacity).toFixed(2));
    }

    function createNewLeaf(width) {
        var shape = leafShapes[Math.floor(Math.random() * leafShapes.length)];
        var palette = leafPalettes[Math.floor(Math.random() * leafPalettes.length)];
        var scale = randomBetween(0.24, 1.02);
        var opacity = randomBetween(0.44, 0.84);
        var side = Math.random() < 0.5 ? "left" : "right";
        var bounds = getFallBounds(width, side);
        var leaf = {
            side: side,
            baseX: randomBetween(bounds.minX, bounds.maxX),
            x: 0,
            y: randomBetween(-150, -40),
      speedY: randomBetween(0.3, 0.72),
            swayAmp: randomBetween(8, 30),
            swayRate: randomBetween(0.012, 0.027),
            phase: randomBetween(0, Math.PI * 2),
            rotation: randomBetween(-32, 32),
            rotationSpeed: randomBetween(-0.45, 0.45),
            scale: scale,
            squash: randomBetween(0.72, 1),
            opacity: opacity,
            fadeSpeed: randomBetween(0.012, 0.026),
            fading: false,
            dead: false,
            node: createLeafNode(shape, palette, opacity)
        };
        leaf.x = leaf.baseX;
        svg.appendChild(leaf.node);
        applyLeafTransform(leaf);
        leaves.push(leaf);
    }

    function updateLeaf(leaf, width, height) {
        if (leaf.dead) {
            return;
        }
        var bounds = getFallBounds(width, leaf.side);

        leaf.y += leaf.fading ? leaf.speedY * 0.35 : leaf.speedY;
        leaf.x = clamp(
            leaf.baseX + Math.sin(leaf.y * leaf.swayRate + leaf.phase) * leaf.swayAmp,
            bounds.minX,
            bounds.maxX
        );
        leaf.rotation += leaf.fading ? leaf.rotationSpeed * 0.25 : leaf.rotationSpeed;

        if (!leaf.fading && leaf.y >= height - randomBetween(42, 12)) {
            leaf.fading = true;
            leaf.rotationSpeed *= 0.45;
            leaf.squash = randomBetween(0.5, 0.78);
        }

        if (leaf.fading) {
            leaf.opacity -= leaf.fadeSpeed;
            if (leaf.opacity <= 0 || leaf.y > height + 80) {
                leaf.dead = true;
                leaf.node.remove();
            }
        }
    }

    function animate(timestamp) {
        var width = window.innerWidth;
        var height = window.innerHeight;
        var activeLeaves = leaves.filter(function (leaf) {
            return !leaf.fading && !leaf.dead;
        }).length;

        if (timestamp - lastSpawn > SPAWN_INTERVAL_MS && leaves.length < MAX_LEAVES && activeLeaves < ACTIVE_LEAF_LIMIT) {
            createNewLeaf(width);
            lastSpawn = timestamp;
        }

        leaves = leaves.filter(function (leaf) {
            return !leaf.dead;
        });
        leaves.forEach(function (leaf) {
            updateLeaf(leaf, width, height);
            applyLeafTransform(leaf);
        });

        window.requestAnimationFrame(animate);
    }

    function initLeafPile() {
        if (!document.body.classList.contains("app-shell")) {
            return;
        }
        if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
            return;
        }

        layer = document.createElement("div");
        layer.className = "leaf-pile-layer";
        layer.setAttribute("aria-hidden", "true");
        svg = createSvgElement("svg", {
            viewBox: "0 0 " + window.innerWidth + " " + window.innerHeight,
            preserveAspectRatio: "none"
        });
        layer.appendChild(svg);
        document.body.insertBefore(layer, document.body.firstChild);

        window.addEventListener("resize", function () {
            svg.setAttribute("viewBox", "0 0 " + window.innerWidth + " " + window.innerHeight);
        });
        window.requestAnimationFrame(animate);
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initLeafPile);
    } else {
        initLeafPile();
    }
})();
