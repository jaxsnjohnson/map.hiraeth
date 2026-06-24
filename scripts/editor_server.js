#!/usr/bin/env node

const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const DEFAULT_HOST = '127.0.0.1';
const DEFAULT_PORT = 8010;
const MAX_BODY_BYTES = 25 * 1024 * 1024;

const MIME_TYPES = {
    '.css': 'text/css; charset=utf-8',
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.mp3': 'audio/mpeg',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.webp': 'image/webp',
    '.jpeg': 'image/jpeg',
    '.jpg': 'image/jpeg'
};

function normalizeHost(host) {
    return String(host || '').trim().toLowerCase().replace(/^\[|\]$/g, '');
}

function isLoopbackHost(host) {
    const normalized = normalizeHost(host);
    return normalized === 'localhost' ||
        normalized === '::1' ||
        normalized === '0:0:0:0:0:0:0:1' ||
        normalized === DEFAULT_HOST ||
        /^127\./.test(normalized);
}

function isLocalEditorHostname(host) {
    const normalized = normalizeHost(host);
    return isLoopbackHost(normalized) || normalized.endsWith('.localhost');
}

function assertLoopbackBindHost(host) {
    if (!isLoopbackHost(host)) {
        throw new Error(`Refusing to start editor server on non-loopback host "${host}". Use ${DEFAULT_HOST}.`);
    }
}

function getDefaultPortForProtocol(protocol) {
    return protocol === 'https:' ? '443' : '80';
}

function parseHostHeader(hostHeader) {
    const rawHost = String(hostHeader || '').trim();
    if (!rawHost) return null;
    try {
        const parsed = new URL(`http://${rawHost}`);
        return {
            hostname: normalizeHost(parsed.hostname),
            port: parsed.port || '80'
        };
    } catch (error) {
        return null;
    }
}

function isSameLocalEditorOrigin(originValue, hostHeader) {
    const requestHost = parseHostHeader(hostHeader);
    if (!requestHost || !isLocalEditorHostname(requestHost.hostname)) return false;

    try {
        const originUrl = new URL(originValue);
        if (originUrl.protocol !== 'http:' && originUrl.protocol !== 'https:') return false;

        const originHostname = normalizeHost(originUrl.hostname);
        const originPort = originUrl.port || getDefaultPortForProtocol(originUrl.protocol);

        return isLocalEditorHostname(originHostname) &&
            originHostname === requestHost.hostname &&
            originPort === requestHost.port;
    } catch (error) {
        return false;
    }
}

function isAllowedEditorWriteRequest(request) {
    const origin = String(request.headers.origin || '').trim();
    if (origin) return isSameLocalEditorOrigin(origin, request.headers.host);

    const referer = String(request.headers.referer || '').trim();
    if (referer) return isSameLocalEditorOrigin(referer, request.headers.host);

    return false;
}

function resolveRepoPath(repoRoot, relativePath) {
    const fullPath = path.resolve(repoRoot, relativePath);
    if (!fullPath.startsWith(`${repoRoot}${path.sep}`) && fullPath !== repoRoot) {
        throw new Error(`Path escapes repository root: ${relativePath}`);
    }
    return fullPath;
}

function resolveMapTargetPath(repoRoot, payload) {
    const rawPath = String(payload?.dataUrl || payload?.fileName || '').trim() ||
        `maps/${String(payload?.mapId || 'map').trim()}.json`;
    const candidate = rawPath.includes('/') ? rawPath : `maps/${rawPath}`;
    const normalized = path.posix.normalize(candidate);

    if (
        normalized.startsWith('../') ||
        normalized.startsWith('/') ||
        !normalized.startsWith('maps/') ||
        path.posix.dirname(normalized) !== 'maps' ||
        !normalized.endsWith('.json')
    ) {
        throw new Error('Map saves can only target top-level maps/*.json files.');
    }

    const basename = path.posix.basename(normalized);
    if (basename === 'maps.json' || basename === 'atlas-index.json') {
        throw new Error('Use Save Atlas Structure for maps.json. atlas-index.json is generated.');
    }

    return {
        relativePath: normalized,
        fullPath: resolveRepoPath(repoRoot, normalized)
    };
}

