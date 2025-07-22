window.addEventListener("DOMContentLoaded", () => {

    // ============================
    // Configuration + Globals
    // ============================

    let flickerEnabled = false;
    let scanlinesEnabled = false;
    let grainEnabled = true;

    let SCALE = 4;
    let staticBase;

    const PRIMARY_COLOR = "#0088ff";
    const ACCENT_COLOR = "#e97451";

    /** @type {HTMLCanvasElement} */
    const renderCanvas = document.getElementById('renderCanvas');
    if (!renderCanvas) return;
    const ctx = renderCanvas.getContext('2d', { willReadFrequently: true });
    ctx.imageSmoothingEnabled = false;

    /** Compressed binary image data. */
    const namePixelsCompressed = ['0~BMI~By', '0~BMI~By', '0~BMH~Bz', '0~BMH~Bz', '0~BMH~Bz', '0~BMH~Bz', '0~BMH~Bz', '0~DG', '1QFGEWEhEIEPEHEGENGeD', '1REGEHBQCiDIERDHDGCQDQBQC', '0BSCGEHCQBSBHBHDIFRCHDGCQCRCR', '0BSCGEHCQBSBHBHDIFRCHDGCQCRCR', '0BSCGEHCQBSBHBICIFRCICGCQCRCR', '0BSCGEHCQBSBHBICIFRCICGCQCRCR', '0BSCGEHCQBSBHBICIFRCICGCGDHCRCR', '0BIDHCGEHCGDHHGHHBJBIFHDHCJBGCGDHCHDHCHDH', '0BHEHCGEHCFFFIGHHBJBIFHEGCJBGCGDHCHDHCHDH', '0BHEHCGEHCFSGHHBJBIFHMJBGCGDHCHDHCHDH', '0BHEHCGEHCFSGHHBSFHMJBGCGDHCHDHCHDH', '0BHEHCGEHCGRGHHBSFHMQCGDHCHDHCHDH', '0BHEHCGEHCIPGHHBSFHMQCGDHCHDHCHDH', '0BHEHCGEHCKNGHHBSFHMQCGDHCHDHCHDH', '0BHEHCGEHDLLGHHBSFHMQCGDHCHDHCHDH', '0BHEHCGEHEMJGHHBSFHMQCGDHCHDHCHDH', '0BHEHCGEHGMHGHHBSFILQCGDHCHDHCHDH', '0BHEHCGEHIKHGHHBSFKJQCGDHCHDHCHDH', '0BHEHCGEHJJHGHHBSFMHQCGDHCHDHCHDH', '0BHEHCGEHLHHGHHBSGNFQCGDHCRCHCI', '0BHEHCGEHCBIHHGHHBSINDQCGDHCRCR', '0BHEHCGEHCEFHHGHHBSKMCQCGDHCRCR', '0BHEHCGEHCFEHHGHHBSMKCQCGDHCRCR', '0BHEHCGEHCFEHHGHHBGBLNJCQCGDHCRCQB', '0BHEHCGEHCFCJHGHHBGBLPHCGBJCGDHCRCOD', '0BHEHCGEHCQGHHHBGBLFDHHCGBJCGDHCRCMF', '0BHEHCGEHCQGHHHBGCKFGEHCGBJCGDHCHDHCKH', '0BHEHCGEHCPIGHHBGCKFHDHCGCICGDHCHDHCJI', '0BHEHCGEHCOLFGHBGCKFHDHCGCICHCHCHDHCHK', '0BHEHCGEHCMPDGHBGCKFHDHCGCICQCHDHCHK', '0BHEHCGEHCJbHBGDJFHDHCGDDCCCQCHDHCHK', '0BHEHCGEHCHdHBGDJFHDHCGDBIQCHDHCHK', '0BHEHCGDICFfHBGDJFHDHCHLQCHDHCHK', '0BHEHCGBKCCiHBGEIFHDHCGOOCHDHCHK', '0BHEHCRoFBGEIFHBJCESMCHDHCHK', '0BHEHCRqDBGEIFRCCWKCHDHCHK', '0BHEHCQvGEIFRcICHDHCHK', '0BHEHCNzFEIFReGCHDHCHK', '0BHEHCL2EEIFPiECHDHCHK', '0BHEHCJ6CEIFMnCCHDHCHK', '0BHEHCG~BDIFKtHDHCHK', '0BHCJCE~BFIFIwGDHCHK', '0BSCD~BHHFG0EDHCHK', '0BS~BPEFE4CDHCHK', '0BS~BRCFB~BAHCHK', '0BQ~CbHCHK', '0BO~CfFCHK', '0BM~CjDCHK', '0BK~CnBCHK', '0BI~CsHK', '0BF~CwGK', '0BD~C0EK', '0BC~C3CK']

    // ============================
    // Decompression Logic
    // ============================

    /** Base64 character set used for decoding. */
    const base64chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

    /**
     * Converts a single base64 character into its integer value.
     */
    function fromBase64(char) {
        return base64chars.indexOf(char);
    }

    /**
     * Decompresses a custom base64 run-length encoded string.
     */
    function decompressFromBase64(str) {
        if (!str || str.length < 2) return [];
        const result = [];
        let current = Number(str[0]);
        let i = 1;

        // Loop through encoded string and decode into binary array
        while (i < str.length) {
            let count;
            if (str[i] === '~') {
                const high = fromBase64(str[i + 1]);
                const low = fromBase64(str[i + 2]);
                count = high * 64 + low;
                i += 3;
            } else {
                count = fromBase64(str[i]);
                i += 1;
            }
            result.push(...Array(count).fill(current));
            current ^= 1;
        }
        return result;
    }

    // Decompress entire dataset
    const namePixels = namePixelsCompressed.map(decompressFromBase64);
    const rows = namePixels.length;
    const cols = namePixels[0].length;

    // ============================
    // Responsive Canvas Setup
    // ============================

    /**
     * Resizes canvas and regenerates the name graphics with gradient and effects.
     */
    function resizeAndRender() {
        // Calculate scale based on screen width (capped)
        const maxWidth = window.innerWidth * 0.8;
        SCALE = Math.floor(Math.min(maxWidth / cols, 8));

        // Set canvas dimensions
        const canvasWidth = cols * SCALE;
        const canvasHeight = rows * SCALE;
        renderCanvas.width = canvasWidth;
        renderCanvas.height = canvasHeight;

        // Center canvas in viewport
        renderCanvas.style.width = `${canvasWidth}px`;
        renderCanvas.style.height = `${canvasHeight}px`;
        renderCanvas.style.position = 'absolute';
        renderCanvas.style.left = '50%';
        renderCanvas.style.top = '50px';
        renderCanvas.style.transform = 'translateX(-50%)';
        renderCanvas.style.zIndex = 2;

        // Re-generate canvases
        const pixels = namePixelsCompressed.map(decompressFromBase64);
        const baseCanvas = createBaseCanvas(pixels);
        const gradientCanvas = applyGradientToCanvas(baseCanvas);
        staticBase = createStaticBase(gradientCanvas);
    }

    // ============================
    // Canvas Drawing Utilities
    // ============================

    /**
     * Generates a canvas with white rectangles from binary pixel data.
     */
    function createBaseCanvas(pixels) {
        const canvas = document.createElement('canvas');
        canvas.width = cols * SCALE;
        canvas.height = rows * SCALE;
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = false;

        // Draw pixel rectangles
        ctx.fillStyle = 'white';
        for (let y = 0; y < rows; y++) {
            for (let x = 0; x < cols; x++) {
                if (pixels[y][x]) {
                    ctx.fillRect(x * SCALE, y * SCALE, SCALE, SCALE);
                }
            }
        }
        return canvas;
    }

    /**
     * Applies a vertical color gradient over a given canvas.
     */
    function applyGradientToCanvas(canvas) {
        const gradientCanvas = document.createElement('canvas');
        gradientCanvas.width = canvas.width;
        gradientCanvas.height = canvas.height;
        const ctx = gradientCanvas.getContext('2d');

        // Draw original canvas first
        ctx.drawImage(canvas, 0, 0);
        ctx.globalCompositeOperation = 'source-atop';

        // Create and apply gradient
        const gradient = ctx.createLinearGradient(0, 0, 0, gradientCanvas.height);
        gradient.addColorStop(0, PRIMARY_COLOR);
        gradient.addColorStop(1, 'black');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, gradientCanvas.width, gradientCanvas.height);

        // Restore blending mode
        ctx.globalCompositeOperation = 'source-over';
        return gradientCanvas;
    }

    /**
     * Creates a cloned canvas from the gradient canvas to cache the static image.
     */
    function createStaticBase(sourceCanvas) {
        const staticCanvas = document.createElement('canvas');
        staticCanvas.width = sourceCanvas.width;
        staticCanvas.height = sourceCanvas.height;
        const ctx = staticCanvas.getContext('2d');
        ctx.drawImage(sourceCanvas, 0, 0);
        return staticCanvas;
    }

    // ============================
    // Animation Loop
    // ============================

    /**
     * Clears the canvas, draws static name, and applies post-processing.
     */
    function animate() {
        // Clear canvas
        ctx.clearRect(0, 0, renderCanvas.width, renderCanvas.height);

        // Draw static base layer
        ctx.drawImage(staticBase, 0, 0);

        // Apply optional effects
        if (flickerEnabled) applyFlicker();
        if (grainEnabled) applyGrain();
        if (scanlinesEnabled) applyScanlines();

        // Loop
        requestAnimationFrame(animate);
    }

    // ============================
    // Post-processing Effects
    // ============================

    /**
     * Creates a subtle flicker by drawing the static layer at random opacity.
     */
    function applyFlicker() {
        ctx.globalAlpha = 0.8 + Math.random() * 0.2;
        ctx.drawImage(staticBase, 0, 0);
        ctx.globalAlpha = 1.0;
    }

    /**
     * Adds grain/noise to non-transparent pixels.
     */
    function applyGrain() {
        const imageData = ctx.getImageData(0, 0, renderCanvas.width, renderCanvas.height);
        const pixels = imageData.data;

        // Loop through RGBA pixels
        for (let i = 0; i < pixels.length; i += 4) {
            if (pixels[i + 3] === 0) continue;
            const grain = Math.floor(Math.random() * 20 - 10);
            pixels[i] = clamp(pixels[i] + grain);
            pixels[i + 1] = clamp(pixels[i + 1] + grain);
            pixels[i + 2] = clamp(pixels[i + 2] + grain);
        }

        ctx.putImageData(imageData, 0, 0);
    }

    /**
     * Draws horizontal scanlines over the entire canvas.
     */
    function applyScanlines() {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
        for (let y = 0; y < renderCanvas.height; y += 2) {
            ctx.fillRect(0, y, renderCanvas.width, 1);
        }
    }

    /**
     * Clamps a color channel value to the valid range [0, 255].
     */
    function clamp(val) {
        return Math.max(0, Math.min(255, val));
    }

    // ============================
    // Init + Resize Handling
    // ============================

    resizeAndRender();
    window.addEventListener("resize", resizeAndRender);
    requestAnimationFrame(animate);
});