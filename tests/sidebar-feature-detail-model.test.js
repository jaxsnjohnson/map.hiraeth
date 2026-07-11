const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const appSource = fs.readFileSync('js/app.js', 'utf8');

const helperStart = appSource.indexOf('function getSidebarPlainText(value) {');
const helperEnd = appSource.indexOf('function appendSidebarTextSection(parent, title, body) {');

if (helperStart === -1 || helperEnd === -1) {
    throw new Error('Could not locate sidebar detail helpers in js/app.js');
}

const helperSource = appSource.slice(helperStart, helperEnd);
const helpers = {};

function stripHtml(value) {
    return String(value || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function getPoiGroup(type) {
    if (type === 'Capital') return 'Settlements';
    return type || 'POI';
}

function resolveLinkedMapData(feature) {
    if (!feature?.linkedMapId) return null;
    return { id: feature.linkedMapId, name: 'Linked Fair District' };
}

eval(`${helperSource}
helpers.buildSidebarFeatureDetailModel = buildSidebarFeatureDetailModel;
helpers.getFeatureSearchDetailText = getFeatureSearchDetailText;
helpers.getFeatureDetailSections = getFeatureDetailSections;
helpers.getFeatureTags = getFeatureTags;`);

describe('buildSidebarFeatureDetailModel', () => {
    it('builds a full structured POI detail model with sanitized text', () => {
        const model = helpers.buildSidebarFeatureDetailModel({
            id: 'apsley',
            name: 'Apsley',
            type: 'Capital',
            summary: 'White-stone city beside the harbor.',
            description: '<p>Ministry terraces overlook the old port.</p>',
            linkedMapId: 'apsley-districts',
            properties: {
                Nation: 'Commonwealth of Half Height',
                Nested: { ignored: true },
                Population: 12000
            },
            detailSections: [
                { heading: 'At a glance', body: '<strong>Free port</strong> and capital ministries.' },
                { heading: '', body: '' }
            ],
            tags: ['Capital', '<em>Free port</em>', 'capital', null]
        }, 'poi');

        assert.equal(model.title, 'Apsley');
        assert.equal(model.typeLabel, 'Capital');
        assert.equal(model.summary, 'White-stone city beside the harbor.');
        assert.equal(model.description, 'Ministry terraces overlook the old port.');
        assert.deepEqual(model.sections, [
            { heading: 'At a glance', body: 'Free port and capital ministries.' }
        ]);
        assert.deepEqual(model.tags, ['Capital', 'Free port']);
        assert.deepEqual(model.technicalRows, [
            ['Type', 'Capital'],
            ['Linked map', 'Linked Fair District'],
            ['ID', 'apsley'],
            ['Nation', 'Commonwealth of Half Height'],
            ['Population', 12000]
        ]);
        assert.deepEqual(model.linkedMap, { id: 'apsley-districts', name: 'Linked Fair District' });
    });

    it('keeps summary-only, description-only, and facts-only POIs intentional', () => {
        const summaryOnly = helpers.buildSidebarFeatureDetailModel({
            name: 'Summary Only',
            summary: 'A short preview.'
        }, 'poi');
        assert.equal(summaryOnly.summary, 'A short preview.');
        assert.equal(summaryOnly.description, '');
        assert.deepEqual(summaryOnly.sections, []);
        assert.deepEqual(summaryOnly.tags, []);

        const descriptionOnly = helpers.buildSidebarFeatureDetailModel({
            name: 'Description Only',
            description: 'A canonical overview paragraph.'
        }, 'poi');
        assert.equal(descriptionOnly.summary, '');
        assert.equal(descriptionOnly.description, 'A canonical overview paragraph.');

        const factsOnly = helpers.buildSidebarFeatureDetailModel({
            name: 'Facts Only',
            properties: {
                Nation: 'Free City',
                IgnoreMe: ['not primitive']
            }
        }, 'poi');
        assert.deepEqual(factsOnly.technicalRows, [
            ['Type', 'Point of interest'],
            ['Nation', 'Free City']
        ]);
    });
});

describe('getFeatureSearchDetailText', () => {
    it('includes rich detail text without copying nested property values', () => {
        const searchText = helpers.getFeatureSearchDetailText({
            summary: 'Harbor market.',
            description: 'Known for auctions.',
            properties: {
                Faction: 'Harbor Guild',
                Nested: { secret: 'ignored' }
            },
            detailSections: [{ heading: 'Current tension', body: 'Dock strikes.' }],
            tags: ['Trade', 'Strike']
        });

        assert.match(searchText, /Harbor market/);
        assert.match(searchText, /Known for auctions/);
        assert.match(searchText, /Current tension Dock strikes/);
        assert.match(searchText, /Trade Strike/);
        assert.match(searchText, /Faction Harbor Guild/);
        assert.doesNotMatch(searchText, /secret/);
    });
});
