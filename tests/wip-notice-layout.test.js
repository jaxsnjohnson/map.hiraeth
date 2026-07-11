const assert = require('node:assert/strict');
const fs = require('node:fs');

const indexSource = fs.readFileSync('index.html', 'utf8');
const styleSource = fs.readFileSync('css/style.css', 'utf8');

const mapContainerStart = indexSource.indexOf('<div id="map-container">');
const noticeIndex = indexSource.indexOf('<div id="wip-popup" role="status">');
const featureDetailIndex = indexSource.indexOf('<div id="feature-detail-backdrop"');

assert.ok(mapContainerStart >= 0 && noticeIndex > mapContainerStart && noticeIndex < featureDetailIndex);
assert.match(
    styleSource,
    /#wip-popup \{[\s\S]*position: absolute;[\s\S]*top: 12px;[\s\S]*left: 50%;[\s\S]*pointer-events: none;/
);
assert.match(styleSource, /animation: dismissWipNotice 260ms ease 6s forwards;/);

console.log('WIP notice layout checks passed');
