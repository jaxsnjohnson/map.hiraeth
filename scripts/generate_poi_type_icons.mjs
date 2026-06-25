import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const sourceDir = path.join(repoRoot, 'images', 'poi-icons');
const distDir = path.join(repoRoot, 'dist', 'images', 'poi-icons');

const PNG_EXPORT_HEIGHT = 512;
const MARKER_VIEW_BOX = '3 0 18 24';
const PIN_PATH = 'M12 1C7.03 1 3 5.03 3 10c0 5.25 7.1 12.43 8.4 13.67a1 1 0 0 0 1.2 0C13.9 22.43 21 15.25 21 10c0-4.97-4.03-9-9-9z';

// Pin colors intentionally follow the app's POI groups.
const pinCategoryColors = {
    settlements: '#2f7dff',
    structures: '#8b5cf6',
    natural: '#16a34a',
    other: '#f59e0b',
    unknown: '#6b7280'
};

const glyphs = {
    groupSettlements: 'M8 14h8v-5h-1v-2h-2v2h-2v-2H9v2H8v5zm1-4h1v1H9v-1zm5 0h1v1h-1v-1z',
    groupStructures: 'M8 14V9.5l4-2.5 4 2.5V14h-2v-3h-4v3H8zm3-4h2l-1-1.3L11 10z',
    capital: 'M7 14h10l-.8-5-2.6 2L12 6.5 10.4 11 7.8 9 7 14zm1 1.2h8V16H8v-.8z',
    city: 'M7.5 14.5h9V8.8h-1.2V7h-2v1.8h-2.6V7h-2v1.8H7.5v5.7zm1.4-4.3h1.1v1.1H8.9v-1.1zm5.1 0h1.1v1.1H14v-1.1z',
    town: 'M7.5 14.5v-4.2L10.8 8l3.3 2.3v4.2h-2v-2.7H9.5v2.7h-2zm7.2 0v-3.2l1.8 1.2v2h-1.8z',
    settlement: 'M8 14.5v-4.2L12 7l4 3.3v4.2h-2.2v-3.2h-3.6v3.2H8z',
    fortress: 'M7.5 14.5V8.8h1.4V7h1.8v1.8h2.6V7h1.8v1.8h1.4v5.7h-2.1v-2.8H9.6v2.8H7.5z',
    ruin: 'M8 15h8v1H8v-1zm1-1.3h1.5V9H9V7.7h5.2l-.6 1.3H12v4.7h1.8V9.8h1.5v3.9H16V15H8v-1.3h1z',
    mountain: 'M7.5 14 11 8.8l1.4 2.1L14 8.5 17 14h-2.2L14 12.8 12.2 14h-1.4L11 12.6 9.7 14H7.5z',
    naturalLandmark: 'M7 14.2 10.7 8.8l1.2 1.8 1.5-2.3 3.1 5.9h-2l-.8-1.2-1.6 1.2H7zm8.2-7.5.5 1 1.1.2-.8.8.2 1.1-1-.5-1 .5.2-1.1-.8-.8 1.1-.2.5-1z',
    portal: 'M8 14.8V11a4 4 0 0 1 8 0v3.8h-2V11a2 2 0 0 0-4 0v3.8H8zm2.6-1.6h2.8l-1.4-2.1-1.4 2.1z',
    region: 'M8 15.5V7h1.2v1h5.9l-1 2 1 2H9.2v3.5H8z',
    pointOfInterest: 'm12 7 1.1 2.2 2.4.3-1.8 1.7.4 2.4-2.1-1.1-2.1 1.1.4-2.4-1.8-1.7 2.4-.3L12 7z',
    landmark: 'M11.2 6.8h1.6l.9 6.4h1.3v1.4H9v-1.4h1.3l.9-6.4zm-2.7 8.3h7v.9h-7v-.9z',
    temple: 'M7.5 9.3 12 6.8l4.5 2.5v1H7.5v-1zm.7 1.7h1.2v3.4H8.2V11zm2.2 0h1.2v3.4h-1.2V11zm2.2 0h1.2v3.4h-1.2V11zm2.2 0H16v3.4h-1.2V11zM7.5 15h9v1h-9v-1z',
    shrine: 'M9 14.8v-3.3l3-4.5 3 4.5v3.3h-2v-2.4h-2v2.4H9zm2.2-4h1.6L12 9.6l-.8 1.2z',
    tavern: 'M8 8h5.8v4.2a2.8 2.8 0 0 1-5.6 0V8zm6.2 1.2h.6a1.7 1.7 0 0 1 0 3.4h-.6v-1.2h.6a.5.5 0 0 0 0-1h-.6V9.2zM8.5 15h5.2v1H8.5v-1z',
    building: 'M8 15V7.5h5v2h3V15h-2v-2h-1.5v2H8zm1.4-5.8h1.1v1.1H9.4V9.2zm0 2h1.1v1.1H9.4v-1.1zm3.9 0h1.1v1.1h-1.1v-1.1z',
    dockTrading: 'M8 14.5h8v1H8v-1zm.4-2.2 1.1-.9 1.1.9 1.1-.9 1.1.9 1.1-.9 1.1.9v.9l-1.1-.8-1.1.8-1.1-.8-1.1.8-1.1-.8-1.1.8v-.9zm3-5.3h1.2v3h2v1.2H9.4V10h2V7z',
    marketTrade: 'M8 14.5h8v1H8v-1zm1-1.3h2.2v-3H9v3zm3.8 0H15v-3h-2.2v3zM8.7 9.2h6.6L14.6 7H9.4l-.7 2.2z',
    gate: 'M7.5 15V9.5a4.5 4.5 0 0 1 9 0V15h-2v-5.2a2.5 2.5 0 0 0-5 0V15h-2zm3.2 0v-3.2h2.6V15h-2.6z',
    bridge: 'M7.5 14.6v-1.2h9v1.2h-9zm.5-2.1a4 4 0 0 1 8 0h-1.5a2.5 2.5 0 0 0-5 0H8zm1.2-2.8h5.6v1H9.2v-1z',
    tower: 'M9 15V8.8h1.2V7h3.6v1.8H15V15h-2v-2.5h-2V15H9zm1.5-4.7h3v-1h-3v1z',
    lighthouse: 'M9.2 15 10 8.8h4l.8 6.2h-5.6zm1.5-1.2h2.6l-.2-1.5h-2.2l-.2 1.5zm.3-2.7h2l-.2-1.2h-1.6l-.2 1.2zm-1.4-3.5 2.4-1.2 2.4 1.2v1H9.6v-1z',
    dungeon: 'M7.5 14.5v-2.9a4.5 4.5 0 0 1 9 0v2.9h-9zm1.6-1.5h1.2v-2.1H9.1V13zm2.3 0h1.2v-2.7h-1.2V13zm2.3 0h1.2v-2.1h-1.2V13z',
    cave: 'M7 14.5c.7-3.4 2.3-5.9 5-7.5 2.7 1.6 4.3 4.1 5 7.5h-3.2c-.2-1.5-.8-2.5-1.8-3.1-1 .6-1.6 1.6-1.8 3.1H7z',
    mine: 'M8.3 14.7 7.2 13.6l3-3-.9-.9 1-1 3 3-1 1-.9-.9-3.1 2.9zm5.3-5.5 1.1-1.1 2 2-1.1 1.1-2-2zm-2.4-1.8.9-.9 1.6 1.6-.9.9-1.6-1.6z',
    camp: 'M7.3 14.8 12 7l4.7 7.8h-2.2L12 10.6l-2.5 4.2H7.3zm3.2 0 1.5-2.5 1.5 2.5h-3z',
    asylum: 'M8 15V8.5h2V7h4v1.5h2V15h-2.5v-2h-3v2H8zm3.3-4.8h1.4V8.8h-1.4v1.4zm-1.4 1.4h4.2v1.1H9.9v-1.1z',
    unknown: 'M12 13.9a1 1 0 0 1-1-1c0-1.1.7-1.7 1.3-2.2.6-.5 1-.8 1-1.4a1.3 1.3 0 0 0-2.6 0H8.9a3.1 3.1 0 0 1 6.2 0c0 1.4-.9 2.1-1.5 2.6-.5.4-.8.7-.8 1h-1.8zm0 2.6a1 1 0 1 1 0-2 1 1 0 0 1 0 2z'
};

