/**
 * circuit-background.js
 * ----------------------
 * Renders a retro-style animated circuit board background using multiple canvas layers.
 *
 * Layers:
 * - Dots layer: faint static grid texture for depth.
 * - Circuit layer: randomly generated paths with endpoints, drawn once offscreen.
 * - Particle layer: animated particles that travel along circuit paths.
 *
 * Core pieces:
 * - Constants: define colors, speeds, sizes, probabilities.
 * - Utility fns: random choice, cell math, color selection.
 * - Data classes:
 *     Column   → vertical cell occupancy map
 *     Circuit  → path definition + color scheme
 *     Circuits → generator + renderer for circuit paths
 *     Dots     → background dot grid
 *     Particle → single moving entity along a path
 *     Particles→ manages + renders all particles
 *
 * Runtime:
 * - init() builds canvases, generates circuits + particles, and kicks off the animation loop.
 * - startLoop() drives the RAF cycle: update → draw particles → blit to screen.
 * - On resize: tears down and reinitializes everything.
 *
 * Usage:
 * - Must be loaded after <canvas id="circuitCanvas"> and <canvas id="particleCanvas"> exist.
 * - Automatically initializes on window.onload and re-inits on resize.
 */

if (typeof window !== "undefined") {
    // ============================
    // Constants for easy adjustments
    // ============================
    const CIRCUIT_COLOR = "rgba(0, 136, 255, 1)";
    const CIRCUIT_ENDPOINT_COLOR = "rgba(0, 136, 255, 0.6)";
    const CIRCUIT_ALT_COLOR = "rgba(255, 140, 0, 1)"; // Orange circuits
    const CIRCUIT_ALT_ENDPOINT_COLOR = "rgba(255, 140, 0, 0.6)"; // Orange endpoint
    const CIRCUIT_ALT_PROBABILITY = 0.022; // 15% chance of orange circuit
    const PARTICLE_COLOR = "rgba(248, 248, 255, 0.4)";
    const DOT_COLOR = "rgba(248, 248, 255, 0.12)";
    const PARTICLE_SPEED_MIN = 0.22;
    const PARTICLE_SPEED_MAX = 0.5;
    const DOT_SPACING = 2;
    const CELL_SIZE = 10;
    const CIRCUIT_MIN_LENGTH = 3;
    const CIRCUIT_MAX_LENGTH = 16;
    let animationFrameId;


    // ============================
    // Utility Functions
    // ============================

    /**
     * Selects a random element from an array.
     * @param {Array} array
     * @returns {*}
    */
    function randomChoice(array) {
        return array[Math.floor(Math.random() * array.length)];
    }

    /**
     * Calculates center coordinates of a cell.
     * @param {number} x
     * @param {number} y
     * @param {number} size
     * @returns {[number, number]}
    */
    function getCellCenter(x, y, size) {
        return [x * size + size / 2, y * size + size / 2];
    }

    /**
     * Returns a random circuit color scheme based on predefined probability.
     * @returns {{color: string, endpointColor: string}}
    */
    function getCircuitColors() {
        const isAlt = Math.random() < CIRCUIT_ALT_PROBABILITY;
        return {
            color: isAlt ? CIRCUIT_ALT_COLOR : CIRCUIT_COLOR,
            endpointColor: isAlt ? CIRCUIT_ALT_ENDPOINT_COLOR : CIRCUIT_ENDPOINT_COLOR
        };
    }

    // ============================
    // Grid Data Structures
    // ============================

    /**
     * Represents a vertical column of cells in the grid.
    */
    class Column {
        constructor(rows) {
            this.rows = Array(rows).fill(0);
            this.free = rows;
        }
    }

    /**
     * Represents a circuit path and its metadata.
    */
    class Circuit {
        constructor(start, size, color, endpointColor) {
            this.start = start;
            this.size = size;
            this.path = [];
            this.end = null;
            this.coords = [];
            this.length = 0;
            this.color = color;
            this.endpointColor = endpointColor;
        }
    }

    // ============================
    // Circuit Generation + Drawing
    // ============================

    /**
     * Manages the creation, drawing, and data structure of circuits.
    */
    class Circuits {
        constructor(width, height, size, minLength, maxLength) {
            this.size = size;
            this.cols = Math.floor(width / size);
            this.rows = Math.floor(height / size);
            this.minLength = minLength;
            this.maxLength = maxLength;
            this.scene = Array.from({ length: this.cols }, () => new Column(this.rows));
            this.collection = [];
            this.populate();
            this.draw();
        }

        //Renders circuits and endpoints to an offscreen canvas.
        draw() {
            const canvas = document.createElement("canvas");
            canvas.width = this.cols * this.size;
            canvas.height = this.rows * this.size;
            const ctx = canvas.getContext("2d");

            this.drawCircuitPaths(ctx);
            this.drawCircuitEndpoints(ctx);

            this.canvas = canvas;
        }

        /**
         * Draws all circuit paths onto the given context.
         * @param {CanvasRenderingContext2D} ctx 
        */
        drawCircuitPaths(ctx) {
            ctx.lineWidth = Math.round(this.size / 10);

            for (const circuit of this.collection) {
                let [x, y] = circuit.start;
                ctx.strokeStyle = circuit.color;
                ctx.beginPath();
                ctx.moveTo(
                    ...getCellCenter(x, y, this.size).map((v, i) => v + circuit.path[0][i] * this.size / 4)
                );
                for (const [dx, dy] of circuit.path) {
                    x += dx;
                    y += dy;
                    const [cx, cy] = getCellCenter(x, y, this.size);
                    ctx.lineTo(cx, cy);
                }
                ctx.stroke();
            }
        }

        /**
         * Draws endpoint circles for each circuit.
         * @param {CanvasRenderingContext2D} ctx 
        */
        drawCircuitEndpoints(ctx) {
            ctx.lineWidth = Math.round(this.size / 5);

            for (const circuit of this.collection) {
                ctx.strokeStyle = circuit.endpointColor;
                for (const point of [circuit.start, circuit.end]) {
                    const [cx, cy] = getCellCenter(point[0], point[1], this.size);
                    ctx.beginPath();
                    ctx.arc(cx, cy, this.size / 4, 0, 2 * Math.PI);
                    ctx.stroke();
                }
            }
        }

        /**
         * Attempts to generate multiple valid circuit paths.
        */
        populate() {
            let attempts = 1000;
            while (attempts-- > 0) {
                const start = this.getStart();
                if (!start) break;

                const dir = this.getDirection(start);
                if (this.isBlocked(dir)) continue;

                this.markUsed(start);
                const circuit = this.buildCircuit(start, dir);
                if (circuit) this.collection.push(circuit);
            }
        }

        /**
         * Builds a circuit path starting from the given position and direction.
         * @param {[number, number]} start
         * @param {[number, number]} dir
         * @returns {Circuit|null}
        */
        buildCircuit(start, dir) {
            const { color, endpointColor } = getCircuitColors();
            const circuit = new Circuit(start, this.size, color, endpointColor);

            const path = [...start];
            const coords = [path.slice()];
            let length = this.minLength + Math.floor(Math.random() * (this.maxLength - this.minLength));

            while (length-- > 0) {
                path[0] += dir[0];
                path[1] += dir[1];

                circuit.path.push([...dir]);
                coords.push(path.slice());

                this.markUsed(path);

                dir = this.getDirection(path, dir);
                if (this.isBlocked(dir)) break;
            }

            if (circuit.path.length >= this.minLength) {
                circuit.end = path.slice();
                circuit.coords = coords;
                circuit.length = circuit.path.length * this.size;
                return circuit;
            }

            return null;
        }

        /**
         * Checks whether the direction is a zero vector.
         * @param {[number, number]} dir
         * @returns {boolean}
         */
        isBlocked(dir) {
            return dir[0] === 0 && dir[1] === 0;
        }

        /**
         * Finds a random unused grid cell to start a circuit.
         * @returns {[number, number] | null}
        */
        getStart() {
            for (let tries = 0; tries < 10; tries++) {
                const col = Math.floor(Math.random() * this.cols);
                if (this.scene[col].free === 0) continue;
                const rowPool = this.scene[col].rows.map((v, i) => v === 0 ? i : -1).filter(i => i !== -1);
                if (rowPool.length === 0) continue;
                return [col, randomChoice(rowPool)];
            }
            return null;
        }

        /**
         * Marks a cell in the grid as used.
         * @param {[number, number]} param0
        */
        markUsed([x, y]) {
            this.scene[x].rows[y] = 1;
            this.scene[x].free--;
        }

        /**
         * Determines the next valid direction to extend a path.
         * @param {[number, number]} param0
         * @param {[number, number]} [prev=null]
         * @returns {[number, number]}
        */
        getDirection([x, y], prev = null) {
            const dirs = [[1,0],[-1,0],[0,1],[0,-1]];
            if (prev && Math.random() < 0.5 && this.scene[x + prev[0]]?.rows[y + prev[1]] === 0) return prev;
            const options = dirs.filter(([dx, dy]) => this.scene[x + dx]?.rows[y + dy] === 0);
            return options.length ? randomChoice(options) : [0, 0];
        }
    }

    // ============================
    // Particle + Dot Classes
    // ============================

    /**
     * Renders a grid of subtle dots as a background texture.
    */
    class Dots {
        constructor(width, height, spacing) {
            this.canvas = document.createElement("canvas");
            this.canvas.width = width;
            this.canvas.height = height;
            const ctx = this.canvas.getContext("2d");
            ctx.fillStyle = DOT_COLOR;
            for (let x = 0; x < width; x += spacing) {
                for (let y = 0; y < height; y += spacing) {
                    ctx.fillRect(x, y, 1, 1);
                }
            }
        }
    }

    /**
     * Represents a single moving particle on a circuit path.
    */
    class Particle {
        constructor(circuit, velocity, offset = 0) {
            this.circuit = circuit;
            this.velocity = velocity;
            this.progress = offset;
            this.x = 0;
            this.y = 0;
        }

        /** Updates particle position along its assigned circuit path. */
        update() {
            const { circuit, velocity } = this;
            const { path, coords, size, length } = circuit;
            this.progress += velocity;

            // Bounce back if at path ends
            if (this.progress <= 0 || this.progress >= length) {
                this.velocity = -this.velocity;
                this.progress += this.velocity;
            }

            // Determine current segment and position
            const index = Math.floor(this.progress / size);
            const offset = this.progress % size;
            const [dx, dy] = path[index];
            const [px, py] = coords[index];
            this.x = px * size + size / 2 + dx * offset;
            this.y = py * size + size / 2 + dy * offset;
        }
    }

    /**
     * Manages all particles and handles their rendering.
    */
    class Particles {
        constructor(width, height) {
            this.canvas = document.createElement("canvas");
            this.canvas.width = width;
            this.canvas.height = height;
            this.ctx = this.canvas.getContext("2d");
            this.particles = [];
        }

        /** Adds a new particle (Thing) to the simulation. */
        add(thing) {
            this.particles.push(thing);
        }

        /** Updates positions of all particles. */
        update() {
            for (const p of this.particles) p.update();
        }

        /** Draws all particles to the offscreen canvas. */
        draw() {
            const ctx = this.ctx;
            ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            ctx.fillStyle = PARTICLE_COLOR;
            const path = new Path2D();
            for (const p of this.particles) {
                path.moveTo(p.x + 2, p.y);
                path.arc(p.x, p.y, 2, 0, Math.PI * 2);
            }
            ctx.fill(path);
        }
    }

    // ============================
    // App Initialization + Resize Handling
    // ============================

    /**
     * Initializes canvas, scene layers, and starts the animation loop.
    */
    function init() {
        const circuitCanvas = document.getElementById("circuitCanvas");
        const particleCanvas = document.getElementById("particleCanvas");

        const width = circuitCanvas.width = particleCanvas.width = window.innerWidth;
        const height = circuitCanvas.height = particleCanvas.height = window.innerHeight;

        const circuitCtx = circuitCanvas.getContext("2d");
        const particleCtx = particleCanvas.getContext("2d");

        const dots = new Dots(width, height, DOT_SPACING);
        const circuits = new Circuits(width, height, CELL_SIZE, CIRCUIT_MIN_LENGTH, CIRCUIT_MAX_LENGTH);
        const particles = createParticles(circuits, width, height);

        drawStaticBackground(circuitCtx, width, height, dots.canvas, circuits.canvas);
        startLoop(particleCtx, particles);
    }

    /**
     * Retrieves and returns the main canvas element.
     * @param {string} id
     * @returns {HTMLCanvasElement}
    */
    function setupBaseCanvas(id) {
        return document.getElementById(id);
    }

    /**
     * Generates particle objects for each circuit path.
     * @param {Circuits} circuits
     * @param {number} width
     * @param {number} height
     * @returns {Particles}
    */
    function createParticles(circuits, width, height) {
        const particles = new Particles(width, height);
        for (const circuit of circuits.collection) {
            const count = Math.ceil(Math.random() * 3);
            for (let i = 0; i < count; i++) {
                const velocity = PARTICLE_SPEED_MIN + Math.random() * (PARTICLE_SPEED_MAX - PARTICLE_SPEED_MIN);
                const offset = Math.random() * circuit.length;
                particles.add(new Particle(circuit, velocity, offset));
            }
        }
        return particles;
    }

    /**
     * Renders static layers like the dot grid and circuit paths.
     * @param {CanvasRenderingContext2D} ctx
     * @param {number} width
     * @param {number} height
     * @param {HTMLCanvasElement} dotsCanvas
     * @param {HTMLCanvasElement} circuitsCanvas
    */
    function drawStaticBackground(ctx, width, height, dotsCanvas, circuitsCanvas) {
        ctx.clearRect(0, 0, width, height); // Clear just in case
        ctx.fillStyle = "#000";
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(dotsCanvas, 0, 0);
        ctx.drawImage(circuitsCanvas, 0, 0);
    }

    /**
     * Creates and appends a top-layer canvas for animation rendering.
     * @param {number} width
     * @param {number} height
     * @returns {CanvasRenderingContext2D}
     */
    function createOverlayCanvas(width, height) {
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        canvas.style.position = "absolute";
        canvas.style.top = 0;
        canvas.style.left = 0;
        canvas.style.zIndex = 1;
        document.body.appendChild(canvas);
        return canvas.getContext("2d");
    }

    /**
     * Begins the animation loop for updating and drawing particles.
     * @param {CanvasRenderingContext2D} ctx
     * @param {Particles} particles
    */
    function startLoop(ctx, particles) {
        cancelAnimationFrame(animationFrameId);
        function loop() {
            particles.update();
            particles.draw();
            ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
            ctx.drawImage(particles.canvas, 0, 0);
            animationFrameId = requestAnimationFrame(loop);
        }
        loop();
    }

    // Resize handling to reinitialize everything after screen change
    let resizeTimeout;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            cancelAnimationFrame(animationFrameId);
            const circuitCanvas = document.getElementById("circuitCanvas");
            const particleCanvas = document.getElementById("particleCanvas");

            // Resize both canvases
            circuitCanvas.width = particleCanvas.width = window.innerWidth;
            circuitCanvas.height = particleCanvas.height = window.innerHeight;

            init(); // Reinitialize everything
        }, 200);
    });

    // Trigger initialization when DOM is ready
    window.onload = init;
}