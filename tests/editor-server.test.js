const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');

const {
    assertLoopbackBindHost,
    createEditorServer,
    isAllowedEditorWriteRequest,
    isLoopbackHost,
    resolveMapTargetPath,
    validateAtlasManifestDocument,
    validateMapDocument
} = require('../scripts/editor_server.js');

const repoRoot = path.join(os.tmpdir(), 'map-editor-server-test');

assert.equal(isLoopbackHost('127.0.0.1'), true);
assert.equal(isLoopbackHost('127.10.20.30'), true);
assert.equal(isLoopbackHost('localhost'), true);
assert.equal(isLoopbackHost('::1'), true);
assert.equal(isLoopbackHost('0.0.0.0'), false);
assert.equal(isLoopbackHost('192.168.1.20'), false);
assert.throws(() => assertLoopbackBindHost('0.0.0.0'), /Refusing to start editor server/);

assert.equal(isAllowedEditorWriteRequest({
    headers: {
        host: '127.0.0.1:8010',
        origin: 'http://127.0.0.1:8010'
    }
}), true);
assert.equal(isAllowedEditorWriteRequest({
    headers: {
        host: 'localhost:8010',
        origin: 'http://localhost:8010'
    }
}), true);
assert.equal(isAllowedEditorWriteRequest({
    headers: {
        host: 'editor.localhost:8010',
        referer: 'http://editor.localhost:8010/map-editor.html'
    }
}), true);
assert.equal(isAllowedEditorWriteRequest({
    headers: {
        host: '127.0.0.1:8010',
        origin: 'http://evil.example'
    }
}), false);
assert.equal(isAllowedEditorWriteRequest({
    headers: {
        host: '127.0.0.1:8010',
        origin: 'http://localhost:8010'
    }
}), false);
assert.equal(isAllowedEditorWriteRequest({
    headers: {
        host: '0.0.0.0:8010',
        origin: 'http://0.0.0.0:8010'
    }
}), false);
assert.equal(isAllowedEditorWriteRequest({ headers: { host: '127.0.0.1:8010' } }), true);

assert.equal(
    resolveMapTargetPath(repoRoot, { dataUrl: 'maps/IceBeach.json' }).relativePath,
    'maps/IceBeach.json'
);
assert.equal(
    resolveMapTargetPath(repoRoot, { fileName: 'IceBeach.json' }).relativePath,
    'maps/IceBeach.json'
);
assert.equal(
    resolveMapTargetPath(repoRoot, { mapId: 'IceBeach' }).relativePath,
    'maps/IceBeach.json'
);

[
    { dataUrl: '../secrets.json' },
    { dataUrl: 'maps/generated/IceBeach.json' },
    { dataUrl: 'maps/maps.json' },
    { dataUrl: 'maps/atlas-index.json' },
    { dataUrl: '/tmp/IceBeach.json' }
].forEach((payload) => {
    assert.throws(() => resolveMapTargetPath(repoRoot, payload), /Map saves can only target|Use Save Atlas Structure/);
});

assert.deepEqual(validateMapDocument({ id: 'map', name: 'Map', pointsOfInterest: [], regions: [] }), []);
assert.match(validateMapDocument(null).join(' '), /Map document must be a JSON object/);
assert.match(validateMapDocument({ id: '', name: '' }).join(' '), /id is required/);
assert.match(validateMapDocument({ id: 'map', name: 'Map', regions: {} }).join(' '), /regions must be an array/);

assert.deepEqual(validateAtlasManifestDocument([
    { id: 'root', name: 'Root' },
    { id: 'child', name: 'Child', parentId: 'root' }
]), []);
assert.match(validateAtlasManifestDocument({}).join(' '), /Atlas structure must be an array/);
assert.match(validateAtlasManifestDocument([
    { id: 'root', name: 'Root' },
    { id: 'root', name: 'Duplicate' }
]).join(' '), /Duplicate id/);
assert.match(validateAtlasManifestDocument([
    { id: 'child', name: 'Child', parentId: 'missing' }
]).join(' '), /unknown parentId/);

assert.equal(typeof createEditorServer({ repoRoot }).listen, 'function');

console.log('editor server checks passed');
