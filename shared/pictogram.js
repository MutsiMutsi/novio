/**
 * Generates a unique 8x8 pictogram from any string and displays it in a DOM element
 * @param {HTMLElement} element - The DOM element to populate with the pictogram
 * @param {string} text - The string to use as hash source for generating the pictogram
 * @param {number} size - The size in pixels for the entire pictogram (width and height)
 */
function generatePictogram(element, text, size) {
    // Simple hash function
    function simpleHash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return Math.abs(hash);
    }

    // Generate multiple hash values for different aspects
    function generateHashes(str) {
        const hash1 = simpleHash(str);
        const hash2 = simpleHash(str + "salt1");
        const hash3 = simpleHash(str + "salt2");
        const hash4 = simpleHash(str + "colors");
        return { hash1, hash2, hash3, hash4 };
    }

    // Seeded random number generator
    function mulberry32(a) {
        let t = a += 0x6D2B79F5;
        t = Math.imul(t ^ t >>> 15, t | 1);
        t ^= t + Math.imul(t ^ t >>> 7, t | 61);
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    }

    // Generate color palette from hash
    function generateColors(hash) {
        const colors = [];
        let h = hash;

        for (let i = 0; i < 6; i++) {
            const hue = mulberry32(h + i * 5345238407831) < 0.5 ? 45 : 192;
            const saturation = 20.0 + mulberry32(h + i * 54267349129) * 35.0;
            const lightness = 55.0 + mulberry32(h + i * 86738671207) * 35.0;

            colors.push(`hsl(${hue}, ${saturation}%, ${lightness}%)`);
            h = (h * 1.618) % 1000; // Golden ratio for variety
        }

        return colors;
    }

    // Generate symmetric pattern for visual appeal
    function generatePattern(hash1, hash2, hash3) {
        const pattern = new Array(64).fill(0);

        // Generate left half (4x8) - 32 pixels total, so 16 pixels for left half
        const leftHalfPixels = [];
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 4; col++) {
                const index = row * 8 + col;
                const seed = hash1 + row * hash2 + col * hash3;

                // Use multiple factors to create interesting patterns
                const probability = (Math.sin(seed * 0.01) + 1) / 2;
                const threshold = 0.3 + 0.4 * (Math.cos(seed * 0.005) + 1) / 2;

                leftHalfPixels.push({
                    index: index,
                    probability: probability,
                    threshold: threshold,
                    seed: seed
                });
            }
        }

        // Sort by probability to control fill percentage
        leftHalfPixels.sort((a, b) => b.probability - a.probability);

        // Ensure 25-75% fill rate (16-48 pixels total, so 8-24 pixels in left half)
        const minFilled = Math.ceil(16 * 0.45); // At least 8 pixels in left half
        const maxFilled = Math.floor(16 * 0.85); // At most 24 pixels in left half

        // Determine actual fill count based on hash
        const fillRange = maxFilled - minFilled;
        const fillCount = minFilled + (Math.abs(hash3) % (fillRange + 1));

        // Fill the top probability pixels up to fillCount
        for (let i = 0; i < fillCount; i++) {
            const pixel = leftHalfPixels[i];
            const colorIndex = Math.abs(pixel.seed) % 6;
            pattern[pixel.index] = colorIndex + 1;
        }

        // Mirror to right half for symmetry
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 4; col++) {
                const leftIndex = row * 8 + col;
                const rightIndex = row * 8 + (7 - col);
                pattern[rightIndex] = pattern[leftIndex];
            }
        }

        return pattern;
    }

    // Clear the element
    element.innerHTML = '';

    // Return early if no text
    if (!text || !text.trim()) {
        return;
    }

    // Calculate pixel size
    const pixelSize = size / 8;
    const gap = Math.max(1, Math.floor(pixelSize * 0.1)); // 10% gap, minimum 1px
    const actualPixelSize = pixelSize - gap;

    // Set up the container element
    element.style.display = 'grid';
    element.style.gridTemplateColumns = 'repeat(8, 1fr)';
    element.style.gap = `${gap}px`;
    element.style.width = `${size}px`;
    element.style.height = `${size}px`;
    element.style.padding = `${Math.floor(gap * 2)}px`;
    element.style.backgroundColor = 'rgba(0, 0, 0, 0.1)';
    element.style.borderRadius = `${Math.floor(size * 0.1)}px`;
    element.style.boxSizing = 'border-box';

    // Generate the pictogram data
    const hashes = generateHashes(text);
    const colors = generateColors(hashes.hash4);
    const pattern = generatePattern(hashes.hash1, hashes.hash2, hashes.hash3);

    // Create pixels
    for (let i = 0; i < 64; i++) {
        const pixel = document.createElement('div');
        pixel.style.width = `${actualPixelSize}px`;
        pixel.style.height = `${actualPixelSize}px`;
        pixel.style.borderRadius = `${Math.floor(actualPixelSize * 0.2)}px`;

        if (pattern[i] > 0) {
            pixel.style.backgroundColor = colors[pattern[i] - 1];
        } else {
            pixel.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
        }

        element.appendChild(pixel);
    }
}