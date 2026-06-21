#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..');
const manifestPath = path.join(repoRoot, 'maps', 'maps.json');

function readJson(fullPath) {
    return JSON.parse(fs.readFileSync(fullPath, 'utf8'));
}

function writeJson(fullPath, value) {
    fs.writeFileSync(fullPath, `${JSON.stringify(value, null, 2)}\n`);
}

function cloneJson(value) {
    return JSON.parse(JSON.stringify(value));
}

function stripHtml(value) {
    return String(value || '')
        .replace(/<[^>]*>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function normalizeText(value) {
    return stripHtml(value).replace(/\s+/g, ' ').trim();
}

function hasText(value) {
    return typeof value === 'string' && value.trim().length > 0;
}

function isPlainObject(value) {
    return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function hasPrimitiveProperties(properties) {
    if (!isPlainObject(properties)) return false;
    return Object.values(properties).some((value) => (
        value !== null &&
        value !== undefined &&
        typeof value !== 'object' &&
        String(value).trim().length > 0
    ));
}

function isArchiveEntry(entry, entriesById) {
    for (let current = entry; current; current = entriesById.get(current.parentId)) {
        const id = String(current.id || '');
        const name = String(current.name || '');
        if (id === 'IRL Old Maps' || /^OLD-|^DEV-/.test(id) || /^OLD-|^DEV-/.test(name)) {
            return true;
        }
    }
    return false;
}

function getMainMapEntries(manifest) {
    const entries = Array.isArray(manifest) ? manifest : (Array.isArray(manifest.maps) ? manifest.maps : []);
    const entriesById = new Map(entries.map((entry) => [entry.id, entry]));
    return entries.filter((entry) => entry.dataUrl && !isArchiveEntry(entry, entriesById));
}

function splitSentences(value) {
    const text = normalizeText(value);
    if (!text) return [];
    return text
        .match(/[^.!?]+[.!?]+(?:["')\]]+)?|[^.!?]+$/g)
        ?.map((sentence) => sentence.trim())
        .filter(Boolean) || [text];
}

function truncateAtWord(value, maxLength) {
    const text = normalizeText(value);
    if (text.length <= maxLength) return text;
    const candidate = text.slice(0, maxLength - 1).trim();
    const lastSpace = candidate.lastIndexOf(' ');
    if (lastSpace > 80) return `${candidate.slice(0, lastSpace).trim()}...`;
    return `${candidate}...`;
}

function hasLetterOrNumber(value) {
    return /[\p{L}\p{N}]/u.test(String(value || ''));
}

function normalizeTypeLabel(type) {
    const text = normalizeText(type);
    if (!text || text.toLowerCase() === 'unknown') return 'POI';
    return text;
}

function lowerPhrase(value) {
    const text = normalizeText(value);
    return text.toLowerCase();
}

function articleFor(value) {
    return /^[aeiou]/i.test(String(value || '').trim()) ? 'an' : 'a';
}

function escapeRegExp(value) {
    return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function createFallbackSummary(point, mapName, typeLabel) {
    const name = normalizeText(point.name);
    if (!hasLetterOrNumber(name)) return `Unlabeled location marker on ${mapName}.`;
    if (typeLabel && typeLabel !== 'POI') {
        const typeText = lowerPhrase(typeLabel);
        return `${name} is recorded as ${articleFor(typeText)} ${typeText} on ${mapName}.`;
    }
    return `${name} is recorded as a marked location on ${mapName}.`;
}

function createFallbackDescription(point, mapName, typeLabel) {
    const name = normalizeText(point.name);
    if (!hasLetterOrNumber(name)) {
        return `Unlabeled location marker on ${mapName}.`;
    }
    if (typeLabel && typeLabel !== 'POI') {
        const typeText = lowerPhrase(typeLabel);
        return `${name} is recorded as ${articleFor(typeText)} ${typeText} on ${mapName}.`;
    }
    return `${name} is recorded as a marked location on ${mapName}.`;
}

function deriveSummary(point, mapName, typeLabel) {
    if (hasText(point.summary)) return normalizeText(point.summary);
    const description = normalizeText(point.description);
    if (description) return truncateAtWord(splitSentences(description)[0] || description, 180);
    return createFallbackSummary(point, mapName, typeLabel);
}

function deriveDescription(point, mapName, typeLabel, summary) {
    if (hasText(point.description)) return normalizeText(point.description);
    if (hasText(point.summary)) return normalizeText(point.summary);
    return createFallbackDescription(point, mapName, typeLabel, summary);
}

function normalizeDetailSections(value) {
    if (!Array.isArray(value)) return [];
    return value
        .map((section) => {
            if (!isPlainObject(section)) return null;
            const heading = normalizeText(section.heading);
            const body = normalizeText(section.body);
            if (!heading && !body) return null;
            return { heading, body };
        })
        .filter(Boolean);
}

function deriveDetailSections(point, summary, description) {
    const existing = normalizeDetailSections(point.detailSections);
    if (existing.length > 0) return existing;

    const sentences = splitSentences(description);
    if (sentences.length >= 2) {
        return [
            {
                heading: 'At a glance',
                body: truncateAtWord(sentences[0], 360)
            },
            {
                heading: 'Context',
                body: truncateAtWord(sentences.slice(1).join(' '), 620)
            }
        ];
    }
    if (sentences.length >= 1) {
        return [
            {
                heading: 'At a glance',
                body: truncateAtWord(sentences.join(' '), 420)
            }
        ];
    }
    return [
        {
            heading: 'At a glance',
            body: truncateAtWord(summary, 420)
        }
    ];
}

function deriveGeneratedDetailSections(originalDescription, fallbackBody) {
    const sentences = splitSentences(originalDescription);
    if (sentences.length >= 2) {
        return [
            {
                heading: 'Context',
                body: sentences.slice(1).join(' ')
            }
        ];
    }
    return [
        {
            heading: 'At a glance',
            body: sentences[0] || fallbackBody
        }
    ];
}

function normalizeTags(value) {
    const seen = new Set();
    const tags = [];
    if (!Array.isArray(value)) return tags;
    value.forEach((tag) => {
        const text = normalizeText(tag);
        const key = text.toLowerCase();
        if (!text || seen.has(key)) return;
        seen.add(key);
        tags.push(text);
    });
    return tags;
}

function addTag(tags, seen, value) {
    const text = normalizeText(value);
    const key = text.toLowerCase();
    if (!text || seen.has(key)) return;
    seen.add(key);
    tags.push(text);
}

const keywordTags = [
    [/capital/i, 'Capital'],
    [/\bembass?y|\bembass?ies|\bchancery\b/i, 'Diplomacy'],
    [/gate/i, 'Gate'],
    [/\bports?\b|\bfree-port\b|\bdocks?\b|\bdockside\b/i, 'Harbor'],
    [/\btemple\b|\bshrine\b|\bchapel\b/i, 'Sacred site'],
    [/\binn\b|\btavern\b|\bpub\b|\bbrewery\b/i, 'Hospitality'],
    [/\bmarket\b|\bmerchant\b|\bcoin\b|\bbank\b|\bcoffers?\b/i, 'Commerce'],
    [/\blibrary\b|\bschool\b|\binstitute\b|\bathenaeum\b/i, 'Learning'],
    [/\bcastle\b|\bmanor\b|\bfort\b|\bfortress\b|\boffices?\b/i, 'Seat of power'],
    [/\bcrypt\b|\bgrave\b|\bgallows\b|\btomb\b/i, 'Death'],
    [/\barcane\b|\bmagic\b|\bmagical\b/i, 'Magic'],
    [/\bforest\b|\bwoods?\b|\bmoor\b|\bwallow\b/i, 'Wilderness'],
    [/\bmount\b|\bmt\.?\b|\bmountain\b|\bpeak\b/i, 'Mountain'],
    [/\bisland\b|\bisle\b/i, 'Island'],
    [/\bbridge\b|\bcrossing\b/i, 'Crossing']
];

function deriveTags(point, mapName, typeLabel, summary, description) {
    const tags = normalizeTags(point.tags);
    const seen = new Set(tags.map((tag) => tag.toLowerCase()));
    const name = normalizeText(point.name);
    const mapNamePattern = new RegExp(escapeRegExp(mapName), 'gi');
    const searchText = `${name} ${typeLabel} ${summary} ${description}`.replace(mapNamePattern, '');

    const genericTypes = new Set(['poi', 'point of interest', 'unknown']);

    if (!hasLetterOrNumber(name)) addTag(tags, seen, 'Unlabeled marker');
    if (typeLabel && !genericTypes.has(typeLabel.toLowerCase())) addTag(tags, seen, typeLabel);
    addTag(tags, seen, mapName);

    keywordTags.forEach(([pattern, tag]) => {
        if (tags.length >= 6) return;
        if (pattern.test(searchText)) addTag(tags, seen, tag);
    });

    if (tags.length === 0) addTag(tags, seen, 'POI');
    return tags.slice(0, 6);
}

function ensureProperties(point, mapName) {
    const properties = isPlainObject(point.properties) ? cloneJson(point.properties) : {};
    if (!hasPrimitiveProperties(properties)) {
        properties.Map = mapName;
    }
    return properties;
}

function enrichPoint(point, mapName) {
    const enriched = isPlainObject(point) ? point : {};
    const typeLabel = normalizeTypeLabel(enriched.type);
    const originalDescription = normalizeText(enriched.description);
    const existingSections = normalizeDetailSections(enriched.detailSections);
    const summary = deriveSummary(enriched, mapName, typeLabel);
    let description = deriveDescription(enriched, mapName, typeLabel, summary);
    let detailSections = existingSections;

    if (detailSections.length === 0) {
        if (originalDescription) {
            const firstSentence = splitSentences(originalDescription)[0] || originalDescription;
            description = firstSentence;
            detailSections = deriveGeneratedDetailSections(originalDescription, description);
        } else {
            description = summary;
            detailSections = deriveGeneratedDetailSections('', summary);
        }
    }

    const tagSearchDescription = [
        description,
        ...detailSections.map((section) => section.body)
    ].join(' ');

    enriched.summary = summary;
    enriched.description = description;
    enriched.properties = ensureProperties(enriched, mapName);
    enriched.detailSections = detailSections.length > 0
        ? detailSections
        : deriveDetailSections(enriched, summary, description);
    enriched.tags = deriveTags(enriched, mapName, typeLabel, summary, tagSearchDescription);
    return enriched;
}

function enrichMapFile(entry) {
    const fullPath = path.join(repoRoot, entry.dataUrl);
    const mapDocument = readJson(fullPath);
    const points = Array.isArray(mapDocument.pointsOfInterest) ? mapDocument.pointsOfInterest : [];
    points.forEach((point) => enrichPoint(point, mapDocument.name || entry.name));
    writeJson(fullPath, mapDocument);
    return { file: entry.dataUrl, points: points.length };
}

function main() {
    const manifest = readJson(manifestPath);
    const results = getMainMapEntries(manifest)
        .map(enrichMapFile)
        .filter((result) => result.points > 0);

    const totalPoints = results.reduce((sum, result) => sum + result.points, 0);
    console.log(`Enriched ${totalPoints} POIs across ${results.length} main map files.`);
    results.forEach((result) => {
        console.log(`- ${result.file}: ${result.points}`);
    });
}

main();