function getManifestEntries(manifestDocument) {
    if (Array.isArray(manifestDocument)) return manifestDocument;
    if (manifestDocument && Array.isArray(manifestDocument.maps)) return manifestDocument.maps;
    return null;
}

function validateMapDocument(document) {
    const errors = [];
    if (!document || typeof document !== 'object' || Array.isArray(document)) {
        return ['Map document must be a JSON object.'];
    }
    if (!String(document.id || '').trim()) errors.push('Map document id is required.');
    if (!String(document.name || '').trim()) errors.push('Map document name is required.');
    if (document.pointsOfInterest !== undefined && !Array.isArray(document.pointsOfInterest)) {
        errors.push('pointsOfInterest must be an array when present.');
    }
    if (document.regions !== undefined && !Array.isArray(document.regions)) {
        errors.push('regions must be an array when present.');
    }
    if (document.lines !== undefined && !Array.isArray(document.lines)) {
        errors.push('lines must be an array when present.');
    }
    if (document.roads !== undefined && !Array.isArray(document.roads)) {
        errors.push('roads must be an array when present.');
    }
    return errors;
}

function validateAtlasManifestDocument(document) {
    const entries = getManifestEntries(document);
    const errors = [];
    if (!entries) return ['Atlas structure must be an array or an object with a maps array.'];

    const ids = new Set();
    entries.forEach((entry, index) => {
        if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
            errors.push(`Entry ${index} must be an object.`);
            return;
        }
        const id = String(entry.id || '').trim();
        const name = String(entry.name || '').trim();
        if (!id) errors.push(`Entry ${index} id is required.`);
        if (!name) errors.push(`Entry ${index} name is required.`);
        if (id && ids.has(id)) errors.push(`Duplicate id "${id}".`);
        if (id) ids.add(id);
    });

    entries.forEach((entry, index) => {
        const parentId = String(entry?.parentId || '').trim();
        if (parentId && !ids.has(parentId)) {
            errors.push(`Entry ${index} has unknown parentId "${parentId}".`);
        }
    });

    return errors;
}

function prettyJson(value) {
    return `${JSON.stringify(value, null, 2)}\n`;
}

function snapshotFile(fullPath) {
    return {
        fullPath,
        existed: fs.existsSync(fullPath),
        content: fs.existsSync(fullPath) ? fs.readFileSync(fullPath, 'utf8') : null
    };
}

function listFilesRecursive(directoryPath) {
    if (!fs.existsSync(directoryPath)) return [];
    return fs.readdirSync(directoryPath, { withFileTypes: true }).flatMap((entry) => {
        const entryPath = path.join(directoryPath, entry.name);
        if (entry.isDirectory()) return listFilesRecursive(entryPath);
        if (entry.isFile()) return [entryPath];
        return [];
    });
}

function restoreSnapshots(snapshots) {
    snapshots.forEach((snapshot) => {
        if (snapshot.existed) {
            fs.mkdirSync(path.dirname(snapshot.fullPath), { recursive: true });
            fs.writeFileSync(snapshot.fullPath, snapshot.content);
        } else {
            fs.rmSync(snapshot.fullPath, { force: true });
        }
    });
}

function removeFilesOutsideSnapshot(directoryPath, snapshotPaths) {
    if (!fs.existsSync(directoryPath)) return;
    listFilesRecursive(directoryPath).forEach((fullPath) => {
        if (!snapshotPaths.has(fullPath)) {
            fs.rmSync(fullPath, { force: true });
        }
    });
}

function runNodeScript(repoRoot, relativeScriptPath) {
    const result = spawnSync(process.execPath, [relativeScriptPath], {
        cwd: repoRoot,
        encoding: 'utf8'
    });

    if (result.status !== 0) {
        const output = `${result.stdout || ''}${result.stderr || ''}`.trim();
        throw new Error(`${relativeScriptPath} failed${output ? `:\n${output}` : '.'}`);
    }

    return `${result.stdout || ''}${result.stderr || ''}`.trim();
}