const groupIcons = [
    { name: 'settlements', category: 'settlements', glyph: 'groupSettlements' },
    { name: 'structures', category: 'structures', glyph: 'groupStructures' },
    { name: 'natural-features', category: 'natural', glyph: 'mountain' },
    { name: 'other', category: 'other', glyph: 'pointOfInterest' },
    { name: 'unknown', category: 'unknown', glyph: 'unknown' }
];

const typeIcons = [
    { name: 'capital', category: 'settlements', glyph: 'capital' },
    { name: 'city', category: 'settlements', glyph: 'city' },
    { name: 'town', category: 'settlements', glyph: 'town' },
    { name: 'village', category: 'settlements', glyph: 'settlement' },
    { name: 'hamlet', category: 'settlements', glyph: 'settlement' },
    { name: 'settlement', category: 'settlements', glyph: 'settlement' },
    { name: 'castle', category: 'structures', glyph: 'fortress' },
    { name: 'fortress', category: 'structures', glyph: 'fortress' },
    { name: 'fort', category: 'structures', glyph: 'fortress' },
    { name: 'ruin', category: 'structures', glyph: 'ruin' },
    { name: 'temple', category: 'structures', glyph: 'temple' },
    { name: 'shrine', category: 'structures', glyph: 'shrine' },
    { name: 'tower', category: 'structures', glyph: 'tower' },
    { name: 'mine', category: 'structures', glyph: 'mine' },
    { name: 'lighthouse', category: 'structures', glyph: 'lighthouse' },
    { name: 'bridge', category: 'structures', glyph: 'bridge' },
    { name: 'gate', category: 'structures', glyph: 'gate' },
    { name: 'dungeon', category: 'structures', glyph: 'dungeon' },
    { name: 'lair', category: 'structures', glyph: 'dungeon' },
    { name: 'camp', category: 'structures', glyph: 'camp' },
    { name: 'asylum', category: 'structures', glyph: 'asylum' },
    { name: 'landmark', category: 'structures', glyph: 'landmark' },
    { name: 'building', category: 'structures', glyph: 'building' },
    { name: 'mountain', category: 'natural', glyph: 'mountain' },
    { name: 'peak', category: 'natural', glyph: 'mountain' },
    { name: 'natural-landmark', category: 'natural', glyph: 'naturalLandmark' },
    { name: 'forest', category: 'natural', glyph: 'naturalLandmark' },
    { name: 'wood', category: 'natural', glyph: 'naturalLandmark' },
    { name: 'river', category: 'natural', glyph: 'naturalLandmark' },
    { name: 'lake', category: 'natural', glyph: 'naturalLandmark' },
    { name: 'cave', category: 'natural', glyph: 'cave' },
    { name: 'cavern', category: 'natural', glyph: 'cave' },
    { name: 'coast', category: 'natural', glyph: 'naturalLandmark' },
    { name: 'bay', category: 'natural', glyph: 'naturalLandmark' },
    { name: 'cove', category: 'natural', glyph: 'naturalLandmark' },
    { name: 'swamp', category: 'natural', glyph: 'naturalLandmark' },
    { name: 'marsh', category: 'natural', glyph: 'naturalLandmark' },
    { name: 'desert', category: 'natural', glyph: 'naturalLandmark' },
    { name: 'point-of-interest', category: 'other', glyph: 'pointOfInterest' },
    { name: 'region', category: 'other', glyph: 'region' },
    { name: 'portal', category: 'other', glyph: 'portal' },
    { name: 'tavern', category: 'other', glyph: 'tavern' },
    { name: 'dock-trading', category: 'other', glyph: 'dockTrading' },
    { name: 'market-trade', category: 'other', glyph: 'marketTrade' }
];

