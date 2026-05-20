import { describe, it, expect } from 'bun:test';
import * as fs from 'node:fs';

const appSource = fs.readFileSync('js/app.js', 'utf8');

const formatStart = appSource.indexOf('function formatPropertiesForPopup(properties, hasFollowingDescription) {');
const formatEnd = appSource.indexOf('function escapeHtml(value) {');

if (formatStart === -1 || formatEnd === -1) {
    throw new Error('Could not locate formatPropertiesForPopup in js/app.js');
}

const buildStart = appSource.indexOf('function buildPopupFullContent(data, safeDescription) {');
const buildEnd = appSource.indexOf('function buildPopupMainContainer(safeSummary, fullContentInnerHtml, hasSummary, hasFullContent) {');

if (buildStart === -1 || buildEnd === -1) {
    throw new Error('Could not locate buildPopupFullContent in js/app.js');
}

const formatSource = appSource.slice(formatStart, formatEnd);
const buildSource = appSource.slice(buildStart, buildEnd);

let formatPropertiesForPopup;
eval(`formatPropertiesForPopup = ${formatSource}`);

let buildPopupFullContent;
eval(`buildPopupFullContent = ${buildSource}`);

describe('buildPopupFullContent', () => {
    it('should include region info and safe description for regions', () => {
        const result = buildPopupFullContent({ type: 'Region', value: 'North' }, 'Safe description');
        expect(result).toContain('<p><em>Region: North</em></p>');
        expect(result).toContain('<p>Safe description</p>');
    });

    it('should include POI info with capitalized type and no empty description block', () => {
        const result = buildPopupFullContent({ type: 'town' }, '');
        expect(result).toContain('<p><em>Type: Town</em></p>');
        expect(result).not.toContain('<p></p>');
    });

    it('should include properties and safe description for data with properties', () => {
        const result = buildPopupFullContent({ type: 'road', properties: { Surface: 'Dirt', Length: '10 miles' } }, 'A long road');
        expect(result).toContain('<p><em>Type: Road</em></p>');
        expect(result).toContain('<strong>Surface:</strong> Dirt');
        expect(result).toContain('<strong>Length:</strong> 10 miles');
        expect(result).toContain('<p>A long road</p>');
    });

    it('should include properties and no type info if type is absent', () => {
        const result = buildPopupFullContent({ properties: { Elevation: '1000m' } }, null);
        expect(result).toContain('<strong>Elevation:</strong> 1000m');
        expect(result).not.toContain('<p><em>');
    });

    it('should return empty string for empty data and no description', () => {
        const result = buildPopupFullContent({}, '');
        expect(result).toBe('');
    });
});