function regenerateAndValidate(repoRoot) {
    runNodeScript(repoRoot, 'scripts/generate_atlas_index.js');
    runNodeScript(repoRoot, 'scripts/validate_map_data.js');
}

function writeWithValidation(repoRoot, writes) {
    const atlasPath = resolveRepoPath(repoRoot, 'maps/atlas-index.json');
    const generatedDir = resolveRepoPath(repoRoot, 'maps/generated');
    const snapshots = [
        ...writes.map((write) => snapshotFile(write.fullPath)),
        snapshotFile(atlasPath),
        ...listFilesRecursive(generatedDir).map(snapshotFile)
    ];
    const snapshotPaths = new Set(snapshots.map((snapshot) => snapshot.fullPath));

    try {
        writes.forEach((write) => {
            fs.mkdirSync(path.dirname(write.fullPath), { recursive: true });
            fs.writeFileSync(write.fullPath, write.content);
        });
        regenerateAndValidate(repoRoot);
    } catch (error) {
        restoreSnapshots(snapshots);
        removeFilesOutsideSnapshot(generatedDir, snapshotPaths);
        throw error;
    }
}

function saveMapDocument(repoRoot, payload) {
    const errors = validateMapDocument(payload?.document);
    if (errors.length > 0) {
        throw new Error(errors.join(' '));
    }

    const target = resolveMapTargetPath(repoRoot, payload);
    writeWithValidation(repoRoot, [{
        fullPath: target.fullPath,
        content: prettyJson(payload.document)
    }]);

    return {
        ok: true,
        saved: target.relativePath,
        atlas: 'maps/atlas-index.json'
    };
}

function saveAtlasStructure(repoRoot, payload) {
    const errors = validateAtlasManifestDocument(payload?.document);
    if (errors.length > 0) {
        throw new Error(errors.join(' '));
    }

    const target = {
        relativePath: 'maps/maps.json',
        fullPath: resolveRepoPath(repoRoot, 'maps/maps.json')
    };
    writeWithValidation(repoRoot, [{
        fullPath: target.fullPath,
        content: prettyJson(payload.document)
    }]);

    return {
        ok: true,
        saved: target.relativePath,
        atlas: 'maps/atlas-index.json'
    };
}

function readRequestBody(request) {
    return new Promise((resolve, reject) => {
        let body = '';
        request.setEncoding('utf8');
        request.on('data', (chunk) => {
            body += chunk;
            if (Buffer.byteLength(body, 'utf8') > MAX_BODY_BYTES) {
                reject(new Error('Request body is too large.'));
                request.destroy();
            }
        });
        request.on('end', () => {
            try {
                resolve(body ? JSON.parse(body) : {});
            } catch (error) {
                reject(new Error('Request body must be valid JSON.'));
            }
        });
        request.on('error', reject);
    });
}

function sendJson(response, statusCode, payload) {
    response.writeHead(statusCode, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store'
    });
    response.end(JSON.stringify(payload));
}

async function handleApiRequest(repoRoot, request, response, url) {
    if (url.pathname === '/api/editor/status' && request.method === 'GET') {
        sendJson(response, 200, {
            ok: true,
            saveEnabled: true,
            message: 'Local map editor save server is running.'
        });
        return true;
    }

    if (url.pathname === '/api/editor/save-map' && request.method === 'POST') {
        if (!isAllowedEditorWriteRequest(request)) {
            sendJson(response, 403, { ok: false, error: 'Editor save requests must come from the local editor origin.' });
            return true;
        }
        try {
            const payload = await readRequestBody(request);
            sendJson(response, 200, saveMapDocument(repoRoot, payload));
        } catch (error) {
            sendJson(response, 400, { ok: false, error: error.message || 'Could not save map.' });
        }
        return true;
    }

    if (url.pathname === '/api/editor/save-atlas' && request.method === 'POST') {
        if (!isAllowedEditorWriteRequest(request)) {
            sendJson(response, 403, { ok: false, error: 'Editor save requests must come from the local editor origin.' });
            return true;
        }
        try {
            const payload = await readRequestBody(request);
            sendJson(response, 200, saveAtlasStructure(repoRoot, payload));
        } catch (error) {
            sendJson(response, 400, { ok: false, error: error.message || 'Could not save atlas structure.' });
        }
        return true;
    }

    if (url.pathname.startsWith('/api/')) {
        sendJson(response, 404, { ok: false, error: 'Unknown API endpoint.' });
        return true;
    }

    return false;
}

