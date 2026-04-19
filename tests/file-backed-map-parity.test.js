const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const snapshotPath = path.join('tests', 'fixtures', 'active-map-inline-snapshot.json');
const snapshot = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'));

for (const [mapId, expectedMap] of Object.entries(snapshot)) {
    const actualPath = path.join('maps', `${mapId}.json`);
    assert.ok(fs.existsSync(actualPath), `${actualPath} should exist`);
    const actualMap = JSON.parse(fs.readFileSync(actualPath, 'utf8'));
    assert.deepEqual(actualMap, expectedMap, `${mapId} should preserve the migrated inline payload`);
}

console.log('file-backed map parity checks passed');