const icons = [...groupIcons, ...typeIcons].map((icon) => {
    const color = pinCategoryColors[icon.category];
    const glyph = glyphs[icon.glyph];
    if (!color) throw new Error(`Missing POI icon category color: ${icon.category}`);
    if (!glyph) throw new Error(`Missing POI icon glyph: ${icon.glyph}`);
    return { ...icon, color, glyph };
});

function renderSvg(icon) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="24" viewBox="${MARKER_VIEW_BOX}" aria-hidden="true">
  <path fill="${icon.color}" d="${PIN_PATH}"/>
  <path fill="#ffffff" d="${icon.glyph}"/>
</svg>
`;
}

async function loadSharp() {
    const specifier = process.env.SHARP_MODULE_PATH || 'sharp';
    try {
        return (await import(specifier)).default;
    } catch (error) {
        if (process.env.SHARP_MODULE_PATH) {
            throw error;
        }
        const hint = 'Set SHARP_MODULE_PATH to a sharp module path to export PNG files.';
        console.warn(`Could not load sharp. SVG files will still be written. ${hint}`);
        return null;
    }
}

async function writeTextIfChanged(filePath, content) {
    try {
        const previous = await fs.readFile(filePath, 'utf8');
        if (previous === content) return false;
    } catch (error) {
        if (error.code !== 'ENOENT') throw error;
    }
    await fs.writeFile(filePath, content);
    return true;
}

async function writePng(sharp, filePath, svg) {
    if (!sharp) return false;
    const buffer = await sharp(Buffer.from(svg))
        .resize({ height: PNG_EXPORT_HEIGHT })
        .png()
        .toBuffer();
    try {
        const previous = await fs.readFile(filePath);
        if (previous.equals(buffer)) return false;
    } catch (error) {
        if (error.code !== 'ENOENT') throw error;
    }
    await fs.writeFile(filePath, buffer);
    return true;
}

await fs.mkdir(sourceDir, { recursive: true });
await fs.mkdir(distDir, { recursive: true });

const sharp = await loadSharp();
let svgCount = 0;
let pngCount = 0;

for (const icon of icons) {
    const svg = renderSvg(icon);
    for (const dir of [sourceDir, distDir]) {
        if (await writeTextIfChanged(path.join(dir, `${icon.name}.svg`), svg)) svgCount++;
        if (await writePng(sharp, path.join(dir, `${icon.name}.png`), svg)) pngCount++;
    }
}

console.log(`Generated ${icons.length} POI icons at ${PNG_EXPORT_HEIGHT}px high.`);
console.log(`Updated ${svgCount} SVG files and ${pngCount} PNG files.`);
console.log(`Wrote assets to ${path.relative(repoRoot, sourceDir)} and ${path.relative(repoRoot, distDir)}.`);