function resolveStaticRequestPath(repoRoot, urlPathname) {
    let decodedPathname;
    try {
        decodedPathname = decodeURIComponent(urlPathname || '/');
    } catch (error) {
        return null;
    }

    const requestedPath = decodedPathname === '/' ? '/index.html' : decodedPathname;
    const segments = requestedPath.split('/').filter(Boolean);
    if (segments.some((segment) => segment === '.git' || segment === 'node_modules')) {
        return null;
    }

    const relativePath = path.normalize(`.${requestedPath}`);
    if (relativePath.startsWith('..')) return null;
    const fullPath = resolveRepoPath(repoRoot, relativePath);
    if (!fs.existsSync(fullPath)) return null;
    if (fs.statSync(fullPath).isDirectory()) {
        return resolveRepoPath(repoRoot, path.join(relativePath, 'index.html'));
    }
    return fullPath;
}

function sendStaticFile(response, fullPath) {
    const extension = path.extname(fullPath).toLowerCase();
    const contentType = MIME_TYPES[extension] || 'application/octet-stream';
    response.writeHead(200, {
        'Content-Type': contentType,
        'Cache-Control': 'no-store'
    });
    fs.createReadStream(fullPath).pipe(response);
}

function createEditorServer(options = {}) {
    const repoRoot = path.resolve(options.repoRoot || path.resolve(__dirname, '..'));
    return http.createServer(async (request, response) => {
        const url = new URL(request.url || '/', `http://${request.headers.host || `${DEFAULT_HOST}:${DEFAULT_PORT}`}`);

        if (await handleApiRequest(repoRoot, request, response, url)) return;

        if (request.method !== 'GET' && request.method !== 'HEAD') {
            sendJson(response, 405, { ok: false, error: 'Method not allowed.' });
            return;
        }

        const fullPath = resolveStaticRequestPath(repoRoot, url.pathname);
        if (!fullPath || !fs.existsSync(fullPath)) {
            response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
            response.end('Not found');
            return;
        }

        if (request.method === 'HEAD') {
            response.writeHead(200, { 'Cache-Control': 'no-store' });
            response.end();
            return;
        }

        sendStaticFile(response, fullPath);
    });
}

function startEditorServer(options = {}) {
    const host = options.host || process.env.HOST || DEFAULT_HOST;
    const port = Number(options.port || process.env.PORT || DEFAULT_PORT);
    const repoRoot = path.resolve(options.repoRoot || path.resolve(__dirname, '..'));

    assertLoopbackBindHost(host);

    const server = createEditorServer({ repoRoot });
    server.listen(port, host, () => {
        console.log(`Map editor running at http://${host}:${port}/map-editor.html`);
        console.log('Save buttons are enabled only from this local editor server.');
    });
    return server;
}

if (require.main === module) {
    try {
        startEditorServer();
    } catch (error) {
        console.error(error.message || error);
        process.exit(1);
    }
}

module.exports = {
    DEFAULT_HOST,
    DEFAULT_PORT,
    assertLoopbackBindHost,
    createEditorServer,
    isAllowedEditorWriteRequest,
    isLoopbackHost,
    resolveMapTargetPath,
    saveAtlasStructure,
    saveMapDocument,
    startEditorServer,
    validateAtlasManifestDocument,
    validateMapDocument
};
