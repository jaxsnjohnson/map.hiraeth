// --- Global Variables ---
let mapData = []; // Will be populated by loadMapData
let loadingProgressInterval = null;
let loadingProgress = 0;
let currentRegionGroup = null;
let regionsVisible = false; // Overall region visibility toggle
let currentRoadGroup = null; // Holds currently displayed road layers (and lines)
// let regionFiltersPanelVisible = false; // No longer needed as separate panel

let miniMapControl = null; // Global MiniMap control instance
const sessionStartedAt = Date.now();
const UX_STORAGE_KEYS = {
    theme: 'theme',
    themePreference: 'themePreference',
    soundEnabled: 'soundEnabled',
    sidebarState: 'sidebarState',
    filterPanelOpen: 'filterPanelOpen',
    coordsVisible: 'coordsVisible',
    advancedControlsUnlocked: 'advancedControlsUnlocked',
    onboardingSeen: 'onboardingSeen',
    lastMapId: 'lastMapId',
    mapViews: 'mapViews',
    gmUnlocked: 'gmUnlocked',
    routePanelCollapsed: 'routePanelCollapsed',
    toolkitPanelCollapsed: 'toolkitPanelCollapsed',
    gmPanelVisible: 'gmPanelVisible',
    toolkitPanelVisible: 'toolkitPanelVisible'
};
let isEmbeddedView = false;
let isInitializing = true;
let advancedControlsUnlocked = false;
let coordsDisplayEnabled = false;
let openAboutModal = null;
let closeAboutModal = null;
let isAboutModalVisible = () => false;
let loadingMapId = null;
let lastTrackedSearchSignature = '';

function refreshLucideIcons() {
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
        window.lucide.createIcons();
    }
}

// --- Measurement Tool State ---
let isMeasuring = false; // Existing
let measurementStartPoint = null; // Existing
let measurementLayerGroup; // Declare it here

// --- Initialize Leaflet Map ---
const map = L.map('map', {
    crs: L.CRS.Simple,
    minZoom: -3,
    maxZoom: 4,
    attributionControl: false,
    zoomControl: false // Disable default zoom, using custom styled one
});

let atmosphereLayer = null;

// Register URL update listeners
map.on('moveend zoomend', updateURLWithMapView);
map.on('popupopen', refreshLucideIcons);

// NOW Initialize measurementLayerGroup
measurementLayerGroup = L.layerGroup().addTo(map);


// --- NEW: Multi-Point Measurement State ---
let isMeasuringMultiPoint = false; // Tracks if multi-point mode is active
let multiPointPath = []; // Array of L.LatLng objects for the current path
let multiPointPolyline = null; // The L.Polyline layer for the drawn path
let multiPointVertexMarkers = []; // Array of L.CircleMarker for vertices
let multiPointSegmentTooltips = []; // Array of L.Tooltip for segment lengths (optional)
let multiPointTotalTooltip = null; // L.Tooltip for the total path length
let temporaryMouseMoveLine = null; // L.Polyline for the line from last point to cursor
let temporaryMouseMoveTooltip = null; // L.Tooltip for the temporary line's length

// --- GM / Routes / Session Toolkit State ---
let gmContentVisible = false;
let currentRoutes = [];
let visibleRoutes = [];
let currentRoute = null;
let currentRouteStepIndex = -1;
let currentEncounterTables = [];
let lastMeasuredDistanceKm = null;
let visiblePointsCache = [];
let visibleRegionsCache = [];
let visibleLinesCache = [];
let gmPanelVisible = safeGetStorage(UX_STORAGE_KEYS.gmPanelVisible) !== 'false';
let toolkitPanelVisible = safeGetStorage(UX_STORAGE_KEYS.toolkitPanelVisible) !== 'false';


// --- Initialize Leaflet Map ---
// Add styled zoom control
// L.control.zoom({ position: 'topleft' }).addTo(map); // Removed in favor of custom buttons

// --- Coordinate Display Logic ---
const coordinateDisplay = document.getElementById('coordinate-display');
const copyCoordsBtn = coordinateDisplay.querySelector('.copy-coords-btn');

if (copyCoordsBtn) {
    copyCoordsBtn.addEventListener('click', () => {
        if (copyCoordsBtn.classList.contains('copied')) return; // Prevent re-clicking

        const coordsText = coordinateDisplay.querySelector('span').innerText;
        navigator.clipboard.writeText(coordsText).then(() => {
            copyCoordsBtn.classList.add('copied');
            copyCoordsBtn.title = "Copied!";
            copyCoordsBtn.setAttribute('aria-label', "Copied!");

            setTimeout(() => {
                copyCoordsBtn.classList.remove('copied');
                copyCoordsBtn.title = "Copy Coordinates";
                copyCoordsBtn.setAttribute('aria-label', "Copy Coordinates");
            }, 1500); // Reset after 1.5 seconds
        }).catch(err => {
            console.error('Failed to copy coordinates: ', err);
        });
    });
}

function updateCoordinateDisplay(lat, lon) {
    if (!coordinateDisplay) return;
    const displaySpan = coordinateDisplay.querySelector('span');
    if (!displaySpan) return;
    const latString = `${Math.abs(lat).toFixed(2)}° ${lat >= 0 ? 'N' : 'S'}`;
    const lonString = `${Math.abs(lon).toFixed(2)}° ${lon >= 0 ? 'E' : 'W'}`;
    displaySpan.innerHTML = `${latString}, ${lonString}`;
}

const poiTypeGroups = {
    "Settlements": ["City", "Town", "Village", "Hamlet", "Settlement", "Capital"],
    "Structures": ["Castle", "Fortress", "Fort", "Tower", "Ruin", "Temple", "Shrine", "Mine", "Lighthouse", "Bridge", "Dungeon", "Lair", "Camp", "Asylum", "Landmark"],
    "Natural Features": ["Mountain", "Peak", "Forest", "Wood", "River", "Lake", "Cave", "Cavern", "Coast", "Bay", "Cove", "Swamp", "Marsh", "Desert", "Natural Landmark"],
    "Other": ["Point of Interest", "Region", "Portal"],
    "Unknown": ["Unknown"]
};

function getUrlParameters() {
    const params = {};
    const queryString = window.location.search.substring(1);
    const pairs = queryString.split('&');
    const safeDecode = (value) => {
        const normalized = String(value || '').replace(/\+/g, ' ');
        try {
            return decodeURIComponent(normalized);
        } catch (error) {
            return normalized;
        }
    };
    
    for (const pair of pairs) {
        const separatorIndex = pair.indexOf('=');
        const key = separatorIndex >= 0 ? pair.slice(0, separatorIndex) : pair;
        const value = separatorIndex >= 0 ? pair.slice(separatorIndex + 1) : '';
        const decodedKey = safeDecode(key);
        if (decodedKey) params[decodedKey] = safeDecode(value);
    }
    return params;
}

// --- NEW: Format Custom Properties for Popups ---
function formatPropertiesForPopup(properties, hasFollowingDescription) {
    if (!properties || Object.keys(properties).length === 0) {
        return '';
    }
    let hasContent = false;
    let listItems = '';
    for (const key in properties) {
        const value = properties[key];
        if (
            Object.hasOwnProperty.call(properties, key) &&
            value !== undefined &&
            value !== null &&
            value !== ''
        ) {
            hasContent = true;
            // Sanitize key and value to prevent basic HTML injection
            const sanKey = key.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
            const sanValue = String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
            listItems += `<li><strong>${sanKey}:</strong> ${sanValue}</li>`;
        }
    }

    if (!hasContent) return '';

    let html = `<ul>${listItems}</ul>`;
    // Add separator AFTER properties if there's a description to follow
    if (hasFollowingDescription) {
        html += `<hr style="border-top: 1px dotted var(--border-color); border-bottom: none; margin: 10px 0;">`;
    }
    return html;
}

function sanitizeTextForHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function escapeForSingleQuotedAttribute(value) {
    return String(value || '')
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "\\'");
}

function resolveLinkedMapData(featureData) {
    const linkedMapId = String(featureData?.linkedMapId || '').trim();
    if (!linkedMapId) return null;

    const linkedMap = findMapRecursive(mapData, linkedMapId);
    if (!isRenderableMapEntry(linkedMap)) {
        return null;
    }

    return {
        id: linkedMapId,
        name: linkedMap.name || linkedMapId
    };
}

// --- NEW: Unified Popup Content Generator ---
function createPopupContent(data, type) {
    // Part 1: Build the header, which is always visible.
    let headerHtml = '';
    if (data.name) {
        // Escape both single and double quotes for the onclick attribute
        const escapedName = data.name.replace(/'/g, "\\'").replace(/"/g, '&quot;');
        let shareButtonHtml = '';
        if (type) {
            // Using an SVG icon to match the site theme
            const linkIcon = `<i class="ui-icon" data-lucide="link-2" aria-hidden="true"></i>`;
            shareButtonHtml = ` <button class="share-btn" onclick="copyFeatureLink(this, '${type}', '${escapedName}')" title="Share this location">${linkIcon}</button>`;
        }

        if (data.wikiLink) {
            headerHtml += `<div class="popup-header-row"><h3><a href="${data.wikiLink}" target="_blank" rel="noopener noreferrer" title="Visit wiki page for ${data.name}">${data.name}</a></h3>${shareButtonHtml}</div>`;
        } else {
            headerHtml += `<div class="popup-header-row"><h3>${data.name}</h3>${shareButtonHtml}</div>`;
        }
    }
    if (data.pronunciation) {
        headerHtml += `<p style="margin-top: -10px; margin-bottom: 5px;"><em>${data.pronunciation}</em></p>`;
    }
    const linkedMap = resolveLinkedMapData(data);
    if (linkedMap) {
        const escapedLinkedMapId = escapeForSingleQuotedAttribute(linkedMap.id);
        const linkedMapName = sanitizeTextForHtml(linkedMap.name);
        const mapJumpIcon = `<i class="ui-icon" data-lucide="map" aria-hidden="true"></i>`;
        headerHtml += `<div class="popup-map-jump"><a href="#" onclick="return openLinkedMapFromPopup(event, '${escapedLinkedMapId}')" title="Open map: ${linkedMapName}">${mapJumpIcon}<span>Open ${linkedMapName} map</span></a></div>`;
    }

    // Part 2: Build the rest of the content that will be expandable.
    let fullContentInnerHtml = '';
    if (data.type && data.value) { // Regions
        fullContentInnerHtml += `<p><em>${data.type}: ${data.value}</em></p>`;
    } else if (data.type) { // POIs, Roads
        const typeString = data.type.charAt(0).toUpperCase() + data.type.slice(1);
        fullContentInnerHtml += `<p><em>Type: ${typeString}</em></p>`;
    }
    fullContentInnerHtml += formatPropertiesForPopup(data.properties, !!data.description);
    if (data.description) {
        fullContentInnerHtml += `<p>${data.description}</p>`;
    }

    // Part 3: Check for summary and full content presence.
    const hasSummary = data.summary && data.summary.trim() !== '';
    const hasFullContent = fullContentInnerHtml.trim() !== '';

    // If there's nothing to show, just return the header.
    if (!hasSummary && !hasFullContent) {
        return headerHtml;
    }

    // Part 4: Construct the main container and "Read More" button based on content.
    let mainContent = '';
    let readMoreButton = '';

    if (hasSummary) {
        // If a summary exists, use the new structure with summary and full-content divs.
        mainContent = `
            <div class="popup-content-container">
                <div class="popup-summary">
                    <p>${data.summary}</p>
                </div>
                <div class="popup-full-content">
                    ${fullContentInnerHtml}
                </div>
            </div>
        `;
        // Show "Read More" button only if there's full content to expand to.
        if (hasFullContent) {
            readMoreButton = `<div class="popup-read-more" onclick="togglePopupExpand(this)">Read More</div>`;
        }
    } else {
        // No summary, so use the old behavior. The container will be truncated by CSS.
        mainContent = `
            <div class="popup-content-container">
                ${fullContentInnerHtml}
            </div>
        `;
        // Show "Read More" button if there's content that might be truncated.
        if (hasFullContent) {
            readMoreButton = `<div class="popup-read-more" onclick="togglePopupExpand(this)">Read More</div>`;
        }
    }

    // Combine the header, main content container, and button for the final popup HTML.
    return headerHtml + mainContent + readMoreButton;
}

// --- Auto-generate a reverse map for quick lookup (Type -> Group) ---
const typeToGroupMap = {};
for (const groupName in poiTypeGroups) {
    poiTypeGroups[groupName].forEach(type => {
        typeToGroupMap[String(type || '').trim().toLowerCase()] = groupName;
    });
}

const poiGroupIconConfig = {
    "Settlements": "images/poi-icons/settlements.png",
    "Structures": "images/poi-icons/structures.png",
    "Natural Features": "images/poi-icons/natural-features.png",
    "Other": "images/poi-icons/other.png",
    "Unknown": "images/poi-icons/unknown.png"
};

const poiIconCache = new Map();

function getPoiGroup(type) {
    const normalizedType = String(type || '').trim().toLowerCase();
    if (!normalizedType) return 'Unknown';
    return typeToGroupMap[normalizedType] || 'Unknown';
}

function getPoiIcon(groupName) {
    const normalizedGroup = poiGroupIconConfig[groupName] ? groupName : 'Unknown';
    if (poiIconCache.has(normalizedGroup)) {
        return poiIconCache.get(normalizedGroup);
    }

    const icon = L.icon({
        iconUrl: poiGroupIconConfig[normalizedGroup],
        iconSize: [36, 48],
        iconAnchor: [18, 47],
        popupAnchor: [0, -40],
        className: 'poi-custom-icon'
    });

    poiIconCache.set(normalizedGroup, icon);
    return icon;
}
// --- END: POI Type Grouping Configuration ---

// --- More Global variables ---
let currentImageLayer = null;
let currentMarkerGroup = null; // Holds currently *visible* markers
let allMapMarkers = []; // Holds *all* markers for the loaded map
let currentBounds = null;
let currentlyLoadedMapId = null;
let currentSidebarState = 'o';
let markersVisible = true; // <--- THIS SHOULD BE TRUE FOR VISIBLE BY DEFAULT
let currentLatLonBounds = null;
let coordsLocked = false;
let lockedCoords = null;
const transitionDuration = 300; // ms for sidebar animation
let filtersPanelVisible = false; // State for combined filter panel visibility

// --- Visibility helpers for GM/Public split ---
function getVisiblePoints(mapObj) {
    const points = Array.isArray(mapObj.pointsOfInterest) ? mapObj.pointsOfInterest :
        (Array.isArray(mapObj.points) ? mapObj.points : []);
    return points.filter(visibilityAllowed);
}

function getVisibleRegions(mapObj) {
    const regions = Array.isArray(mapObj.regions) ? mapObj.regions : [];
    return regions.filter(visibilityAllowed);
}

function getVisibleLines(mapObj) {
    const roads = Array.isArray(mapObj.roads) ? mapObj.roads : [];
    const linesList = Array.isArray(mapObj.lines) ? mapObj.lines : [];
    const lines = [...roads, ...linesList];
    return lines.filter(visibilityAllowed);
}

function getVisibleRoutes(mapObj) {
    const routes = Array.isArray(mapObj.routes) ? mapObj.routes : [];
    return routes.map(route => {
        const steps = (Array.isArray(route.steps) ? route.steps : []).filter(visibilityAllowed);
        return { ...route, steps };
    }).filter(r => r.steps && r.steps.length > 0 && visibilityAllowed(r));
}

function getVisibleEncounterTables(mapObj) {
    const tables = Array.isArray(mapObj.encounterTables) ? mapObj.encounterTables : [];
    return tables.map(table => {
        const entries = (Array.isArray(table.entries) ? table.entries : []).filter(visibilityAllowed);
        return { ...table, entries };
    }).filter(t => t.entries && t.entries.length > 0 && visibilityAllowed(t));
}

// --- DOM Elements ---
const container = document.querySelector('.container');
const sidebar = document.getElementById('sidebar');
const mapListElement = document.getElementById('map-list');
const toggleBtn = document.getElementById('toggle-sidebar-btn');
const themeToggle = document.getElementById('theme-checkbox');
const bodyElement = document.body;
const mapElement = document.getElementById('map'); // Get map div
const mapContainerElement = document.getElementById('map-container');
if (mapContainerElement) {
    atmosphereLayer = document.createElement('div');
    atmosphereLayer.id = 'atmosphere-layer';
    atmosphereLayer.setAttribute('aria-hidden', 'true');
    mapContainerElement.appendChild(atmosphereLayer);
}
const toggleBlurbBtn = document.getElementById('toggle-blurb-btn');
const toggleGMPanelBtn = document.getElementById('toggle-gm-panel-btn');
const toggleToolkitPanelBtn = document.getElementById('toggle-toolkit-panel-btn');
const mapBlurbElement = document.getElementById('map-blurb');
const toggleMarkersBtn = document.getElementById('toggle-markers-btn');
const searchControlContainer = document.getElementById('search-control-container');
const poiSearchInput = document.getElementById('poi-search-input');
const searchResultsContainer = document.getElementById('search-results-container');
const poiFilterContainer = document.getElementById('poi-filter-container');
const filterToggleAllCheckbox = document.getElementById('filter-toggle-all');
const toggleFiltersBtn = document.getElementById('toggle-filters-btn');
const measureToolBtn = document.getElementById('measure-tool-btn');
const loadingIndicator = document.getElementById('loading-indicator');
const loadingRetryBtn = document.getElementById('loading-retry-btn');
const searchMetaElement = document.getElementById('search-meta');
const searchRefineFiltersBtn = document.getElementById('search-refine-filters-btn');
const searchRefineClearBtn = document.getElementById('search-refine-clear-btn');
const activeFiltersContainer = document.getElementById('active-filters-container');
const sidebarBackdrop = document.getElementById('sidebar-backdrop');
const onboardingCoachmark = document.getElementById('onboarding-coachmark');
const onboardingOpenHelpBtn = document.getElementById('onboarding-open-help-btn');
const onboardingDismissBtn = document.getElementById('onboarding-dismiss-btn');
const toggleCoordsBtn = document.getElementById('toggle-coords-btn');
// Sound elements
const lightAmbient = document.getElementById('light-ambient');
const darkAmbient = document.getElementById('dark-ambient');
const toggleSoundBtn = document.getElementById('toggle-sound-btn');
const soundIcon = document.getElementById('sound-icon');
// New route / toolkit DOM
const routePanel = document.getElementById('route-panel');
const routeSelect = document.getElementById('route-select');
const routeStartBtn = document.getElementById('route-start-btn');
const routeResetBtn = document.getElementById('route-reset-btn');
const routeCollapseBtn = document.getElementById('route-collapse-btn');
const routeStepList = document.getElementById('route-step-list');
const routeCountBadge = document.getElementById('route-count-badge');
const sessionToolkitPanel = document.getElementById('session-toolkit');
const toolkitCollapseBtn = document.getElementById('toolkit-collapse-btn');
const gmPill = document.getElementById('gm-pill');
const gmStatusLabel = document.getElementById('gm-status-label');
const gmToggleBtn = document.getElementById('gm-toggle-btn');
const travelDistanceInput = document.getElementById('travel-distance-input');
const travelModeSelect = document.getElementById('travel-mode-select');
const travelTimeOutput = document.getElementById('travel-time-output');
const encounterSelect = document.getElementById('encounter-select');
const encounterRollBtn = document.getElementById('encounter-roll-btn');
const encounterViewBtn = document.getElementById('encounter-view-btn');
const encounterResult = document.getElementById('encounter-result');
const encounterTableList = document.getElementById('encounter-table-list');
const rootElement = document.documentElement;
let soundEnabled = false;
let themePreference = 'system';
let currentEffectiveTheme = 'light';
const systemThemeMediaQuery = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
let themeAnimationTimeoutId = null;
const THEME_CLOUD_HANDOFF_CLASS = 'theme-cloud-handoff';
const THEME_ANIMATION_BUFFER_MS = 40;
const THEME_ANIMATION_FALLBACK_MS = 560;
const activeAudioFadeFrameIds = new WeakMap();
let currentAtmosphereConfig = null;
const storedAdvancedControlsFlag = safeGetStorage(UX_STORAGE_KEYS.advancedControlsUnlocked);
const storedOnboardingFlag = safeGetStorage(UX_STORAGE_KEYS.onboardingSeen);
const hasPriorPreferenceState =
    safeGetStorage(UX_STORAGE_KEYS.themePreference) !== null ||
    safeGetStorage(UX_STORAGE_KEYS.theme) !== null ||
    safeGetStorage(UX_STORAGE_KEYS.soundEnabled) !== null;
advancedControlsUnlocked = storedAdvancedControlsFlag === 'true' ||
    (storedAdvancedControlsFlag === null && storedOnboardingFlag === null && hasPriorPreferenceState);
coordsDisplayEnabled = safeGetStorage(UX_STORAGE_KEYS.coordsVisible) === 'true';


// --- Helper Functions ---
function debounce(func, wait) {
    let timeout;
    return function(...args) {
        const context = this;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), wait);
    };
}

function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function safeGetStorage(key) {
    try {
        return localStorage.getItem(key);
    } catch (error) {
        return null;
    }
}

function safeSetStorage(key, value) {
    try {
        localStorage.setItem(key, value);
    } catch (error) {
        // Ignore storage quota and private-mode failures.
    }
}

function safeRemoveStorage(key) {
    try {
        localStorage.removeItem(key);
    } catch (error) {
        // Ignore storage quota and private-mode failures.
    }
}

function safeGetJSON(key, fallback = null) {
    const raw = safeGetStorage(key);
    if (!raw) return fallback;
    try {
        return JSON.parse(raw);
    } catch (error) {
        return fallback;
    }
}

function safeSetJSON(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
        // Ignore storage quota and private-mode failures.
    }
}

function withAssetVersion(url) {
    const version = encodeURIComponent(window.APP_ASSET_VERSION || '0');
    const separator = String(url).includes('?') ? '&' : '?';
    return `${url}${separator}v=${version}`;
}

function isValidThemePreference(value) {
    return value === 'light' || value === 'dark' || value === 'system';
}

function resolveSystemTheme() {
    return systemThemeMediaQuery && systemThemeMediaQuery.matches ? 'dark' : 'light';
}

function resolveThemePreference() {
    const prebootPreference = window.__INITIAL_THEME_PREFERENCE__;
    if (isValidThemePreference(prebootPreference)) {
        return prebootPreference;
    }

    const savedPreference = safeGetStorage(UX_STORAGE_KEYS.themePreference);
    if (isValidThemePreference(savedPreference)) {
        return savedPreference;
    }

    const legacyTheme = safeGetStorage(UX_STORAGE_KEYS.theme);
    if (legacyTheme === 'light' || legacyTheme === 'dark') {
        safeSetStorage(UX_STORAGE_KEYS.themePreference, legacyTheme);
        return legacyTheme;
    }

    safeSetStorage(UX_STORAGE_KEYS.themePreference, 'system');
    return 'system';
}

function resolveEffectiveTheme(preference = themePreference) {
    if (preference === 'light' || preference === 'dark') {
        return preference;
    }
    return resolveSystemTheme();
}

function syncThemeToggleA11y(theme) {
    if (!themeToggle) return;
    const switchingTo = theme === 'dark' ? 'light' : 'dark';
    const label = `Switch to ${switchingTo} theme`;
    themeToggle.setAttribute('aria-label', label);
    themeToggle.setAttribute('title', label);
}

function normalizeAtmosphereMode(value) {
    if (typeof value !== 'string') return '';
    const mode = value.trim().toLowerCase();
    return mode === 'aurora' || mode === 'snow' ? mode : '';
}

function normalizeAtmosphereConfig(rawConfig) {
    if (!rawConfig) return null;
    if (typeof rawConfig === 'string') {
        const mode = normalizeAtmosphereMode(rawConfig);
        return mode ? { day: mode, night: mode } : null;
    }
    if (typeof rawConfig !== 'object') return null;

    const day = normalizeAtmosphereMode(rawConfig.day);
    const night = normalizeAtmosphereMode(rawConfig.night);
    const fallback = normalizeAtmosphereMode(rawConfig.default || rawConfig.all || rawConfig.both);
    const resolvedDay = day || fallback;
    const resolvedNight = night || fallback;

    if (!resolvedDay && !resolvedNight) return null;
    return { day: resolvedDay, night: resolvedNight };
}

function resolveAtmosphereMode() {
    if (!currentAtmosphereConfig) return '';
    const themeSlot = currentEffectiveTheme === 'dark' ? 'night' : 'day';
    return currentAtmosphereConfig[themeSlot] || '';
}

function applyAtmosphereLayer() {
    if (!mapContainerElement || !atmosphereLayer) return;

    const mode = resolveAtmosphereMode();
    const currentMode = mapContainerElement.getAttribute('data-atmosphere') || '';
    const nextClass = mode ? `atmosphere-${mode}` : '';

    if (mode === currentMode) {
        if (!nextClass) {
            atmosphereLayer.classList.remove('atmosphere-aurora', 'atmosphere-snow');
            return;
        }
        if (atmosphereLayer.classList.contains(nextClass)) {
            return;
        }
        atmosphereLayer.classList.remove('atmosphere-aurora', 'atmosphere-snow');
        atmosphereLayer.classList.add(nextClass);
        return;
    }

    if (!mode) {
        mapContainerElement.removeAttribute('data-atmosphere');
        atmosphereLayer.classList.remove('atmosphere-aurora', 'atmosphere-snow');
        return;
    }

    mapContainerElement.setAttribute('data-atmosphere', mode);
    atmosphereLayer.classList.remove('atmosphere-aurora', 'atmosphere-snow');
    atmosphereLayer.classList.add(nextClass);
}

function setMapAtmosphere(rawConfig) {
    currentAtmosphereConfig = normalizeAtmosphereConfig(rawConfig);
    applyAtmosphereLayer();
}

function shouldAnimateThemeTransition() {
    return !(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
}

function parseCssDurationToMs(rawValue) {
    if (typeof rawValue !== 'string') return null;
    const value = rawValue.trim();
    if (!value) return null;
    if (value.endsWith('ms')) {
        const parsed = Number.parseFloat(value);
        return Number.isFinite(parsed) ? parsed : null;
    }
    if (value.endsWith('s')) {
        const parsed = Number.parseFloat(value);
        return Number.isFinite(parsed) ? parsed * 1000 : null;
    }
    return null;
}

function getThemeAnimationDurationMs() {
    const computedStyle = window.getComputedStyle(rootElement);
    const totalDuration = parseCssDurationToMs(computedStyle.getPropertyValue('--theme-transition-total'));
    if (totalDuration !== null && totalDuration >= 0) {
        return Math.ceil(totalDuration + THEME_ANIMATION_BUFFER_MS);
    }

    return THEME_ANIMATION_FALLBACK_MS;
}

function isLocalHost() {
    const host = window.location.hostname;
    return host === 'localhost' || host === '127.0.0.1' || host === '[::1]';
}

function isPublicHost() {
    return !isLocalHost();
}

function canAccessGMToolkit() {
    return isLocalHost();
}

function setGMVisibility(enabled, source = 'manual') {
    gmContentVisible = !!enabled;
    safeSetStorage(UX_STORAGE_KEYS.gmUnlocked, gmContentVisible ? 'true' : 'false');
    if (gmStatusLabel) {
        gmStatusLabel.textContent = `GM View: ${gmContentVisible ? 'On' : 'Off'}`;
    }
    if (gmPill) {
        gmPill.classList.toggle('active', gmContentVisible);
    }
    trackAnalytics('gm_visibility_changed', { enabled: gmContentVisible, source });
    // Reload current map to apply visibility filtering
    if (currentlyLoadedMapId) {
        loadMap(currentlyLoadedMapId, false);
    }
}

function setPanelCollapsed(panelEl, buttonEl, collapsed, storageKey) {
    if (!panelEl || !buttonEl) return;
    panelEl.classList.toggle('collapsed', collapsed);
    buttonEl.textContent = collapsed ? 'Expand' : 'Collapse';
    buttonEl.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
    if (storageKey) safeSetStorage(storageKey, collapsed ? 'true' : 'false');
}

function setAuxPanelVisible(panelEl, visible, displayMode = 'block') {
    if (!panelEl) return;
    panelEl.style.display = visible ? displayMode : 'none';
}

function updatePanelToggleButtons() {
    if (toggleGMPanelBtn) {
        toggleGMPanelBtn.classList.toggle('active', gmPanelVisible);
        toggleGMPanelBtn.setAttribute('aria-pressed', gmPanelVisible ? 'true' : 'false');
        toggleGMPanelBtn.title = gmPanelVisible ? 'Hide GM View Panel' : 'Show GM View Panel';
        toggleGMPanelBtn.setAttribute('aria-label', gmPanelVisible ? 'Hide GM View Panel' : 'Show GM View Panel');
    }
    if (toggleToolkitPanelBtn) {
        toggleToolkitPanelBtn.classList.toggle('active', toolkitPanelVisible);
        toggleToolkitPanelBtn.setAttribute('aria-pressed', toolkitPanelVisible ? 'true' : 'false');
        toggleToolkitPanelBtn.title = toolkitPanelVisible ? 'Hide Session Toolkit Panel' : 'Show Session Toolkit Panel';
        toggleToolkitPanelBtn.setAttribute('aria-label', toolkitPanelVisible ? 'Hide Session Toolkit Panel' : 'Show Session Toolkit Panel');
    }
}

function initializeGMVisibility() {
    if (isLocalHost()) {
        setGMVisibility(true, 'localhost');
        return;
    }
    if (isPublicHost()) {
        setGMVisibility(false, 'public_host_forced_off');
    }
}

function visibilityAllowed(item) {
    const vis = (item && item.visibility) ? String(item.visibility).toLowerCase() : 'public';
    return vis !== 'gm' || gmContentVisible;
}

function trackAnalytics(eventName, details = {}) {
    const payload = {
        event: eventName,
        timestamp: new Date().toISOString(),
        mapId: currentlyLoadedMapId || null,
        ...details
    };

    if (!window.__HAG_ANALYTICS) {
        window.__HAG_ANALYTICS = [];
    }
    window.__HAG_ANALYTICS.push(payload);
    if (window.__HAG_ANALYTICS.length > 300) {
        window.__HAG_ANALYTICS.shift();
    }

    const endpoint = window.HAG_ANALYTICS_ENDPOINT;
    if (!endpoint) return;

    const body = JSON.stringify(payload);
    if (navigator.sendBeacon) {
        navigator.sendBeacon(endpoint, body);
        return;
    }

    fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        keepalive: true
    }).catch(() => {
        // Best effort only.
    });
}

function setSearchMeta(text = '') {
    if (!searchMetaElement) return;
    const normalizedText = text.trim();
    searchMetaElement.textContent = normalizedText;
    searchControlContainer.classList.toggle('is-searching', normalizedText.length > 0);
}

function setLoadingMessage(message, options = {}) {
    if (!loadingIndicator) return;
    const {
        showSpinner = true,
        showProgress = true,
        showRetry = false
    } = options;

    const loadingText = loadingIndicator.querySelector('.loading-text');
    const spinner = loadingIndicator.querySelector('.spinner');
    const progressContainer = loadingIndicator.querySelector('.progress-container');
    if (loadingText) loadingText.textContent = message;
    if (spinner) spinner.style.display = showSpinner ? 'block' : 'none';
    if (progressContainer) progressContainer.style.display = showProgress ? 'block' : 'none';
    if (loadingRetryBtn) loadingRetryBtn.style.display = showRetry ? 'inline-block' : 'none';
}

function positionFilterPanel() {
    if (!poiFilterContainer || !toggleFiltersBtn) return;
    const mapContainer = document.getElementById('map-container');
    if (!mapContainer) return;

    const mapRect = mapContainer.getBoundingClientRect();
    const buttonRect = toggleFiltersBtn.getBoundingClientRect();
    const panelWidth = poiFilterContainer.offsetWidth || 260;
    const minLeft = 10;
    const maxLeft = Math.max(minLeft, mapRect.width - panelWidth - 10);
    const preferredLeft = (buttonRect.right - mapRect.left) + 8;
    const clampedLeft = Math.max(minLeft, Math.min(preferredLeft, maxLeft));
    const panelTop = Math.max(10, (buttonRect.top - mapRect.top) - 2);

    poiFilterContainer.style.left = `${clampedLeft}px`;
    poiFilterContainer.style.top = `${panelTop}px`;
}

function getSavedMapView(mapId) {
    if (!mapId) return null;
    const viewsByMap = safeGetJSON(UX_STORAGE_KEYS.mapViews, {});
    return viewsByMap && typeof viewsByMap[mapId] === 'string' ? viewsByMap[mapId] : null;
}

function saveMapView(mapId, viewValue) {
    if (!mapId || !viewValue) return;
    const viewsByMap = safeGetJSON(UX_STORAGE_KEYS.mapViews, {});
    viewsByMap[mapId] = viewValue;
    safeSetJSON(UX_STORAGE_KEYS.mapViews, viewsByMap);
}

function setOnboardingVisibility(visible) {
    if (!onboardingCoachmark) return;
    onboardingCoachmark.hidden = !visible;
}

function syncSidebarBackdropState() {
    const isMobile = window.innerWidth <= 768;
    const sidebarIsOpen = !container.classList.contains('sidebar-collapsed');
    container.classList.toggle('mobile-sidebar-open', isMobile && sidebarIsOpen);
    if (sidebarBackdrop) {
        sidebarBackdrop.setAttribute('aria-hidden', isMobile && sidebarIsOpen ? 'false' : 'true');
    }
}

function findMapRecursive(items, id) {
    for (const item of items) {
        if (item.id === id) { return item; }
        if (item.type === 'folder' && item.children) {
            const found = findMapRecursive(item.children, id);
            if (found) return found;
        }
    }
    return null;
}

function isRenderableMapEntry(item) {
    if (!item || typeof item !== 'object') return false;
    if (item.status === 'coming-soon') return false;
    if (!String(item.id || '').trim()) return false;

    const width = Number(item.width);
    const height = Number(item.height);
    const imageUrl = String(item.imageUrl || '').trim();

    return Number.isFinite(width) && width > 0 &&
        Number.isFinite(height) && height > 0 &&
        !!imageUrl;
}

function findFirstLoadableIdRecursive(items) {
    for (const item of items) {
        if (isRenderableMapEntry(item)) return item.id;
        if (item.type === 'folder' && item.children) {
            const foundId = findFirstLoadableIdRecursive(item.children);
            if (foundId) return foundId;
        }
    }
    return null;
}

function parseHash() {
    const hash = window.location.hash.substring(1);
    let mapId = null;
    let sidebarState = null;
    if (hash) {
        const parts = hash.split('-s=');
        mapId = parts[0];
        if (parts.length > 1 && ['o', 'c'].includes(parts[1])) {
            sidebarState = parts[1];
        }
    }
    // Default map ID determination moved to initializeApp after data is loaded
    return {
        mapId: mapId, // May be null initially
        sidebarState: sidebarState || 'o'
    };
}

function getHistoryStateValue(state, key, fallbackValue) {
    if (!state || typeof state !== 'object') return fallbackValue;
    return Object.prototype.hasOwnProperty.call(state, key) ? state[key] : fallbackValue;
}

function generateHash(mapId, sidebarState) {
    const normalizedMapId = (mapId || '').trim();
    const normalizedSidebarState = ['o', 'c'].includes(sidebarState) ? sidebarState : 'o';
    return `#${normalizedMapId}-s=${normalizedSidebarState}`;
}

function buildAppUrlWithHash(hash, search = window.location.search) {
    return `${window.location.pathname}${search}${hash}`;
}

// --- Function to Set Sidebar State ---
function setSidebarState(state, updateHash = true) {
    const shouldBeCollapsed = (state === 'c');
    const isCurrentlyCollapsed = container.classList.contains('sidebar-collapsed');
    if (shouldBeCollapsed !== isCurrentlyCollapsed) {
        container.classList.toggle('sidebar-collapsed', shouldBeCollapsed);

        // Update SVG direction
        if (shouldBeCollapsed) {
            // Point Right (Expand)
             toggleBtn.innerHTML = `<i class="ui-icon" data-lucide="chevron-right" aria-hidden="true"></i>`;
             toggleBtn.title = 'Expand Sidebar';
             toggleBtn.setAttribute('aria-label', 'Expand Sidebar');
             toggleBtn.setAttribute('aria-expanded', 'false');
        } else {
            // Point Left (Collapse)
            toggleBtn.innerHTML = `<i class="ui-icon" data-lucide="chevron-left" aria-hidden="true"></i>`;
            toggleBtn.title = 'Collapse Sidebar';
            toggleBtn.setAttribute('aria-label', 'Collapse Sidebar');
            toggleBtn.setAttribute('aria-expanded', 'true');
        }
        refreshLucideIcons();

        // Invalidate map size after CSS transition completes
        setTimeout(() => { map.invalidateSize({ animate: true }); }, transitionDuration);

            currentSidebarState = state;
            if (updateHash && currentlyLoadedMapId) {
            // --- FIX: Update history with search params and new hash ---
            const newHash = generateHash(currentlyLoadedMapId, state);
            const currentSearch = window.location.search;
            const newUrl = buildAppUrlWithHash(newHash, currentSearch);
            const currentState = (history.state && typeof history.state === 'object') ? history.state : {};
            history.replaceState(
                {
                    ...currentState,
                    mapId: currentlyLoadedMapId,
                    sidebarState: state,
                    search: currentSearch,
                    hash: newHash
                },
                '',
                newUrl
            ); // Use replaceState for sidebar toggle
            }
            if (!isInitializing) {
                trackAnalytics('sidebar_toggled', { state: currentSidebarState });
            }
    } else {
            currentSidebarState = state;
    }
    safeSetStorage(UX_STORAGE_KEYS.sidebarState, currentSidebarState);
    syncSidebarBackdropState();
}

// --- Helper Function to Update the "Toggle All" Checkbox State ---
function updateToggleAllCheckboxState() {
    // Update indeterminate state for each region group parent
    const regionGroupCheckboxes = poiFilterContainer.querySelectorAll('.region-group-filter');
    regionGroupCheckboxes.forEach(groupCheckbox => {
        const groupName = groupCheckbox.value;
        const childCheckboxes = poiFilterContainer.querySelectorAll(`.region-type-filter[data-group="${groupName}"]`);
        const checkedChildren = poiFilterContainer.querySelectorAll(`.region-type-filter[data-group="${groupName}"]:checked`);

        if (checkedChildren.length === 0) {
            groupCheckbox.checked = false;
            groupCheckbox.indeterminate = false;
        } else if (checkedChildren.length === childCheckboxes.length) {
            groupCheckbox.checked = true;
            groupCheckbox.indeterminate = false;
        } else {
            groupCheckbox.checked = false;
            groupCheckbox.indeterminate = true;
        }
    });

    // Update master "Show All / Hide All" checkbox state
    const allTopLevelFilters = poiFilterContainer.querySelectorAll(
        '.poi-filter-checkbox:not(#filter-toggle-all), .region-group-filter, .line-type-filter'
    );
    const checkedTopLevelFilters = poiFilterContainer.querySelectorAll(
        '.poi-filter-checkbox:not(#filter-toggle-all):checked, .region-group-filter:checked:not(:indeterminate), .line-type-filter:checked'
    );
    const indeterminateTopLevelFilters = poiFilterContainer.querySelectorAll('.region-group-filter:indeterminate');

    if (allTopLevelFilters.length === 0) {
        filterToggleAllCheckbox.checked = true;
        filterToggleAllCheckbox.indeterminate = false;
    } else if (indeterminateTopLevelFilters.length > 0 || (checkedTopLevelFilters.length > 0 && checkedTopLevelFilters.length < allTopLevelFilters.length)) {
        filterToggleAllCheckbox.checked = false;
        filterToggleAllCheckbox.indeterminate = true;
    } else if (checkedTopLevelFilters.length === allTopLevelFilters.length) {
        filterToggleAllCheckbox.checked = true;
        filterToggleAllCheckbox.indeterminate = false;
    } else { // All are unchecked
        filterToggleAllCheckbox.checked = false;
        filterToggleAllCheckbox.indeterminate = false;
    }
}

function setCoordsDisplayVisible(visible) {
    if (visible && !currentLatLonBounds) return;
    coordsDisplayEnabled = visible;
    safeSetStorage(UX_STORAGE_KEYS.coordsVisible, String(coordsDisplayEnabled));
    if (toggleCoordsBtn) {
        toggleCoordsBtn.setAttribute('aria-pressed', coordsDisplayEnabled ? 'true' : 'false');
    }
    coordinateDisplay.style.display = coordsDisplayEnabled ? 'block' : 'none';
    trackAnalytics('coords_display_toggled', { visible: coordsDisplayEnabled });
}

function updateCurrentControlVisibility(selectedMap = null) {
    const mapInfo = selectedMap || (currentlyLoadedMapId ? findMapRecursive(mapData, currentlyLoadedMapId) : null);
    if (!mapInfo) return;

    if (isEmbeddedView) {
        setAuxPanelVisible(routePanel, false);
        setAuxPanelVisible(sessionToolkitPanel, false);
        setAuxPanelVisible(gmPill, false);
    }

    const hasPOIs = allMapMarkers.length > 0;
    const hasRegions = (visibleRegionsCache && visibleRegionsCache.length > 0) || (Array.isArray(mapInfo.regions) && mapInfo.regions.length > 0);
    const hasRoads = (visibleLinesCache && visibleLinesCache.length > 0) ||
        (Array.isArray(mapInfo.roads) && mapInfo.roads.length > 0) ||
        (Array.isArray(mapInfo.lines) && mapInfo.lines.length > 0);
    const hasValidScale = typeof mapInfo.scalePixels === 'number' && mapInfo.scalePixels > 0 &&
        typeof mapInfo.scaleKilometers === 'number' && mapInfo.scaleKilometers > 0;

    const showAdvancedControls = advancedControlsUnlocked && !isEmbeddedView;
    const allowGMToolkit = canAccessGMToolkit() && !isEmbeddedView;

    toggleMarkersBtn.style.display = (hasPOIs || hasRegions) ? 'block' : 'none';
    searchControlContainer.style.display = (hasPOIs || hasRegions) ? 'block' : 'none';
    toggleFiltersBtn.style.display = (hasPOIs || hasRegions || hasRoads) ? 'block' : 'none';
    measureToolBtn.style.display = showAdvancedControls && hasValidScale ? 'block' : 'none';
    if (toggleSoundBtn) toggleSoundBtn.style.display = showAdvancedControls ? 'block' : 'none';
    toggleBlurbBtn.style.display = showAdvancedControls && !!mapInfo.blurb ? 'block' : 'none';
    toggleCoordsBtn.style.display = showAdvancedControls && !!mapInfo.latLonBounds ? 'block' : 'none';
    if (toggleGMPanelBtn) toggleGMPanelBtn.style.display = showAdvancedControls && allowGMToolkit ? 'block' : 'none';
    if (toggleToolkitPanelBtn) toggleToolkitPanelBtn.style.display = showAdvancedControls && allowGMToolkit ? 'block' : 'none';
    toggleCoordsBtn.setAttribute('aria-pressed', coordsDisplayEnabled ? 'true' : 'false');
    if (routePanel) routePanel.style.display = currentRoutes && currentRoutes.length > 0 && !isEmbeddedView ? 'block' : 'none';
    if (sessionToolkitPanel) sessionToolkitPanel.style.display = allowGMToolkit && toolkitPanelVisible ? 'block' : 'none';
    if (gmPill) gmPill.style.display = allowGMToolkit && gmPanelVisible ? 'flex' : 'none';

    if (!showAdvancedControls) {
        if (filtersPanelVisible) {
            filtersPanelVisible = false;
            poiFilterContainer.classList.remove('visible');
            toggleFiltersBtn.classList.remove('active');
            toggleFiltersBtn.setAttribute('aria-expanded', 'false');
        }
        mapBlurbElement.classList.remove('visible');
        toggleBlurbBtn.classList.remove('active');
        coordinateDisplay.style.display = 'none';
        setAuxPanelVisible(gmPill, false);
        setAuxPanelVisible(sessionToolkitPanel, false);
        if (activeFiltersContainer) {
            activeFiltersContainer.style.display = 'none';
            activeFiltersContainer.innerHTML = '';
        }
        updatePanelToggleButtons();
        return;
    }

    if (mapInfo.latLonBounds) {
        coordinateDisplay.style.display = coordsDisplayEnabled ? 'block' : 'none';
    } else {
        coordinateDisplay.style.display = 'none';
    }
    updatePanelToggleButtons();

}

function unlockAdvancedControls(reason = 'interaction') {
    if (advancedControlsUnlocked || isEmbeddedView) return;
    advancedControlsUnlocked = true;
    safeSetStorage(UX_STORAGE_KEYS.advancedControlsUnlocked, 'true');
    setOnboardingVisibility(false);
    updateCurrentControlVisibility();
    if (safeGetStorage(UX_STORAGE_KEYS.filterPanelOpen) === 'true' && toggleFiltersBtn.style.display !== 'none') {
        filtersPanelVisible = true;
        poiFilterContainer.classList.add('visible');
        toggleFiltersBtn.classList.add('active');
        toggleFiltersBtn.setAttribute('aria-expanded', 'true');
    }
    initializeSoundState();
    updateActiveFilterChips();
    trackAnalytics('advanced_controls_unlocked', { reason });
}

function updateActiveFilterChips() {
    if (!activeFiltersContainer || isEmbeddedView) {
        if (activeFiltersContainer) {
            activeFiltersContainer.style.display = 'none';
            activeFiltersContainer.innerHTML = '';
        }
        return;
    }

    activeFiltersContainer.innerHTML = '';
    const chips = [];
    const searchTerm = poiSearchInput.value.trim();
    if (searchTerm) {
        chips.push({
            label: `Search: ${searchTerm}`,
            clear: () => {
                poiSearchInput.value = '';
                updateVisibleMarkersAndSearch();
                poiSearchInput.focus();
                trackAnalytics('search_cleared', { source: 'chip' });
            }
        });
    }

    const hiddenFilters = Array.from(
        poiFilterContainer.querySelectorAll('.poi-filter-checkbox:not(#filter-toggle-all), .region-type-filter, .line-type-filter')
    ).filter(checkbox => !checkbox.checked);

    if (hiddenFilters.length > 0) {
        if (hiddenFilters.length > 6) {
            chips.push({
                label: `${hiddenFilters.length} filters hidden`,
                clear: () => {
                    filterToggleAllCheckbox.checked = true;
                    filterToggleAllCheckbox.dispatchEvent(new Event('change', { bubbles: true }));
                }
            });
        } else {
            hiddenFilters.forEach(checkbox => {
                const label = checkbox.nextElementSibling?.textContent?.trim() || checkbox.value || 'Filter';
                chips.push({
                    label,
                    clear: () => {
                        checkbox.checked = true;
                        checkbox.dispatchEvent(new Event('change', { bubbles: true }));
                    }
                });
            });
        }
    }

    if (chips.length === 0) {
        activeFiltersContainer.style.display = 'none';
        return;
    }

    chips.forEach(chip => {
        const chipEl = document.createElement('span');
        chipEl.className = 'active-filter-chip';
        chipEl.textContent = chip.label;

        const clearBtn = document.createElement('button');
        clearBtn.type = 'button';
        clearBtn.setAttribute('aria-label', `Clear ${chip.label}`);
        clearBtn.textContent = '×';
        clearBtn.addEventListener('click', (event) => {
            event.stopPropagation();
            chip.clear();
        });

        chipEl.appendChild(clearBtn);
        activeFiltersContainer.appendChild(chipEl);
    });

    activeFiltersContainer.style.display = 'flex';
}

if (searchRefineFiltersBtn) {
    searchRefineFiltersBtn.addEventListener('click', (event) => {
        event.stopPropagation();
        if (toggleFiltersBtn.style.display === 'none') return;
        toggleFilterPanel();
    });
}

if (searchRefineClearBtn) {
    searchRefineClearBtn.addEventListener('click', (event) => {
        event.stopPropagation();
        poiSearchInput.value = '';

        filterToggleAllCheckbox.checked = true;
        filterToggleAllCheckbox.indeterminate = false;
        poiFilterContainer.querySelectorAll('.poi-filter-checkbox, .region-group-filter, .region-type-filter, .line-type-filter').forEach(checkbox => {
            if (checkbox.id !== 'filter-toggle-all') checkbox.checked = true;
        });

        updateToggleAllCheckboxState();
        updateVisibleMarkersAndSearch();
        updateVisibleRegions();
        updateVisibleLines();
        trackAnalytics('search_refine_cleared');
    });
}

if (routeStartBtn) {
    routeStartBtn.addEventListener('click', () => {
        const selectedRouteId = routeSelect?.value;
        if (selectedRouteId) startRoute(selectedRouteId);
    });
}
if (routeResetBtn) {
    routeResetBtn.addEventListener('click', () => {
        resetRoute();
    });
}
if (routeSelect) {
    routeSelect.addEventListener('change', () => {
        renderRouteSteps(null);
    });
}
if (routeCollapseBtn) {
    routeCollapseBtn.addEventListener('click', () => {
        const collapsed = !routePanel.classList.contains('collapsed');
        setPanelCollapsed(routePanel, routeCollapseBtn, collapsed, UX_STORAGE_KEYS.routePanelCollapsed);
    });
}
if (toolkitCollapseBtn) {
    toolkitCollapseBtn.addEventListener('click', () => {
        const collapsed = !sessionToolkitPanel.classList.contains('collapsed');
        setPanelCollapsed(sessionToolkitPanel, toolkitCollapseBtn, collapsed, UX_STORAGE_KEYS.toolkitPanelCollapsed);
    });
}

if (gmToggleBtn) {
    gmToggleBtn.addEventListener('click', () => {
        if (!canAccessGMToolkit()) return;
        if (!gmContentVisible && !isLocalHost()) {
            const pass = prompt('Enter GM passphrase (leave blank to cancel):', '');
            if (!pass) return;
        }
        setGMVisibility(!gmContentVisible, 'toggle_button');
    });
}
if (toggleGMPanelBtn) {
    toggleGMPanelBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!canAccessGMToolkit()) return;
        unlockAdvancedControls('gm_panel_toggle');
        gmPanelVisible = !gmPanelVisible;
        safeSetStorage(UX_STORAGE_KEYS.gmPanelVisible, gmPanelVisible ? 'true' : 'false');
        updateCurrentControlVisibility();
    });
}
if (toggleToolkitPanelBtn) {
    toggleToolkitPanelBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!canAccessGMToolkit()) return;
        unlockAdvancedControls('toolkit_panel_toggle');
        toolkitPanelVisible = !toolkitPanelVisible;
        safeSetStorage(UX_STORAGE_KEYS.toolkitPanelVisible, toolkitPanelVisible ? 'true' : 'false');
        updateCurrentControlVisibility();
    });
}

if (encounterRollBtn) {
    encounterRollBtn.addEventListener('click', () => {
        rollEncounter();
    });
}
if (encounterSelect) {
    encounterSelect.addEventListener('change', () => {
        renderEncounterTableList(encounterSelect.value);
    });
}
if (encounterViewBtn) {
    encounterViewBtn.addEventListener('click', () => {
        if (!encounterTableList) return;
        const nextVisible = encounterTableList.style.display === 'none';
        encounterTableList.style.display = nextVisible ? 'flex' : 'none';
        encounterViewBtn.textContent = nextVisible ? 'Hide List' : 'View Full List';
        if (nextVisible) renderEncounterTableList(encounterSelect?.value || '');
    });
}
if (travelDistanceInput) {
    travelDistanceInput.addEventListener('input', updateTravelTime);
}
if (travelModeSelect) {
    travelModeSelect.addEventListener('change', updateTravelTime);
}

// --- Function to Update Visible Markers AND Search Results ---
function updateVisibleMarkersAndSearch() {
    const hasMarkers = !!currentMarkerGroup && allMapMarkers.length > 0;
    const hasRegions = !!currentRegionGroup && currentRegionGroup.getLayers().length > 0;

    if (!hasMarkers && !hasRegions) {
        // Hide map-based controls only when there is nothing searchable
        searchControlContainer.style.display = 'none';
        searchResultsContainer.style.display = 'none';
        searchResultsContainer.classList.remove('with-search-meta');
        searchResultsContainer.innerHTML = '';
        setSearchMeta('');
        updateActiveFilterChips();
        return;
    }

    // Keep search available when either markers or regions exist.
    searchControlContainer.style.display = 'block';

    const searchTerm = poiSearchInput.value.toLowerCase().trim();
    searchResultsContainer.innerHTML = ''; // Clear previous results
    let searchResultCount = 0;

    // Get the set of *specifically* checked POI group filters
    const activeSpecificGroupFilters = new Set();
    poiFilterContainer.querySelectorAll('.poi-filter-checkbox:not(#filter-toggle-all):checked').forEach(checkbox => {
            activeSpecificGroupFilters.add(checkbox.value);
    });
    const allPoiGroupsChecked = filterToggleAllCheckbox.checked && !filterToggleAllCheckbox.indeterminate; // True if master toggle is fully checked

    const appendSearchResult = ({ name, matchedByContent = false, title, onSelect }) => {
        if (!searchTerm) return;
        searchResultCount += 1;
        const resultItem = document.createElement('div');
        resultItem.className = 'search-result-item';
        resultItem.tabIndex = 0;
        const escapedSearchTerm = escapeRegExp(searchTerm);
        let highlightedName = name.replace(new RegExp(escapedSearchTerm, 'gi'), '<strong>$&</strong>');
        if (matchedByContent) {
            highlightedName += ' <small style="opacity:0.7; font-size:0.8em;">(Matched content)</small>';
        }
        resultItem.innerHTML = highlightedName;
        resultItem.title = title;
        resultItem.addEventListener('click', () => {
            onSelect();
            poiSearchInput.value = '';
            searchResultsContainer.style.display = 'none';
            searchResultsContainer.classList.remove('with-search-meta');
            searchResultsContainer.innerHTML = '';
            setSearchMeta('');
            updateActiveFilterChips();
        });
        resultItem.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                resultItem.click();
            }
        });
        searchResultsContainer.appendChild(resultItem);
    };

    allMapMarkers.forEach(marker => {
        const poi = marker.poiData;
        if (!poi) return;

        const nameMatch = !searchTerm || poi.name.toLowerCase().includes(searchTerm);
        const descriptionMatch = poi.description && poi.description.toLowerCase().includes(searchTerm);
        const summaryMatch = poi.summary && poi.summary.toLowerCase().includes(searchTerm);
        const isMatch = nameMatch || descriptionMatch || summaryMatch;

        const poiGroup = getPoiGroup(poi.type);
        // A POI group matches if the master toggle is checked OR its specific group is checked
        const groupMatch = allPoiGroupsChecked || activeSpecificGroupFilters.has(poiGroup);

        // Update marker visibility on map
        if (markersVisible && isMatch && groupMatch) { // Governed by markersVisible
            if (!currentMarkerGroup.hasLayer(marker)) {
                currentMarkerGroup.addLayer(marker);
            }
        } else {
            if (currentMarkerGroup.hasLayer(marker)) {
                currentMarkerGroup.removeLayer(marker);
            }
        }

        // Populate POI search results
        if (searchTerm && isMatch) {
            appendSearchResult({
                name: poi.name,
                matchedByContent: !nameMatch && (descriptionMatch || summaryMatch),
                title: `Go to ${poi.name}`,
                onSelect: () => {
                    map.flyTo(marker.getLatLng(), Math.max(map.getZoom(), 1));
                    marker.openPopup();
                }
            });
        }
    });

    const activeRegionTypeFilters = new Set();
    poiFilterContainer.querySelectorAll('.region-type-filter:checked').forEach(checkbox => {
        activeRegionTypeFilters.add(checkbox.value);
    });
    const allRegionTypesChecked = filterToggleAllCheckbox.checked && !filterToggleAllCheckbox.indeterminate;

    if (currentRegionGroup) {
        currentRegionGroup.eachLayer(layer => {
            const region = layer.regionData;
            if (!region || !region.name) return;

            const nameMatch = region.name.toLowerCase().includes(searchTerm);
            const descriptionMatch = region.description && region.description.toLowerCase().includes(searchTerm);
            const summaryMatch = region.summary && region.summary.toLowerCase().includes(searchTerm);
            const isMatch = nameMatch || descriptionMatch || summaryMatch;

            const regionFilterValue = region.value || region.name;
            const typeMatch = allRegionTypesChecked || activeRegionTypeFilters.has(regionFilterValue);

            if (searchTerm && isMatch && typeMatch) {
                appendSearchResult({
                    name: region.name,
                    matchedByContent: !nameMatch && (descriptionMatch || summaryMatch),
                    title: `Go to ${region.name}`,
                    onSelect: () => {
                        map.fitBounds(layer.getBounds(), { maxZoom: Math.max(map.getZoom(), 1) });
                        layer.openPopup();
                    }
                });
            }
        });
    }

    const activeLineTypeFilters = new Set();
    poiFilterContainer.querySelectorAll('.line-type-filter:checked').forEach(checkbox => {
        activeLineTypeFilters.add(checkbox.value);
    });
    const allLineTypesChecked = filterToggleAllCheckbox.checked && !filterToggleAllCheckbox.indeterminate;

    if (currentRoadGroup) {
        currentRoadGroup.eachLayer(layer => {
            const line = layer.roadData;
            if (!line) return;

            const lineName = line.name || line.type || 'Unnamed Line';
            const lowerLineName = lineName.toLowerCase();
            const lineType = line.type || 'Unnamed Road Type';
            const lowerLineType = lineType.toLowerCase();

            const nameMatch = lowerLineName.includes(searchTerm);
            const typeTermMatch = lowerLineType.includes(searchTerm);
            const descriptionMatch = line.description && line.description.toLowerCase().includes(searchTerm);
            const summaryMatch = line.summary && line.summary.toLowerCase().includes(searchTerm);
            const isMatch = nameMatch || typeTermMatch || descriptionMatch || summaryMatch;

            const typeMatch = allLineTypesChecked || activeLineTypeFilters.has(lineType);

            if (searchTerm && isMatch && typeMatch) {
                appendSearchResult({
                    name: lineName,
                    matchedByContent: !nameMatch && (typeTermMatch || descriptionMatch || summaryMatch),
                    title: `Go to ${lineName}`,
                    onSelect: () => {
                        map.fitBounds(layer.getBounds(), { maxZoom: Math.max(map.getZoom(), 1) });
                        if (layer.getPopup()) {
                            layer.openPopup();
                        }
                    }
                });
            }
        });
    }

    // Route search (names + steps)
    if (searchTerm && currentRoutes && currentRoutes.length > 0) {
        currentRoutes.forEach(route => {
            const routeNameMatch = route.name && route.name.toLowerCase().includes(searchTerm);
            const routeSummaryMatch = route.summary && route.summary.toLowerCase().includes(searchTerm);
            const stepsMatch = route.steps.filter(step =>
                (step.title && step.title.toLowerCase().includes(searchTerm)) ||
                (step.body && step.body.toLowerCase().includes(searchTerm))
            );

            if (routeNameMatch || routeSummaryMatch) {
                appendSearchResult({
                    name: `${route.name || route.id} <span class="badge-kind">Route</span>`,
                    matchedByContent: routeSummaryMatch && !routeNameMatch,
                    title: `Start route ${route.name}`,
                    onSelect: () => {
                        startRoute(route.id);
                    }
                });
            }

            stepsMatch.forEach(step => {
                appendSearchResult({
                    name: `${step.title || step.id} <span class="badge-kind">Step</span>`,
                    matchedByContent: !routeNameMatch,
                    title: `Go to step ${step.title || step.id}`,
                    onSelect: () => {
                        startRoute(route.id, step.id);
                    }
                });
            });
        });
    }

    if (searchTerm) {
        if (searchResultCount === 0) {
            const emptyState = document.createElement('div');
            emptyState.className = 'search-results-empty';
            emptyState.textContent = 'No locations match this search.';
            searchResultsContainer.appendChild(emptyState);
        }
        searchResultsContainer.style.display = 'block';
        searchResultsContainer.classList.add('with-search-meta');
        setSearchMeta(`${searchResultCount} result${searchResultCount === 1 ? '' : 's'} for "${poiSearchInput.value.trim()}"`);

        const searchSignature = `${searchTerm}:${searchResultCount}`;
        if (searchResultCount > 0 && searchSignature !== lastTrackedSearchSignature) {
            lastTrackedSearchSignature = searchSignature;
            trackAnalytics('search_success', {
                term: poiSearchInput.value.trim(),
                resultCount: searchResultCount
            });
        }
    } else {
        searchResultsContainer.style.display = 'none';
        searchResultsContainer.classList.remove('with-search-meta');
        setSearchMeta('');
        lastTrackedSearchSignature = '';
    }

    updateActiveFilterChips();
}

// --- Route Mode Helpers ---
function renderRoutesPanel() {
    if (!routePanel || !routeSelect || !routeStepList) return;
    routeSelect.innerHTML = '';
    routeStepList.innerHTML = '';
    if (!currentRoutes || currentRoutes.length === 0) {
        routePanel.style.display = 'none';
        return;
    }
    routePanel.style.display = 'block';
    if (routeCountBadge) routeCountBadge.textContent = currentRoutes.length;
    currentRoutes.forEach(route => {
        const option = document.createElement('option');
        option.value = route.id;
        option.textContent = route.name || route.id;
        routeSelect.appendChild(option);
    });
    if (routeSelect.options.length > 0) {
        routeSelect.selectedIndex = 0;
    }
    renderRouteSteps(null);
}

function renderRouteSteps(activeStepId) {
    if (!routeStepList) return;
    routeStepList.innerHTML = '';
    const selectedRouteId = routeSelect?.value;
    const route = currentRoutes.find(r => r.id === selectedRouteId);
    if (!route) return;
    route.steps.forEach(step => {
        const div = document.createElement('div');
        div.className = 'list-item';
        if (activeStepId && step.id === activeStepId) div.classList.add('active');
        div.textContent = step.title || step.id;
        div.addEventListener('click', () => {
            startRoute(route.id, step.id);
        });
        routeStepList.appendChild(div);
    });
}

function updateRouteUrl(routeId, stepId) {
    const url = new URL(window.location.href);
    if (routeId) url.searchParams.set('route', routeId); else url.searchParams.delete('route');
    if (stepId) url.searchParams.set('step', stepId); else url.searchParams.delete('step');
    history.replaceState(history.state, '', url.toString());
}

function focusRouteStep(route, step) {
    if (!route || !step) return;
    renderRouteSteps(step.id);
    switch (step.targetType) {
        case 'poi': {
            const marker = allMapMarkers.find(m => m.poiData && (m.poiData.id === step.targetId || m.poiData.name === step.targetId));
            if (marker) {
                map.flyTo(marker.getLatLng(), step.zoom != null ? step.zoom : Math.max(map.getZoom(), 1));
                marker.openPopup();
            }
            break;
        }
        case 'region': {
            if (currentRegionGroup) {
                currentRegionGroup.eachLayer(layer => {
                    const region = layer.regionData;
                    if (region && (region.id === step.targetId || region.name === step.targetId)) {
                        map.fitBounds(layer.getBounds(), { maxZoom: step.zoom != null ? step.zoom : Math.max(map.getZoom(), 1) });
                        layer.openPopup();
                    }
                });
            }
            break;
        }
        case 'coords': {
            if (Array.isArray(step.coords) && step.coords.length === 2) {
                map.flyTo(step.coords, step.zoom != null ? step.zoom : Math.max(map.getZoom(), 1));
            }
            break;
        }
        case 'map': {
            if (step.targetId && step.targetId !== currentlyLoadedMapId) {
                const targetMap = findMapRecursive(mapData, step.targetId);
                if (isRenderableMapEntry(targetMap)) {
                    loadMap(step.targetId, true);
                } else {
                    trackAnalytics('route_step_map_unavailable', { routeId: route.id, targetMapId: step.targetId });
                }
            }
            break;
        }
        default:
            break;
    }
    updateRouteUrl(route.id, step.id);
}

function startRoute(routeId, stepId = null) {
    const route = currentRoutes.find(r => r.id === routeId) || currentRoutes[0];
    if (!route) return;
    currentRoute = route;
    const idx = stepId ? route.steps.findIndex(s => s.id === stepId) : 0;
    currentRouteStepIndex = idx >= 0 ? idx : 0;
    const step = route.steps[currentRouteStepIndex];
    focusRouteStep(route, step);
}

function resetRoute() {
    currentRoute = null;
    currentRouteStepIndex = -1;
    renderRouteSteps(null);
    updateRouteUrl(null, null);
}

// --- Session Toolkit Helpers ---
function updateEncounterSelect() {
    if (!encounterSelect) return;
    encounterSelect.innerHTML = '';
    if (!currentEncounterTables || currentEncounterTables.length === 0) {
        const opt = document.createElement('option');
        opt.value = '';
        opt.textContent = 'No tables on this map';
        encounterSelect.appendChild(opt);
        encounterSelect.disabled = true;
        return;
    }
    encounterSelect.disabled = false;
    currentEncounterTables.forEach(table => {
        const opt = document.createElement('option');
        opt.value = table.id;
        opt.textContent = table.name || table.id;
        encounterSelect.appendChild(opt);
    });
    renderEncounterTableList(encounterSelect.value);
}

function rollEncounter() {
    if (!encounterSelect || !encounterResult) return;
    const tableId = encounterSelect.value;
    const table = (currentEncounterTables || []).find(t => t.id === tableId);
    if (!table) {
        encounterResult.textContent = 'Select a table.';
        return;
    }
    const entries = Array.isArray(table.entries) ? table.entries : [];
    if (entries.length === 0) {
        encounterResult.textContent = 'No entries in this table.';
        return;
    }
    const totalWeight = entries.reduce((sum, e) => sum + (e.weight || 1), 0);
    let roll = Math.random() * totalWeight;
    let chosen = entries[0];
    for (const entry of entries) {
        roll -= (entry.weight || 1);
        if (roll <= 0) {
            chosen = entry;
            break;
        }
    }
    encounterResult.textContent = chosen.result || 'No result';
}

function renderEncounterTableList(tableId) {
    if (!encounterTableList) return;
    encounterTableList.innerHTML = '';
    const table = currentEncounterTables.find(t => t.id === tableId);
    if (!table || !Array.isArray(table.entries) || table.entries.length === 0) {
        const item = document.createElement('div');
        item.className = 'list-item';
        item.textContent = 'No encounter entries.';
        encounterTableList.appendChild(item);
        return;
    }
    table.entries.forEach((entry, index) => {
        const item = document.createElement('div');
        item.className = 'list-item';
        const weight = entry.weight || 1;
        item.innerHTML = `<span class="encounter-weight">x${weight}</span> ${entry.result || `Entry ${index + 1}`}`;
        encounterTableList.appendChild(item);
    });
}

function initializeGMPillDrag() {
    if (!gmPill || !mapElement) return;
    const dragHandle = gmPill.querySelector('.gm-drag-handle') || gmPill;
    let dragging = false;
    let offsetX = 0;
    let offsetY = 0;

    const onMouseMove = (event) => {
        if (!dragging) return;
        const mapRect = mapElement.getBoundingClientRect();
        const pillRect = gmPill.getBoundingClientRect();
        const maxLeft = Math.max(0, mapRect.width - pillRect.width);
        const maxTop = Math.max(0, mapRect.height - pillRect.height);
        const left = Math.min(Math.max(0, event.clientX - mapRect.left - offsetX), maxLeft);
        const top = Math.min(Math.max(0, event.clientY - mapRect.top - offsetY), maxTop);
        gmPill.style.left = `${left}px`;
        gmPill.style.top = `${top}px`;
        gmPill.style.right = 'auto';
    };

    const onMouseUp = () => {
        if (!dragging) return;
        dragging = false;
        gmPill.classList.remove('dragging');
    };

    dragHandle.addEventListener('mousedown', (event) => {
        if (event.target === gmToggleBtn) return;
        const pillRect = gmPill.getBoundingClientRect();
        dragging = true;
        offsetX = event.clientX - pillRect.left;
        offsetY = event.clientY - pillRect.top;
        gmPill.classList.add('dragging');
        event.preventDefault();
    });

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
}

function updateTravelTime() {
    if (!travelDistanceInput || !travelModeSelect || !travelTimeOutput) return;
    const km = parseFloat(travelDistanceInput.value || (lastMeasuredDistanceKm || 0));
    const speed = parseFloat(travelModeSelect.value || '5');
    if (!km || km <= 0) {
        travelTimeOutput.textContent = 'Enter distance to compute time.';
        return;
    }
    const hours = km / speed;
    const days = hours / 24;
    travelTimeOutput.textContent = `${hours.toFixed(1)} hours (~${days.toFixed(2)} days)`;
}

// --- Function to Populate Filter Checkboxes (in the panel) ---
function populateFilters(pointsOfInterest, mapId) {
    // Clear existing dynamic filters (headers, dividers, specific checkboxes)
    const dynamicElements = poiFilterContainer.querySelectorAll('h3:not(:first-of-type), hr, .filter-item:not(:first-child), .filter-group');
    dynamicElements.forEach(el => el.remove());

    const hasPOIs = pointsOfInterest && pointsOfInterest.length > 0;
    const selectedMap = findMapRecursive(mapData, mapId);
    const regions = visibleRegionsCache && visibleRegionsCache.length ? visibleRegionsCache : (selectedMap?.regions || []);
    const hasRegions = regions.length > 0;
    const lines = visibleLinesCache && visibleLinesCache.length ? visibleLinesCache : [...(selectedMap?.roads || []), ...(selectedMap?.lines || [])];
    const hasRoads = lines.length > 0;

    // Hide filter button if no POIs, no regions, and no roads
    if (!hasPOIs && !hasRegions && !hasRoads) {
        poiFilterContainer.classList.remove('visible');
        toggleFiltersBtn.style.display = 'none';
        filtersPanelVisible = false;
        toggleFiltersBtn.classList.remove('active');
        toggleFiltersBtn.setAttribute('aria-expanded', 'false');
        filterToggleAllCheckbox.checked = true;
        filterToggleAllCheckbox.indeterminate = false;
        updateActiveFilterChips();
        return;
    }

    // PART 1: Add POI type filters (existing logic)
    if (hasPOIs) {
        if (poiFilterContainer.querySelector('h3')) {
            const poiHeader = document.createElement('h3');
            poiHeader.textContent = "POI Types:";
            poiFilterContainer.appendChild(poiHeader);
        }
        const relevantGroups = new Set();
        pointsOfInterest.forEach(poi => {
            const group = getPoiGroup(poi.type);
            relevantGroups.add(group);
        });
        const sortedGroups = Array.from(relevantGroups).sort();
        sortedGroups.forEach(groupName => {
            if (!groupName || (poiTypeGroups[groupName] && poiTypeGroups[groupName].length === 0)) return;
            const filterId = `filter-group-${groupName.replace(/\s+/g, '-')}`;
            const div = document.createElement('div');
            div.className = 'filter-item';
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.id = filterId;
            checkbox.value = groupName;
            checkbox.checked = true;
            checkbox.className = 'poi-filter-checkbox';
            const label = document.createElement('label');
            label.htmlFor = filterId;
            label.textContent = groupName;
            div.appendChild(checkbox);
            div.appendChild(label);
            poiFilterContainer.appendChild(div);
        });
    }

    // PART 2: Add region type filters (NEW HIERARCHICAL LOGIC)
    if (hasRegions) {
        // Check if explicit filter groups exist, otherwise auto-generate from data
        let regionFilterGroups = selectedMap.filterGroups && selectedMap.filterGroups.Regions;

        // Auto-generation fallback
        if (!regionFilterGroups) {
            const tempGroups = {};
            regions.forEach(region => {
                // If region has type and value, group by type
                if (region.type && region.value) {
                    if (!tempGroups[region.type]) {
                        tempGroups[region.type] = new Set();
                    }
                    tempGroups[region.type].add(region.value);
                }
                // Fallback: If region just has 'type' but no 'value'
                else if (region.type && region.name) {
                    if (!tempGroups[region.type]) {
                        tempGroups[region.type] = new Set();
                    }
                    tempGroups[region.type].add(region.name);
                    if (!region.value) region.value = region.name;
                }
            });

            // Convert Sets to Arrays for processing
            if (Object.keys(tempGroups).length > 0) {
                regionFilterGroups = {};
                for (const key in tempGroups) {
                    regionFilterGroups[key] = Array.from(tempGroups[key]).sort();
                }
            }
        }

        if (regionFilterGroups && Object.keys(regionFilterGroups).length > 0) {
            if (hasPOIs) {
                const divider = document.createElement('hr');
                divider.style.margin = '10px 0';
                divider.style.borderColor = 'var(--glass-border)';
                poiFilterContainer.appendChild(divider);
            }
            const regionHeader = document.createElement('h3');
            regionHeader.textContent = "Region Types:";
            poiFilterContainer.appendChild(regionHeader);

            for (const groupName in regionFilterGroups) {
                if (Object.hasOwnProperty.call(regionFilterGroups, groupName)) {
                    const values = regionFilterGroups[groupName];
                    if (!Array.isArray(values) || values.length === 0) continue;

                    const groupContainer = document.createElement('div');
                    groupContainer.className = 'filter-group closed'; // Start as closed

                    const groupHeader = document.createElement('div');
                    groupHeader.className = 'filter-group-header';
                    groupHeader.innerHTML = `
                        <span class="filter-chevron-icon" aria-hidden="true">
                            <i class="ui-icon" data-lucide="chevron-right"></i>
                        </span>
                    `;

                    const groupDiv = document.createElement('div');
                    groupDiv.className = 'filter-item';
                    const groupFilterId = `filter-region-group-${groupName.replace(/\s+/g, '-')}`;
                    const groupCheckbox = document.createElement('input');
                    groupCheckbox.type = 'checkbox';
                    groupCheckbox.id = groupFilterId;
                    groupCheckbox.value = groupName;
                    groupCheckbox.checked = true;
                    groupCheckbox.className = 'region-group-filter';
                    const groupLabel = document.createElement('label');
                    groupLabel.htmlFor = groupFilterId;
                    groupLabel.textContent = groupName;
                    groupDiv.appendChild(groupCheckbox);
                    groupDiv.appendChild(groupLabel);
                    groupHeader.appendChild(groupDiv);
                    groupContainer.appendChild(groupHeader);

                    const nestedList = document.createElement('div');
                    nestedList.className = 'nested-filter-list';

                    values.forEach(value => {
                        const filterId = `filter-region-value-${value.replace(/\s+/g, '-')}`;
                        const div = document.createElement('div');
                        div.className = 'filter-item';
                        const checkbox = document.createElement('input');
                        checkbox.type = 'checkbox';
                        checkbox.id = filterId;
                        checkbox.value = value;
                        checkbox.checked = true;
                        checkbox.className = 'region-type-filter';
                        checkbox.dataset.group = groupName;
                        const label = document.createElement('label');
                        label.htmlFor = filterId;
                        label.textContent = value;
                        div.appendChild(checkbox);
                        div.appendChild(label);
                        nestedList.appendChild(div);
                    });
                    groupContainer.appendChild(nestedList);
                    poiFilterContainer.appendChild(groupContainer);
                }
            }
        }
    }

    // PART 3: Add line type filters (New)
    if (hasRoads) {
        if (hasPOIs || hasRegions) { // Add divider if other filters are present
            const divider = document.createElement('hr');
            divider.style.margin = '10px 0';
            divider.style.borderColor = 'var(--glass-border)';
            poiFilterContainer.appendChild(divider);
        }

        const lineHeader = document.createElement('h3');
        lineHeader.textContent = "Line Types:";
        poiFilterContainer.appendChild(lineHeader);

        const allLines = lines;
        const lineTypes = [...new Set(allLines.map(r => r.type || "Unnamed Road Type").filter(Boolean))].sort();

        lineTypes.forEach(type => {
            const filterId = `filter-line-${(type || "untyped").replace(/\s+/g, '-').toLowerCase()}`;
            const div = document.createElement('div');
            div.className = 'filter-item';
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.id = filterId;
            checkbox.value = type;
            checkbox.checked = true; // Default checked
            checkbox.className = 'line-type-filter'; // Specific class for line filters

            const label = document.createElement('label');
            label.htmlFor = filterId;
            label.textContent = type.charAt(0).toUpperCase() + type.slice(1); // Capitalize

            div.appendChild(checkbox);
            div.appendChild(label);
            poiFilterContainer.appendChild(div);
        });
    }

    // Show filter button since we have filters
    toggleFiltersBtn.style.display = 'block';

    // Restore filter panel preference for returning users.
    const shouldRestoreFilterPanel = safeGetStorage(UX_STORAGE_KEYS.filterPanelOpen) === 'true' &&
        advancedControlsUnlocked &&
        !isEmbeddedView;
    filtersPanelVisible = shouldRestoreFilterPanel;
    poiFilterContainer.classList.toggle('visible', filtersPanelVisible);
    toggleFiltersBtn.classList.toggle('active', filtersPanelVisible);
    toggleFiltersBtn.setAttribute('aria-expanded', filtersPanelVisible ? 'true' : 'false');
    if (filtersPanelVisible) {
        positionFilterPanel();
    }
    refreshLucideIcons();

    // Set initial state of the master toggle
    updateToggleAllCheckboxState();
    updateActiveFilterChips();
}
// Global function for onclick
window.copyFeatureLink = function(btn, type, name) {
    const url = new URL(window.location.href);
    // Clean existing params
    url.searchParams.delete('poi');
    url.searchParams.delete('region');
    url.searchParams.delete('line');

    url.searchParams.set(type, name);

    navigator.clipboard.writeText(url.toString()).then(() => {
        const originalText = btn.innerHTML;
        btn.innerHTML = '✔';
        setTimeout(() => {
            btn.innerHTML = originalText;
        }, 1500);
        trackAnalytics('share_link_copied', { featureType: type, featureName: name });
    }).catch(err => {
        console.error('Failed to copy link: ', err);
        alert("Failed to copy link to clipboard.");
    });
};

window.openLinkedMapFromPopup = function(event, mapId) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }

    const trimmedMapId = String(mapId || '').trim();
    if (!trimmedMapId) {
        return false;
    }

    const targetMap = findMapRecursive(mapData, trimmedMapId);
    if (!isRenderableMapEntry(targetMap)) {
        alert(`Linked map "${trimmedMapId}" is not currently available.`);
        trackAnalytics('linked_map_open_failed', { linkedMapId: trimmedMapId, reason: 'not_available' });
        return false;
    }

    if (trimmedMapId !== currentlyLoadedMapId) {
        trackAnalytics('linked_map_opened', { linkedMapId: trimmedMapId, fromMapId: currentlyLoadedMapId });
        loadMap(trimmedMapId, true);
    } else {
        map.closePopup();
    }

    return false;
};

function checkAndFocusFeature() {
    const params = new URLSearchParams(window.location.search);
    const poiName = params.get('poi');
    const regionName = params.get('region');
    const lineName = params.get('line');
    let focused = false;

    if (poiName) {
        // Search allMapMarkers
        const marker = allMapMarkers.find(m => m.poiData && m.poiData.name === poiName);
        if (marker) {
            // Ensure marker is visible (add to group if not)
            if (!currentMarkerGroup.hasLayer(marker)) {
                currentMarkerGroup.addLayer(marker);
            }
            // Also ensure the marker group is on the map (it should be)
            if (!map.hasLayer(currentMarkerGroup)) {
                 currentMarkerGroup.addTo(map);
            }

            map.setView(marker.getLatLng(), Math.max(map.getZoom(), 2), { animate: false });
            marker.openPopup();
            focused = true;
        } else {
            console.warn("POI not found for focus:", poiName);
        }
    } else if (regionName) {
         // Search currentRegionGroup
         let targetLayer = null;
         currentRegionGroup.eachLayer(layer => {
             if (layer.regionData && layer.regionData.name === regionName) {
                 targetLayer = layer;
             }
         });

         if (targetLayer) {
             map.fitBounds(targetLayer.getBounds(), { animate: false });
             targetLayer.openPopup();
             focused = true;
        } else {
             console.warn("Region not found for focus:", regionName);
         }
    } else if (lineName) {
        // Search currentRoadGroup
         let targetLayer = null;
         currentRoadGroup.eachLayer(layer => {
             if (layer.roadData && layer.roadData.name === lineName) {
                 targetLayer = layer;
             }
         });

         if (targetLayer) {
             map.fitBounds(targetLayer.getBounds(), { animate: false });
             targetLayer.openPopup();
             focused = true;
         } else {
             console.warn("Line not found for focus:", lineName);
         }
    }
    return focused;
}

// --- Map View URL State Management ---
let viewUpdateTimeout;
function updateURLWithMapView() {
    // Don't update if map is not loaded or valid
    if (!map || !currentlyLoadedMapId) return;

    clearTimeout(viewUpdateTimeout);
    viewUpdateTimeout = setTimeout(() => {
        // Double check in case map was unloaded during timeout
        if (!map || !currentlyLoadedMapId) return;

        const center = map.getCenter();
        const zoom = map.getZoom();

        // Round to reasonable precision to avoid ugly URLs
        const lat = parseFloat(center.lat.toFixed(4));
        const lng = parseFloat(center.lng.toFixed(4));

        const url = new URL(window.location.href);
        const currentView = url.searchParams.get('view');
        const newView = `${lat},${lng},${zoom}`;

        // Only update if changed
        if (currentView !== newView) {
            url.searchParams.set('view', newView);
            saveMapView(currentlyLoadedMapId, newView);
            safeSetStorage(UX_STORAGE_KEYS.lastMapId, currentlyLoadedMapId);

            // Reconstruct URL preserving hash
            const newUrl = `${url.pathname}${url.search}${window.location.hash}`;

            // Use replaceState to avoid cluttering history
            history.replaceState(history.state, '', newUrl);
        }
    }, 500); // 500ms debounce
}

// --- Function to Load/Switch Map ---
function loadMap(mapId, updateHash = true) {
    const selectedMap = findMapRecursive(mapData, mapId);
    const loadStartedAt = performance.now();
    loadingMapId = mapId;
    trackAnalytics('map_load_started', { mapId });
    setMapAtmosphere(selectedMap?.atmosphere || null);

    if (currentlyLoadedMapId && currentlyLoadedMapId !== mapId) {
        trackAnalytics('map_switched', {
            fromMapId: currentlyLoadedMapId,
            toMapId: mapId
        });
    }

    if (loadingIndicator) {
        loadingIndicator.style.display = 'flex';
        const progressBar = loadingIndicator.querySelector('.progress-bar');
        loadingProgress = 0;
        if (progressBar) progressBar.style.width = '0%';
        setLoadingMessage(
            selectedMap ? `Loading "${selectedMap.name}"...` : 'Loading map...',
            { showSpinner: true, showProgress: true, showRetry: false }
        );

        if (loadingProgressInterval) clearInterval(loadingProgressInterval);
        loadingProgressInterval = setInterval(() => {
            if (loadingProgress < 90) {
                loadingProgress += 2 + Math.random() * 3;
                loadingProgress = Math.min(loadingProgress, 90);
                if (progressBar) progressBar.style.width = `${loadingProgress}%`;
            } else {
                clearInterval(loadingProgressInterval);
                loadingProgressInterval = null;
            }
        }, 150);
    }

    if (isMeasuring) toggleMeasurementTool();
    if (isMeasuringMultiPoint) finalizeMultiPointMeasure(false);
    measurementLayerGroup.clearLayers();

    searchControlContainer.style.display = 'none';
    searchResultsContainer.style.display = 'none';
    poiFilterContainer.classList.remove('visible');
    toggleFiltersBtn.style.display = 'none';
    filtersPanelVisible = false;
    toggleFiltersBtn.classList.remove('active');
    toggleFiltersBtn.setAttribute('aria-expanded', 'false');
    poiSearchInput.value = '';
    setSearchMeta('');
    updateActiveFilterChips();

    const dynamicFilters = poiFilterContainer.querySelectorAll('h3:not(:first-of-type), hr, .filter-item:not(:first-child)');
    dynamicFilters.forEach(el => el.remove());
    filterToggleAllCheckbox.checked = true;
    filterToggleAllCheckbox.indeterminate = false;

    if (currentImageLayer) map.removeLayer(currentImageLayer);
    if (miniMapControl) miniMapControl.remove();
    miniMapControl = null;
    if (currentMarkerGroup) map.removeLayer(currentMarkerGroup);
    if (currentRegionGroup) map.removeLayer(currentRegionGroup);
    if (currentRoadGroup) map.removeLayer(currentRoadGroup);

    currentImageLayer = null;
    currentMarkerGroup = null;
    currentRegionGroup = null;
    currentRoadGroup = null;
    allMapMarkers = [];

    if (!selectedMap || selectedMap.status === 'coming-soon') {
        console.warn('Attempted to load unavailable map:', mapId);
        if (selectedMap) alert(`The map "${selectedMap.name}" is coming soon.`);
        if (loadingProgressInterval) clearInterval(loadingProgressInterval);
        loadingProgressInterval = null;
        loadingMapId = null;
        currentlyLoadedMapId = null;
        setMapAtmosphere(null);
        mapBlurbElement.classList.remove('visible');
        toggleMarkersBtn.style.display = 'none';
        measureToolBtn.style.display = 'none';
        toggleFiltersBtn.style.display = 'none';
        searchControlContainer.style.display = 'none';
        setLoadingMessage('This map is not available yet.', {
            showSpinner: false,
            showProgress: false,
            showRetry: false
        });
        if (loadingIndicator) {
            if (loadingProgressInterval) clearInterval(loadingProgressInterval);
            setTimeout(() => {
                loadingIndicator.style.display = 'none';
            }, 1400);
        }
        if (updateHash) {
            const newHash = generateHash('', currentSidebarState);
            const currentSearch = window.location.search;
            const newUrl = buildAppUrlWithHash(newHash, currentSearch);
            history.pushState(
                {
                    mapId: null,
                    sidebarState: currentSidebarState,
                    search: currentSearch,
                    hash: newHash
                },
                '',
                newUrl
            );
        }
        trackAnalytics('map_load_failed', { mapId, reason: 'unavailable' });
        return;
    }

    if (mapId === currentlyLoadedMapId && currentImageLayer) {
        loadingMapId = null;
        if (updateHash) {
            const newHash = generateHash(mapId, currentSidebarState);
            const currentSearch = window.location.search;
            const newUrl = buildAppUrlWithHash(newHash, currentSearch);
            if (window.location.href !== new URL(newUrl, window.location.href).href) {
                history.replaceState(
                    {
                        mapId,
                        sidebarState: currentSidebarState,
                        search: currentSearch,
                        hash: newHash
                    },
                    '',
                    newUrl
                );
            }
        }
        if (loadingIndicator) {
            if (loadingProgressInterval) clearInterval(loadingProgressInterval);
            loadingIndicator.style.display = 'none';
        }
        return;
    }

    currentMarkerGroup = L.layerGroup();
    currentRegionGroup = L.layerGroup().addTo(map);
    currentRoadGroup = L.layerGroup().addTo(map);

    const mapHeight = selectedMap.height;
    const mapWidth = selectedMap.width;
    if (isNaN(mapHeight) || isNaN(mapWidth) || !selectedMap.imageUrl) {
        console.error(`Invalid dimensions or missing imageUrl for map ID ${mapId}`);
        if (loadingProgressInterval) clearInterval(loadingProgressInterval);
        loadingProgressInterval = null;
        currentlyLoadedMapId = null;
        setMapAtmosphere(null);
        toggleMarkersBtn.style.display = 'none';
        measureToolBtn.style.display = 'none';
        toggleFiltersBtn.style.display = 'none';
        searchControlContainer.style.display = 'none';
        setLoadingMessage(
            `Could not load "${selectedMap.name}". The map data is invalid. Press Retry after fixing map dimensions.`,
            { showSpinner: false, showProgress: false, showRetry: true }
        );
        if (updateHash) {
            const newHash = generateHash('', currentSidebarState);
            const currentSearch = window.location.search;
            const newUrl = buildAppUrlWithHash(newHash, currentSearch);
            history.pushState(
                {
                    mapId: null,
                    sidebarState: currentSidebarState,
                    search: currentSearch,
                    hash: newHash
                },
                '',
                newUrl
            );
        }
        trackAnalytics('map_load_failed', { mapId, reason: 'invalid_data' });
        return;
    }

    currentBounds = [[0, 0], [mapHeight, mapWidth]];
    currentImageLayer = L.imageOverlay(selectedMap.imageUrl, currentBounds);

    const preloadImg = new Image();
    let loadingComplete = false;
    let loadingTimeout = null;

    function finishLoading() {
        if (loadingComplete) return;
        loadingComplete = true;
        clearTimeout(loadingTimeout);

        // Defensive: if layer got detached during async startup, attach it again.
        if (currentImageLayer && !map.hasLayer(currentImageLayer)) {
            currentImageLayer.addTo(map);
        }

        if (loadingIndicator) {
            const progressBarEl = loadingIndicator.querySelector('.progress-bar');
            if (progressBarEl) progressBarEl.style.width = '100%';
            setTimeout(() => {
                if (loadingProgressInterval) clearInterval(loadingProgressInterval);
                loadingProgressInterval = null;
                loadingIndicator.style.display = 'none';
                loadingIndicator.classList.remove('initial-loader');
            }, 300);
        }

        const params = new URLSearchParams(window.location.search);
        let featureFocused = false;
        if (params.has('poi') || params.has('region') || params.has('line')) {
            featureFocused = checkAndFocusFeature();
        }
        if (!featureFocused && params.has('route')) {
            const routeIdParam = params.get('route');
            const stepIdParam = params.get('step');
            startRoute(routeIdParam, stepIdParam);
            featureFocused = true;
        }

        if (!featureFocused) {
            const viewParam = params.get('view') || getSavedMapView(mapId);
            if (viewParam) {
                const [lat, lng, zoom] = viewParam.split(',').map(Number);
                if (!isNaN(lat) && !isNaN(lng) && !isNaN(zoom)) {
                    map.setView([lat, lng], zoom, { animate: false });
                } else {
                    map.fitBounds(currentBounds);
                }
            } else {
                map.fitBounds(currentBounds);
            }
        }

        const miniMapLayer = L.imageOverlay(selectedMap.imageUrl, currentBounds);
        const maxMiniMapSize = 200;
        let miniMapWidth;
        let miniMapHeight;

        if (mapWidth >= mapHeight) {
            miniMapWidth = maxMiniMapSize;
            miniMapHeight = maxMiniMapSize * (mapHeight / mapWidth);
        } else {
            miniMapHeight = maxMiniMapSize;
            miniMapWidth = maxMiniMapSize * (mapWidth / mapHeight);
        }

        const maxDim = Math.max(mapHeight, mapWidth);
        const miniMapZoom = Math.log2(maxMiniMapSize / maxDim);

        miniMapControl = new L.Control.MiniMap(miniMapLayer, {
            toggleDisplay: true,
            minimized: false,
            width: miniMapWidth,
            height: miniMapHeight,
            zoomLevelFixed: miniMapZoom,
            centerFixed: L.latLngBounds(currentBounds).getCenter(),
            aimingRectOptions: { color: '#ff7800', weight: 3, clickable: false },
            shadowRectOptions: { color: '#000000', weight: 1, clickable: false, opacity: 0, fillOpacity: 0 },
            mapOptions: { minZoom: -100, crs: L.CRS.Simple, zoomSnap: 0, zoomDelta: 0 }
        }).addTo(map);

        trackAnalytics('map_load_success', {
            mapId,
            mapName: selectedMap.name,
            durationMs: Math.round(performance.now() - loadStartedAt)
        });
    }

    preloadImg.onload = function () { finishLoading(); };
    currentImageLayer.on('load', function () { finishLoading(); });
    currentImageLayer.on('error', function () {
        if (loadingComplete) return;
        loadingComplete = true;
        clearTimeout(loadingTimeout);
        console.error('Image overlay failed to load:', selectedMap.imageUrl);
        if (loadingProgressInterval) clearInterval(loadingProgressInterval);
        loadingProgressInterval = null;
        setLoadingMessage(
            `Could not load "${selectedMap.name}" image. Check the image path and press Retry.`,
            { showSpinner: false, showProgress: false, showRetry: true }
        );
        if (currentImageLayer) map.removeLayer(currentImageLayer);
        currentImageLayer = null;
        currentlyLoadedMapId = null;
        setMapAtmosphere(null);
        toggleMarkersBtn.style.display = 'none';
        measureToolBtn.style.display = 'none';
        toggleFiltersBtn.style.display = 'none';
        searchControlContainer.style.display = 'none';
        if (updateHash) {
            const newHash = generateHash('', currentSidebarState);
            const currentSearch = window.location.search;
            const newUrl = buildAppUrlWithHash(newHash, currentSearch);
            history.pushState(
                {
                    mapId: null,
                    sidebarState: currentSidebarState,
                    search: currentSearch,
                    hash: newHash
                },
                '',
                newUrl
            );
        }
        trackAnalytics('map_load_failed', { mapId, reason: 'image_error' });
    });

    loadingTimeout = setTimeout(() => {
        console.warn('Loading fallback timer triggered.');
        finishLoading();
    }, 8000);

    preloadImg.src = selectedMap.imageUrl;
    currentImageLayer.addTo(map);

    visiblePointsCache = getVisiblePoints(selectedMap);
    visibleRegionsCache = getVisibleRegions(selectedMap);
    visibleLinesCache = getVisibleLines(selectedMap);
    visibleRoutes = getVisibleRoutes(selectedMap);
    currentRoutes = visibleRoutes;
    currentEncounterTables = getVisibleEncounterTables(selectedMap);
    renderRoutesPanel();
    updateEncounterSelect();
    updateTravelTime();
    populateFilters(visiblePointsCache, mapId);

    visiblePointsCache.forEach(point => {
        try {
            if (point.coords && point.coords.length === 2 && !isNaN(point.coords[0]) && !isNaN(point.coords[1])) {
                if (point.coords[0] >= 0 && point.coords[0] <= mapHeight && point.coords[1] >= 0 && point.coords[1] <= mapWidth) {
                    const marker = L.marker(point.coords, {
                        icon: getPoiIcon(getPoiGroup(point.type))
                    });
                    if (marker) {
                        marker.poiData = point;
                        marker.bindPopup(createPopupContent(point, 'poi'), { minWidth: 250 });
                        allMapMarkers.push(marker);
                    } else {
                        console.warn(`L.marker returned undefined for POI: ${point.name || 'Unnamed POI'}`);
                    }
                } else {
                    console.warn(`POI coordinates out of bounds for map ${selectedMap.name}: ${point.name}`, point.coords);
                }
            } else {
                console.warn(`Invalid coordinates for POI: ${point.name}`, point.coords);
            }
        } catch (error) {
            console.error(`Error processing POI: ${point ? (point.name || JSON.stringify(point)) : 'Unknown POI'}`, error);
        }
    });

    currentMarkerGroup.addTo(map);
    updateVisibleMarkersAndSearch();

    addRegionsToMap(mapId);
    addRoadsToMap(mapId);
    updateVisibleRegions();
    if (typeof updateVisibleLines === 'function') {
        updateVisibleLines();
    }

    if (currentRegionGroup && typeof currentRegionGroup.bringToBack === 'function') {
        currentRegionGroup.bringToBack();
    }

    map.off('mousemove', updateCoordinates);
    if (selectedMap.latLonBounds) {
        currentLatLonBounds = selectedMap.latLonBounds;
        map.on('mousemove', updateCoordinates);
    } else {
        currentLatLonBounds = null;
        map.off('mousemove', updateCoordinates);
        coordinateDisplay.style.display = 'none';
    }

    toggleMarkersBtn.classList.toggle('markers-hidden', !markersVisible);
    toggleMarkersBtn.title = markersVisible ? 'Hide Markers & Regions' : 'Show Markers & Regions';
    toggleMarkersBtn.setAttribute('aria-label', toggleMarkersBtn.title);

    if (selectedMap.blurb) {
        mapBlurbElement.innerHTML = selectedMap.blurb;
    } else {
        mapBlurbElement.innerHTML = '';
        mapBlurbElement.classList.remove('visible');
        toggleBlurbBtn.classList.remove('active');
    }

    updateCurrentControlVisibility(selectedMap);
    updateActiveFilterChips();

    document.querySelectorAll('#map-list .map-item, #map-list .folder-header').forEach(item => item.classList.remove('active'));
    const activeMapItem = document.querySelector(`#map-list .map-item[data-map-id="${mapId}"]`);
    const activeFolderHeader = document.querySelector(`#map-list .folder-header[data-map-id="${mapId}"]`);
    if (activeMapItem) {
        activeMapItem.classList.add('active');
        let parent = activeMapItem.closest('.nested-list');
        while (parent) {
            const folderLi = parent.closest('.folder');
            if (folderLi && folderLi.classList.contains('closed')) {
                folderLi.classList.remove('closed');
                syncFolderExpandedAria(folderLi);
            }
            parent = folderLi?.parentElement.closest('.nested-list');
        }
    } else if (activeFolderHeader) {
        activeFolderHeader.classList.add('active');
        const folderLi = activeFolderHeader.closest('.folder');
        if (folderLi && folderLi.classList.contains('closed')) {
            folderLi.classList.remove('closed');
            syncFolderExpandedAria(folderLi);
        }
    }

    currentlyLoadedMapId = mapId;
    safeSetStorage(UX_STORAGE_KEYS.lastMapId, mapId);
    loadingMapId = null;

    if (!isEmbeddedView && window.innerWidth <= 768 && !container.classList.contains('sidebar-collapsed')) {
        setSidebarState('c', false);
    }

    if (updateHash) {
        const newHash = generateHash(mapId, currentSidebarState);
        const currentSearch = window.location.search;
        const newUrl = buildAppUrlWithHash(newHash, currentSearch);
        history.pushState(
            {
                mapId,
                sidebarState: currentSidebarState,
                search: currentSearch,
                hash: newHash
            },
            selectedMap.name,
            newUrl
        );
    }
}

// --- Function to add regions to map ---
function addRegionsToMap(mapId) {
    if (!currentRegionGroup) {
        currentRegionGroup = L.layerGroup().addTo(map);
    } else {
        currentRegionGroup.clearLayers();
    }

    const selectedMap = findMapRecursive(mapData, mapId);
    if (!selectedMap) return;
    const regionsToUse = visibleRegionsCache && visibleRegionsCache.length ? visibleRegionsCache : (selectedMap.regions || []);
    if (!regionsToUse || !Array.isArray(regionsToUse)) {
        return;
    }

    regionsToUse.forEach(region => {
        if (!region.coordinates || region.coordinates.length < 3) {
            console.warn(`Invalid coordinates for region: ${region.name}`);
            return;
        }

        const polygon = L.polygon(region.coordinates, {
            color: region.color || '#3388ff',
            fillColor: region.fillColor || '#3388ff',
            fillOpacity: regionsVisible ? (region.fillOpacity || 0.2) : 0, // Initial opacity based on toggle
            weight: 2,
            opacity: regionsVisible ? 1 : 0, // Initial opacity based on toggle
            interactive: true // Make regions clickable
        });

        let popupContent = '';
        if (region.wikiLink) {
            popupContent += `<h3><a href="${region.wikiLink}" target="_blank" rel="noopener noreferrer" title="Visit wiki page for ${region.name}">${region.name}</a></h3>`;
        } else {
            popupContent += `<h3>${region.name}</h3>`;
        }

        // NEW: Display type and value in popup
        if (region.type && region.value) {
            popupContent += `<p><em>${region.type}: ${region.value}</em></p>`;
        } else if (region.type) {
            popupContent += `<p><em>Type: ${region.type}</em></p>`;
        }

        popupContent += formatPropertiesForPopup(region.properties, !!region.description);
        if (region.description) {
            popupContent += `<p>${region.description}</p>`;
        }
        polygon.bindPopup(createPopupContent(region, 'region'), {
            minWidth: 250 // Set a min-width for consistency
        });

        polygon.regionData = region; // Store data for filtering
        currentRegionGroup.addLayer(polygon);
        polygon.bringToBack(); // Ensure regions are behind markers
    });
}

// --- Update region visibility based on main toggle and filters ---
function updateVisibleRegions() {
    if (!currentRegionGroup) return;

    // Get the currently checked region type filters (the individual values)
    const valueFilters = poiFilterContainer.querySelectorAll('.region-type-filter:checked');
    const valueFilterValues = new Set(Array.from(valueFilters).map(cb => cb.value));

    // Check the master toggle state
    const allTypesChecked = filterToggleAllCheckbox.checked && !filterToggleAllCheckbox.indeterminate;

    currentRegionGroup.eachLayer(layer => {
        const region = layer.regionData;
        if (!region || !region.type || !region.value) return;

        // A region is visible if the master toggle is checked OR its specific value is in the checked set.
        const typeMatch = allTypesChecked || valueFilterValues.has(region.value);

        // Apply visibility and interactivity based on *both* the overall toggle AND the type filter match
        if (regionsVisible && typeMatch) { // regionsVisible is synced with markersVisible
            layer.setStyle({
                stroke: true,
                fill: true,
                opacity: 1,
                fillOpacity: region.fillOpacity || 0.2
            });
            layer.bringToBack();
        } else {
            layer.setStyle({
                stroke: false,
                fill: false
            });
        }
    });
}

// --- Populate Sidebar (Recursive Function) ---
function syncFolderExpandedAria(folderListItem) {
    if (!folderListItem) return;
    const header = folderListItem.querySelector('.folder-header');
    if (!header) return;
    const expanded = !folderListItem.classList.contains('closed');
    const expandedText = expanded ? 'true' : 'false';
    const toggleBtn = header.querySelector('.folder-toggle-btn');
    const mainAction = header.querySelector('.folder-main-action');
    if (toggleBtn) toggleBtn.setAttribute('aria-expanded', expandedText);
    if (mainAction) mainAction.setAttribute('aria-expanded', expandedText);
}

function populateSidebar(parentElement, items) {
    parentElement.innerHTML = '';
    items.forEach(item => {
        const listItem = document.createElement('li');

        if (item.type === 'folder') {
            listItem.classList.add('folder', 'closed');
            const header = document.createElement('div');
            header.classList.add('folder-header');
            const folderName = item.name || 'Unnamed Folder!';
            const hasChildren = Array.isArray(item.children) && item.children.length > 0;
            const isComingSoon = item.status === 'coming-soon';
            const isLoadable = isRenderableMapEntry(item);

            const toggleBtn = document.createElement('button');
            toggleBtn.type = 'button';
            toggleBtn.className = 'folder-toggle-btn';
            toggleBtn.setAttribute('aria-label', `Toggle folder: ${folderName}`);
            toggleBtn.innerHTML = `
                <span class="sidebar-chevron-icon" aria-hidden="true">
                    <i class="ui-icon" data-lucide="chevron-right"></i>
                </span>
            `;
            if (!hasChildren) {
                toggleBtn.disabled = true;
                toggleBtn.setAttribute('aria-hidden', 'true');
                toggleBtn.tabIndex = -1;
            }

            const mainAction = document.createElement('button');
            mainAction.type = 'button';
            mainAction.className = 'folder-main-action';
            if (isLoadable) {
                const loadIcon = document.createElement('span');
                loadIcon.className = 'folder-load-icon';
                loadIcon.setAttribute('aria-hidden', 'true');
                loadIcon.innerHTML = `<i class="ui-icon" data-lucide="map-pin"></i>`;
                mainAction.appendChild(loadIcon);
            }
            const mainActionLabel = document.createElement('span');
            mainActionLabel.className = 'folder-main-action-label';
            mainActionLabel.textContent = `${folderName}${isComingSoon ? ' (Soon)' : ''}`;
            mainAction.appendChild(mainActionLabel);

            const nestedList = document.createElement('ul');
            nestedList.classList.add('nested-list');

            if (hasChildren) {
                populateSidebar(nestedList, item.children);
            }

            const toggleFolderOpen = (e) => {
                e.stopPropagation();
                if (!hasChildren) return;
                listItem.classList.toggle('closed');
                syncFolderExpandedAria(listItem);
            };

            toggleBtn.addEventListener('click', toggleFolderOpen);
            toggleBtn.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    toggleFolderOpen(e);
                }
            });

            if (isLoadable) {
                header.dataset.mapId = item.id;
                mainAction.title = `Load map: ${folderName}`;
                mainAction.setAttribute('aria-label', `Load map: ${folderName}`);
                mainAction.addEventListener('click', (e) => {
                    e.stopPropagation();
                    unlockAdvancedControls('map_selected');
                    loadMap(item.id, true);
                });
                mainAction.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        mainAction.click();
                    }
                });
            } else if (isComingSoon) {
                header.classList.add('coming-soon');
                mainAction.title = `${folderName} - Coming Soon!`;
                mainAction.setAttribute('aria-label', `${folderName} coming soon`);
                mainAction.addEventListener('click', (e) => {
                    e.stopPropagation();
                    alert(`The map "${folderName}" is coming soon!`);
                });
                mainAction.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        mainAction.click();
                    }
                });
            } else {
                mainAction.title = `Toggle folder: ${folderName}`;
                mainAction.setAttribute('aria-label', `Toggle folder: ${folderName}`);
                mainAction.addEventListener('click', toggleFolderOpen);
                mainAction.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        toggleFolderOpen(e);
                    }
                });
            }
            syncFolderExpandedAria(listItem);
            header.appendChild(toggleBtn);
            header.appendChild(mainAction);
            listItem.appendChild(header);
            listItem.appendChild(nestedList);

        } else { // Map Item
            listItem.classList.add('map-item');
            listItem.textContent = item.name || 'Unnamed Map!'; // Add fallback text
            listItem.dataset.mapId = item.id;
            listItem.tabIndex = 0;
            listItem.setAttribute('role', 'button');

            if (item.status === 'coming-soon') {
                listItem.classList.add('coming-soon');
                listItem.textContent = `${item.name || 'Unnamed Map!'} (Soon)`;
                listItem.title = `${item.name || 'Coming Soon!'} - Coming Soon!`;
                listItem.addEventListener('click', (e) => {
                    e.stopPropagation();
                    alert(`The map "${item.name || 'this map'}" is coming soon!`);
                });
                listItem.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        listItem.click();
                    }
                });
            } else if (!isRenderableMapEntry(item)) {
                listItem.classList.add('coming-soon');
                listItem.textContent = `${item.name || 'Unnamed Map!'} (Unavailable)`;
                listItem.title = `${item.name || 'This map'} is not currently available`;
                listItem.addEventListener('click', (e) => {
                    e.stopPropagation();
                    alert(`The map "${item.name || 'this map'}" is not currently available.`);
                });
                listItem.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        listItem.click();
                    }
                });
            } else {
                listItem.title = `Load map: ${item.name || 'Unnamed Map!'}`;
                listItem.addEventListener('click', (e) => {
                    e.stopPropagation();
                    unlockAdvancedControls('map_selected');
                    loadMap(item.id, true);
                });
                listItem.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        listItem.click();
                    }
                });
            }
        }
        parentElement.appendChild(listItem);
    });
    refreshLucideIcons();
}
// populateSidebar is now called within initializeApp after data is loaded

// --- Sidebar Toggle Button Logic ---
toggleBtn.addEventListener('click', () => {
    unlockAdvancedControls('sidebar_toggle');
    const newState = container.classList.contains('sidebar-collapsed') ? 'o' : 'c';
    setSidebarState(newState, true);
});

if (sidebarBackdrop) {
    sidebarBackdrop.addEventListener('click', () => {
        setSidebarState('c', true);
    });
}

window.addEventListener('resize', debounce(syncSidebarBackdropState, 120));
window.addEventListener('resize', debounce(positionFilterPanel, 120));

if (loadingRetryBtn) {
    loadingRetryBtn.addEventListener('click', () => {
        trackAnalytics('retry_clicked', { mapId: loadingMapId || currentlyLoadedMapId || null });
        loadingRetryBtn.style.display = 'none';

        if (loadingMapId) {
            loadMap(loadingMapId, false);
            return;
        }

        if (currentlyLoadedMapId) {
            loadMap(currentlyLoadedMapId, false);
            return;
        }

        loadMapData();
    });
}

// --- Theme Toggle Logic ---
function applyTheme(theme, options = {}) {
    const { animate = true } = options;
    const normalizedTheme = theme === 'dark' ? 'dark' : 'light';
    const shouldAnimate = animate && shouldAnimateThemeTransition();
    const previousEffectiveTheme = currentEffectiveTheme;
    const shouldUseCloudHandoff = shouldAnimate && previousEffectiveTheme === 'light' && normalizedTheme === 'dark';

    if (shouldAnimate) {
        rootElement.classList.add('theme-animating');
    }

    if (shouldUseCloudHandoff) {
        rootElement.classList.add(THEME_CLOUD_HANDOFF_CLASS);
    } else {
        rootElement.classList.remove(THEME_CLOUD_HANDOFF_CLASS);
    }

    currentEffectiveTheme = normalizedTheme;
    rootElement.setAttribute('data-theme', normalizedTheme);
    rootElement.style.colorScheme = normalizedTheme;
    bodyElement.classList.toggle('dark-theme', normalizedTheme === 'dark'); // Backward-compatibility class.
    if (themeToggle) {
        themeToggle.checked = normalizedTheme === 'dark';
    }
    syncThemeToggleA11y(normalizedTheme);
    applyAtmosphereLayer();

    if (themeAnimationTimeoutId) {
        clearTimeout(themeAnimationTimeoutId);
        themeAnimationTimeoutId = null;
    }
    if (shouldAnimate) {
        const transitionDurationMs = getThemeAnimationDurationMs();
        themeAnimationTimeoutId = window.setTimeout(() => {
            rootElement.classList.remove('theme-animating');
            rootElement.classList.remove(THEME_CLOUD_HANDOFF_CLASS);
            themeAnimationTimeoutId = null;
        }, transitionDurationMs);
    } else {
        rootElement.classList.remove('theme-animating');
        rootElement.classList.remove(THEME_CLOUD_HANDOFF_CLASS);
    }
}

function setThemePreference(preference) {
    const normalizedPreference = isValidThemePreference(preference) ? preference : 'system';
    themePreference = normalizedPreference;
    safeSetStorage(UX_STORAGE_KEYS.themePreference, normalizedPreference);
    if (normalizedPreference === 'light' || normalizedPreference === 'dark') {
        safeSetStorage(UX_STORAGE_KEYS.theme, normalizedPreference); // Legacy key compatibility.
    } else {
        safeRemoveStorage(UX_STORAGE_KEYS.theme);
    }
    applyTheme(resolveEffectiveTheme(normalizedPreference), { animate: true });
}

function handleSystemThemeChange() {
    if (themePreference !== 'system') return;
    applyTheme(resolveEffectiveTheme('system'), { animate: true });
}

if (systemThemeMediaQuery) {
    if (typeof systemThemeMediaQuery.addEventListener === 'function') {
        systemThemeMediaQuery.addEventListener('change', handleSystemThemeChange);
    } else if (typeof systemThemeMediaQuery.addListener === 'function') {
        systemThemeMediaQuery.addListener(handleSystemThemeChange);
    }
}

themeToggle.addEventListener('change', () => {
    unlockAdvancedControls('theme_toggle');
    const newThemePreference = themeToggle.checked ? 'dark' : 'light';
    setThemePreference(newThemePreference);
    const effectiveTheme = resolveEffectiveTheme(newThemePreference);
    trackAnalytics('theme_changed', { theme: effectiveTheme, preference: newThemePreference });

    // Update audio track if sound is enabled
    if (soundEnabled) {
        if (effectiveTheme === 'dark') {
            fadeAudio(lightAmbient, 0);
            fadeAudio(darkAmbient, 0.3);
        } else {
            fadeAudio(darkAmbient, 0);
            fadeAudio(lightAmbient, 0.3);
        }
    }
});

// --- Sound Control Logic ---
function fadeAudio(audioElement, targetVolume, duration = 1800) {
    if (!audioElement) return;
    const existingFrame = activeAudioFadeFrameIds.get(audioElement);
    if (existingFrame) {
        cancelAnimationFrame(existingFrame);
        activeAudioFadeFrameIds.delete(audioElement);
    }

    const clampedTarget = Math.max(0, Math.min(1, targetVolume));
    const easeInOutCubic = (t) => (t < 0.5)
        ? 4 * t * t * t
        : 1 - Math.pow(-2 * t + 2, 3) / 2;

    const startVolume = audioElement.volume;
    const volumeChange = clampedTarget - startVolume;
    if (volumeChange === 0 && (clampedTarget === 0 || !audioElement.paused)) return;

    const startTime = Date.now();

    function updateVolume() {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(1, elapsed / duration);
        const easedProgress = easeInOutCubic(progress);
        audioElement.volume = Math.max(0, Math.min(1, startVolume + (volumeChange * easedProgress)));

        if (progress < 1) {
            const frameId = requestAnimationFrame(updateVolume);
            activeAudioFadeFrameIds.set(audioElement, frameId);
        } else {
            activeAudioFadeFrameIds.delete(audioElement);
            if (clampedTarget === 0 && !audioElement.paused) {
                audioElement.pause();
            }
        }
    }

    if (clampedTarget > 0 && audioElement.paused) {
        audioElement.volume = 0; // Start from silent
        audioElement.play().then(() => {
            const frameId = requestAnimationFrame(updateVolume);
            activeAudioFadeFrameIds.set(audioElement, frameId);
        }).catch(e => console.warn('Audio play prevented:', e));
    } else if (clampedTarget > 0 && !audioElement.paused) {
        const frameId = requestAnimationFrame(updateVolume);
        activeAudioFadeFrameIds.set(audioElement, frameId);
    } else if (clampedTarget === 0) {
        const frameId = requestAnimationFrame(updateVolume);
        activeAudioFadeFrameIds.set(audioElement, frameId);
    }
}
// --- Function to add roads to map ---
function addRoadsToMap(mapId) {
    if (!currentRoadGroup) {
        currentRoadGroup = L.layerGroup().addTo(map);
    } else {
        currentRoadGroup.clearLayers();
    }

    const selectedMap = findMapRecursive(mapData, mapId);
    if (!selectedMap) return;

    const allLines = (visibleLinesCache && visibleLinesCache.length) ? visibleLinesCache : [...(selectedMap.roads || []), ...(selectedMap.lines || [])];

    if (allLines.length === 0) {
        return;
    }

    allLines.forEach(road => {
        if (!road.coordinates || road.coordinates.length < 2) {
            console.warn(`Invalid coordinates for road: ${road.name}`);
            return;
        }

        const polyline = L.polyline(road.coordinates, {
            color: road.color || '#ffffff',
            weight: road.weight || 3,
            opacity: road.opacity || 0.8,
            dashArray: road.dashArray || null,
            interactive: true // Make roads clickable
        });

        // Store original opacity for filtering
        polyline.originalOpacity = road.opacity || 0.8;

        let popupContent = '';
        if (road.name) {
            if (road.wikiLink) {
                popupContent += `<h3><a href="${road.wikiLink}" target="_blank" rel="noopener noreferrer" title="Visit wiki page for ${road.name}">${road.name}</a></h3>`;
            } else {
                popupContent += `<h3>${road.name}</h3>`;
            }
        }

        // NEW: Display type and value in popup
        if (road.type) {
            const typeString = road.type.charAt(0).toUpperCase() + road.type.slice(1);
            popupContent += `<p><em>Type: ${typeString}</em></p>`;
        }

        popupContent += formatPropertiesForPopup(road.properties, !!road.description);
        if (road.description) {
            popupContent += `<p>${road.description}</p>`;
        }

        if (popupContent) {
            polyline.bindPopup(createPopupContent(road, 'line'), { // Use unified creator
                minWidth: 250
            });
        }

        polyline.roadData = road; // Store data for filtering
        currentRoadGroup.addLayer(polyline);
    });
}

function initializeSoundState() {
    const setSoundIcon = (enabled) => {
        if (!soundIcon) return;
        soundIcon.innerHTML = `<i class="ui-icon" data-lucide="${enabled ? 'volume-2' : 'volume-x'}" aria-hidden="true"></i>`;
        refreshLucideIcons();
    };

    // --- NEW: Check for embedded mode ---
    const urlParams = getUrlParameters(); // Need to get params here too
    if (urlParams.embed === 'true' || urlParams.hideUI === 'true') {
        soundEnabled = false; // Ensure state reflects no sound
        // Set icon/title to muted state (even though button is hidden)
        setSoundIcon(false);
        if (toggleSoundBtn) toggleSoundBtn.title = "Unmute Sound"; // Check if button exists before setting title
        return; // Exit early, do not proceed with sound logic
    }
    // --- END: Embedded mode check ---


    const savedSoundState = safeGetStorage(UX_STORAGE_KEYS.soundEnabled);
    // Only proceed if not in embedded mode (checked above)
    soundEnabled = savedSoundState === 'true'; // Convert string to boolean
    const canUseSoundNow = advancedControlsUnlocked && !isEmbeddedView;

    // Set initial volume to 0 to prevent autoplay issues on load
    lightAmbient.volume = 0;
    darkAmbient.volume = 0;

    if (soundEnabled && canUseSoundNow) {
        setSoundIcon(true);
            if (toggleSoundBtn) {
                toggleSoundBtn.title = "Mute Sound";
                toggleSoundBtn.setAttribute('aria-label', "Mute Sound");
                toggleSoundBtn.setAttribute('aria-pressed', "true");
            }
        // Start playing the correct track based on the current theme
        const currentTheme = currentEffectiveTheme;
        if (currentTheme === 'dark') {
            fadeAudio(darkAmbient, 0.3);
        } else {
            fadeAudio(lightAmbient, 0.3);
        }
    } else {
        fadeAudio(lightAmbient, 0);
        fadeAudio(darkAmbient, 0);
        setSoundIcon(false);
        if (toggleSoundBtn) {
            toggleSoundBtn.title = "Unmute Sound";
            toggleSoundBtn.setAttribute('aria-label', "Unmute Sound");
            toggleSoundBtn.setAttribute('aria-pressed', soundEnabled && !canUseSoundNow ? "true" : "false");
        }
    }
    // Make button visible now that state is set (only if not embedded)
    if (toggleSoundBtn) toggleSoundBtn.style.display = (advancedControlsUnlocked && !isEmbeddedView) ? 'block' : 'none';
}

if (toggleSoundBtn) {
    toggleSoundBtn.addEventListener('click', (e) => {
        unlockAdvancedControls('sound_toggle');
        e.stopPropagation();
        soundEnabled = !soundEnabled;
        safeSetStorage(UX_STORAGE_KEYS.soundEnabled, String(soundEnabled));

        if (soundEnabled) {
            soundIcon.innerHTML = `<i class="ui-icon" data-lucide="volume-2" aria-hidden="true"></i>`;
            refreshLucideIcons();
            toggleSoundBtn.title = "Mute Sound";
            toggleSoundBtn.setAttribute('aria-label', "Mute Sound");
            toggleSoundBtn.setAttribute('aria-pressed', "true");

            const currentTheme = currentEffectiveTheme;
            if (currentTheme === 'dark') {
                fadeAudio(darkAmbient, 0.3);
            } else {
                fadeAudio(lightAmbient, 0.3);
            }
        } else {
            soundIcon.innerHTML = `<i class="ui-icon" data-lucide="volume-x" aria-hidden="true"></i>`;
            refreshLucideIcons();
            toggleSoundBtn.title = "Unmute Sound";
            toggleSoundBtn.setAttribute('aria-label', "Unmute Sound");
            toggleSoundBtn.setAttribute('aria-pressed', "false");

            fadeAudio(lightAmbient, 0);
            fadeAudio(darkAmbient, 0);
        }

        trackAnalytics('sound_toggled', { enabled: soundEnabled });
    });
}


// Apply initial theme from storage
themePreference = resolveThemePreference();
applyTheme(resolveEffectiveTheme(themePreference), { animate: false });

// --- NEW: Expand/Collapse Popup Logic ---
function togglePopupExpand(button) {
    const container = button.previousElementSibling;
    const isExpanded = container.classList.contains('expanded');

    if (isExpanded) {
        container.classList.remove('expanded');
        button.textContent = 'Read More';
    } else {
        container.classList.add('expanded');
        button.textContent = 'Read Less';
    }
}

function updateCoordinates(e) {
    if (coordsLocked) return;
    if (!currentLatLonBounds || !currentBounds) return;

    const mapWidth = currentBounds[1][1];
    const mapHeight = currentBounds[1][0];
    const { north, south, east, west } = currentLatLonBounds;

    const lon = west + (e.latlng.lng / mapWidth) * (east - west);
    const lat = south + (e.latlng.lat / mapHeight) * (north - south);
    lockedCoords = { lat, lon };
    updateCoordinateDisplay(lat, lon);
}

// --- Map Click Handler ---
map.on('click', function (e) {
    if (!isMeasuring && currentBounds) {
        unlockAdvancedControls('map_click');
    }
});
map.on('dblclick', function (e) {
    coordsLocked = !coordsLocked;
    if (coordsLocked) {
        updateCoordinates(e); // one last update to lock in the current coords
    }
    // Hide filter panel if clicking outside
    if (filtersPanelVisible && !poiFilterContainer.contains(e.originalEvent.target) && e.originalEvent.target !== toggleFiltersBtn && !toggleFiltersBtn.contains(e.originalEvent.target)) {
        toggleFilterPanel();
    }
    // Hide search results if clicking outside
    if (searchResultsContainer.style.display === 'block' && !searchResultsContainer.contains(e.originalEvent.target) && e.originalEvent.target !== poiSearchInput) {
        searchResultsContainer.style.display = 'none';
    }
    // Measurement logic handled separately
    // --- Hide Blurb on Map Click ---
    if (mapBlurbElement.classList.contains('visible')) {
        mapBlurbElement.classList.remove('visible');
        toggleBlurbBtn.classList.remove('active');
    }
});

// --- Blurb Element Click Stop ---
mapBlurbElement.addEventListener('click', (e) => e.stopPropagation());

// --- Coordinate Toggle Button Logic ---
if (toggleCoordsBtn) {
    toggleCoordsBtn.addEventListener('click', function () {
        unlockAdvancedControls('coords_toggle');
        if (toggleCoordsBtn.style.display === 'none') return;
        setCoordsDisplayVisible(!coordsDisplayEnabled);
    });
}

// --- Handle Hash Changes / Back/Forward Navigation ---
window.addEventListener('popstate', (event) => {
    const { mapId: hashMpId, sidebarState: hashSidebarState } = parseHash(); // Re-parse hash
    const targetMapId = getHistoryStateValue(event.state, 'mapId', hashMpId);
    const targetSidebarState = getHistoryStateValue(event.state, 'sidebarState', hashSidebarState);


    if (targetMapId !== currentlyLoadedMapId) {
        loadMap(targetMapId || '', false); // Load map without pushing new state
    }
    if (targetSidebarState && targetSidebarState !== currentSidebarState) {
        setSidebarState(targetSidebarState, false); // Set sidebar without updating hash
    }
    syncSidebarBackdropState();
});
window.addEventListener('beforeunload', () => {
    if (loadingProgressInterval) clearInterval(loadingProgressInterval);
    trackAnalytics('session_end', {
        durationMs: Date.now() - sessionStartedAt,
        mobile: window.innerWidth <= 768
    });
});


// --- Custom Zoom Control Logic ---
const customZoomInBtn = document.getElementById('custom-zoom-in');
const customZoomOutBtn = document.getElementById('custom-zoom-out');

if (customZoomInBtn) {
    customZoomInBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        unlockAdvancedControls('zoom_in');
        map.zoomIn();
    });
}

if (customZoomOutBtn) {
    customZoomOutBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        unlockAdvancedControls('zoom_out');
        map.zoomOut();
    });
}

// --- Marker Toggle Button Logic ---
toggleMarkersBtn.addEventListener('click', () => {
    unlockAdvancedControls('markers_toggle');
    markersVisible = !markersVisible;
    regionsVisible = markersVisible; // Sync regions with markers

    toggleMarkersBtn.title = markersVisible ? "Hide Markers & Regions" : "Show Markers & Regions";
    toggleMarkersBtn.setAttribute('aria-label', markersVisible ? "Hide Markers & Regions" : "Show Markers & Regions");
    toggleMarkersBtn.classList.toggle('markers-hidden', !markersVisible);

    updateVisibleRegions(); // Update regions visibility
    updateVisibleMarkersAndSearch(); // Update marker visibility

    trackAnalytics('markers_toggled', { visible: markersVisible });
});
// --- Blurb Toggle Button Logic ---
toggleBlurbBtn.addEventListener('click', (e) => {
    unlockAdvancedControls('blurb_toggle');
    e.stopPropagation(); // Prevent map click event
    mapBlurbElement.classList.toggle('visible');
    toggleBlurbBtn.classList.toggle('active');
    toggleBlurbBtn.setAttribute('aria-expanded', mapBlurbElement.classList.contains('visible'));
    trackAnalytics('map_blurb_toggled', { visible: mapBlurbElement.classList.contains('visible') });
});

// --- Filter Panel Toggle Logic ---
function toggleFilterPanel() {
    unlockAdvancedControls('filter_toggle');
    filtersPanelVisible = !filtersPanelVisible;
    poiFilterContainer.classList.toggle('visible', filtersPanelVisible);
    toggleFiltersBtn.classList.toggle('active', filtersPanelVisible);
    toggleFiltersBtn.title = filtersPanelVisible ? "Hide Filters" : "Show Filters";
    toggleFiltersBtn.setAttribute('aria-label', filtersPanelVisible ? "Hide Filters" : "Show Filters");
    toggleFiltersBtn.setAttribute('aria-expanded', filtersPanelVisible);
    safeSetStorage(UX_STORAGE_KEYS.filterPanelOpen, String(filtersPanelVisible));
    if (filtersPanelVisible) {
        positionFilterPanel();
    }
    updateActiveFilterChips();
    trackAnalytics('filter_panel_toggled', { visible: filtersPanelVisible });
}
toggleFiltersBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleFilterPanel();
});

// --- Search Input Logic ---
const debouncedUpdateVisibleMarkersAndSearch = debounce(updateVisibleMarkersAndSearch, 300);
poiSearchInput.addEventListener('input', debouncedUpdateVisibleMarkersAndSearch);
poiSearchInput.addEventListener('focus', () => {
    unlockAdvancedControls('search_focus');
});
poiSearchInput.addEventListener('click', (e) => e.stopPropagation());
searchResultsContainer.addEventListener('click', (e) => e.stopPropagation());
if (activeFiltersContainer) {
    activeFiltersContainer.addEventListener('click', (e) => e.stopPropagation());
}

// --- Update line visibility based on filters ---
function updateVisibleLines() {
    if (!currentRoadGroup) return;

    const typeFilters = poiFilterContainer.querySelectorAll('.line-type-filter:checked');
    const typeFilterValues = Array.from(typeFilters).map(cb => cb.value);
    const allTypesChecked = filterToggleAllCheckbox.checked && !filterToggleAllCheckbox.indeterminate;

    currentRoadGroup.eachLayer(layer => {
        const road = layer.roadData;
        if (!road) return;

        const roadType = road.type || "Unnamed Road Type"; // Match the logic in populateFilters
        const typeMatch = allTypesChecked || typeFilterValues.includes(roadType);

        // Lines are always "visible" in terms of the master toggle (markersVisible)
        // Their appearance is solely based on type filters.
        if (typeMatch) {
            layer.setStyle({
                opacity: layer.originalOpacity === undefined ? 0.8 : layer.originalOpacity // Restore original or default
            });
        } else {
            layer.setStyle({
                opacity: 0 // Hide
            });
        }
    });
}

// --- Combined Filter Panel Logic ---
poiFilterContainer.addEventListener('change', (e) => {
    const target = e.target;
    if (target.type !== 'checkbox') return;

    // Handle parent group checkbox for regions
    if (target.classList.contains('region-group-filter')) {
        const isChecked = target.checked;
        const groupName = target.value;
        const nestedCheckboxes = target.closest('.filter-group').querySelectorAll('.region-type-filter');
        nestedCheckboxes.forEach(checkbox => {
            if (checkbox.dataset.group === groupName) {
                checkbox.checked = isChecked;
            }
        });
    }

    // Handle master "Show All / Hide All" checkbox
    if (target.id === 'filter-toggle-all') {
        const isChecked = target.checked;
        poiFilterContainer.querySelectorAll('.poi-filter-checkbox, .region-group-filter, .region-type-filter, .line-type-filter').forEach(checkbox => {
            if (checkbox.id !== 'filter-toggle-all') {
                checkbox.checked = isChecked;
            }
        });
        filterToggleAllCheckbox.indeterminate = false;
    }

    // Update parent and master toggles' indeterminate states
    updateToggleAllCheckboxState();

    // Trigger visibility updates
    if (target.classList.contains('poi-filter-checkbox') || target.id === 'filter-toggle-all') {
        updateVisibleMarkersAndSearch();
    }
    if (target.classList.contains('region-type-filter') || target.classList.contains('region-group-filter') || target.id === 'filter-toggle-all') {
        updateVisibleRegions();
    }
    if (target.classList.contains('line-type-filter') || target.id === 'filter-toggle-all') {
        updateVisibleLines();
    }

    updateActiveFilterChips();
    trackAnalytics('filter_changed', {
        filterId: target.id || null,
        checked: target.checked
    });
});
// Prevent map click when clicking inside filter panel
poiFilterContainer.addEventListener('click', (e) => {
    const header = e.target.closest('.filter-group-header');
    if (header) {
        const group = header.closest('.filter-group');
        if (group) {
            group.classList.toggle('closed');
        }
    }
    e.stopPropagation();
});


// --- Measurement Tool Logic ---
function handleMeasurementClick(e) {
    if (!isMeasuring || !currentlyLoadedMapId) return;
    if (e.originalEvent.target.closest('.leaflet-control')) return; // Ignore clicks on controls

    const clickPoint = e.latlng;
    const currentMapInfo = findMapRecursive(mapData, currentlyLoadedMapId);
    const scalePx = currentMapInfo?.scalePixels;
    const scaleKm = currentMapInfo?.scaleKilometers;
    const hasValidScale = typeof scalePx === 'number' && scalePx > 0 &&
        typeof scaleKm === 'number' && scaleKm > 0;

    measurementLayerGroup.eachLayer(layer => {
        if (layer instanceof L.Polyline || (layer.options && layer.options.isEndPoint)) {
            measurementLayerGroup.removeLayer(layer);
        }
    });

    if (!measurementStartPoint) {
        measurementStartPoint = clickPoint;
        L.circleMarker(measurementStartPoint, {
            radius: 5, color: 'red', fillColor: '#f03', fillOpacity: 0.8, interactive: false
        }).addTo(measurementLayerGroup)
            .bindTooltip("Start point. Click second point.", { permanent: false, direction: 'top', className: 'measure-tooltip', offset: L.point(0, -5) })
            .openTooltip();
    } else {
        const endPoint = clickPoint;
        const pixelDistance = map.distance(measurementStartPoint, endPoint);
        let distanceString = ""; // Will be constructed based on scale availability
        let kmDistance = null;   // Will store distance in the map's defined units (e.g., km)
        let tooltipContent = '';

        // These lines should already be present just before this 'else' block,
        // but ensure they are correctly fetching scale info for the current map.
        // const currentMapInfo = findMapRecursive(mapData, currentlyLoadedMapId);
        // const scalePx = currentMapInfo?.scalePixels;
        // const scaleKm = currentMapInfo?.scaleKilometers; // Represents the unit value for scale, e.g., km, miles
        // const hasValidScale = typeof scalePx === 'number' && scalePx > 0 &&
        //                         typeof scaleKm === 'number' && scaleKm > 0;

        if (hasValidScale) {
            kmDistance = (pixelDistance / scalePx) * scaleKm;
            // The unit (e.g., "km") is assumed from your JSON's "scaleKilometers" field.
            // If your "scaleKilometers" field actually represents miles, you can change "km" to "miles" here.
            distanceString = `${kmDistance.toFixed(2)} ${currentMapInfo.scaleUnitName || 'units'}`; // Assuming you might add a 'scaleUnitName' to your map JSON, otherwise defaults to 'units'

            // --- ADJUST THESE PACE VALUES FOR YOUR GAME ---
            const normalPaceUnitsPerDay = 25; // e.g., 25 km per day or 25 miles per day
            const fastPaceUnitsPerDay = 40;   // e.g., 40 km per day or 40 miles per day
            // ---

            let daysNormalPace = (kmDistance / normalPaceUnitsPerDay).toFixed(1);
            let daysFastPace = (kmDistance / fastPaceUnitsPerDay).toFixed(1);

            tooltipContent = `Distance: ${distanceString}<br>Normal Pace: ${daysNormalPace} Day(s)<br>Fast Pace: ${daysFastPace}Day(s)`;
        } else {
            // If no valid scale, distance is in pixels.
            distanceString = `${pixelDistance.toFixed(0)} pixels (Scale unknown)`;
            tooltipContent = `Distance: ${distanceString}<br>Days at Normal Pace: N/A (scale unknown)<br>Days at Fast Pace: N/A (scale unknown)`;
        }

        L.circleMarker(endPoint, {
            radius: 5, color: 'blue', fillColor: '#30f', fillOpacity: 0.8, interactive: false, isEndPoint: true
        }).addTo(measurementLayerGroup);

        L.polyline([measurementStartPoint, endPoint], {
            color: 'yellow', weight: 2, dashArray: '5, 5', interactive: false
        }).addTo(measurementLayerGroup)
            .bindTooltip(tooltipContent, { permanent: true, direction: 'center', className: 'measure-tooltip' })
            .openTooltip();

        measurementStartPoint = null; // Reset
    }
}

function toggleMeasurementTool() {
    isMeasuringMultiPoint = !isMeasuringMultiPoint; // Use the new state variable
    measureToolBtn.classList.toggle('active', isMeasuringMultiPoint);
    measureToolBtn.setAttribute('aria-pressed', isMeasuringMultiPoint);
    mapElement.classList.toggle('measuring-cursor', isMeasuringMultiPoint);

    if (isMeasuringMultiPoint) {
        measureToolBtn.title = "Measuring Path... Click to add points. Double-click or Esc to finish.";
        map.on('click', handleMultiPointMeasureClick);
        map.on('mousemove', handleMultiPointMouseMove);
        map.on('dblclick', finalizeMultiPointMeasure); // Add dblclick listener
        document.addEventListener('keydown', handleMeasureKeyDown); // For Esc key

        // Clear previous measurement layers (if any)
        measurementLayerGroup.clearLayers();
        multiPointPath = [];
        multiPointVertexMarkers = [];
        if (multiPointPolyline) map.removeLayer(multiPointPolyline);
        multiPointPolyline = null;
        if (multiPointTotalTooltip) map.removeLayer(multiPointTotalTooltip);
        multiPointTotalTooltip = null;
        // Clear other related layers/tooltips if you add them

        if (filtersPanelVisible) toggleFilterPanel();
    } else {
        measureToolBtn.title = "Measure Distance";
        finalizeMultiPointMeasure(false); // Clean up without making permanent
    }

    trackAnalytics('measurement_toggled', { enabled: isMeasuringMultiPoint });
}

function handleMultiPointMeasureClick(e) {
    if (!isMeasuringMultiPoint || !currentlyLoadedMapId) return;
    if (e.originalEvent.target.closest('.leaflet-control')) return;

    const clickPoint = e.latlng;
    multiPointPath.push(clickPoint);

    // Add a vertex marker
    const vertexMarker = L.circleMarker(clickPoint, {
        radius: 5,
        color: 'cyan', // Or your preferred color
        fillColor: '#0ff',
        fillOpacity: 0.7,
        interactive: false
    }).addTo(measurementLayerGroup);
    multiPointVertexMarkers.push(vertexMarker);

    // Update the polyline
    if (multiPointPolyline) {
        multiPointPolyline.setLatLngs(multiPointPath);
    } else if (multiPointPath.length >= 2) {
        multiPointPolyline = L.polyline(multiPointPath, {
            color: 'yellow',
            weight: 3,
            dashArray: '5, 5',
            interactive: false
        }).addTo(measurementLayerGroup);
    }

    updateMeasurementTooltips(); // New function to handle tooltips
}

function handleMultiPointMouseMove(e) {
    if (!isMeasuringMultiPoint || multiPointPath.length === 0 || !currentlyLoadedMapId) return;

    const currentMapInfo = findMapRecursive(mapData, currentlyLoadedMapId);
    const scalePx = currentMapInfo?.scalePixels;
    const scaleKm = currentMapInfo?.scaleKilometers;

    const lastFixedPoint = multiPointPath[multiPointPath.length - 1];
    const currentMousePos = e.latlng;

    if (temporaryMouseMoveLine) {
        measurementLayerGroup.removeLayer(temporaryMouseMoveLine);
    }
    temporaryMouseMoveLine = L.polyline([lastFixedPoint, currentMousePos], {
        color: 'lime',
        weight: 2,
        dashArray: '3, 3',
        interactive: false
    }).addTo(measurementLayerGroup);

    if (temporaryMouseMoveTooltip) {
        map.removeLayer(temporaryMouseMoveTooltip); // Or measurementLayerGroup.removeLayer
    }

    const pixelDistance = map.distance(lastFixedPoint, currentMousePos);
    let segmentDistanceString = `${pixelDistance.toFixed(0)} px`;
    if (scalePx && scaleKm) {
        const kmDistance = (pixelDistance / scalePx) * scaleKm;
        segmentDistanceString = `${kmDistance.toFixed(2)} km`;
    }

    temporaryMouseMoveTooltip = L.tooltip({
        permanent: true,
        direction: 'top',
        className: 'measure-tooltip',
        offset: L.point(0, -10)
    })
        .setLatLng(currentMousePos)
        .setContent(`Segment: ${segmentDistanceString}`)
        .addTo(map); // Add to map to follow mouse, or to measurementLayerGroup
}

function updateMeasurementTooltips() {
    // Ensure the function doesn't run if not measuring or no path exists
    if (!currentlyLoadedMapId || multiPointPath.length < 1) {
        // Clean up any leftover tooltip if the path becomes empty
        if (multiPointTotalTooltip) {
            map.removeLayer(multiPointTotalTooltip);
            multiPointTotalTooltip = null;
        }
        return;
    }

    // Get map scale information
    const currentMapInfo = findMapRecursive(mapData, currentlyLoadedMapId);
    const scalePx = currentMapInfo?.scalePixels;
    // Assuming scaleKilometers in JSON truly represents kilometers for this calculation
    const scaleKmValue = currentMapInfo?.scaleKilometers;
    // Use 'km' as the unit name if scaleUnitName is not set or is generic,
    // but prefer scaleUnitName if it's specific (e.g. "miles" and you adjusted paces accordingly)
    const scaleUnitName = (currentMapInfo?.scaleUnitName && currentMapInfo.scaleUnitName !== 'units') ? currentMapInfo.scaleUnitName : 'km';

    const hasValidScale = typeof scalePx === 'number' && scalePx > 0 &&
        typeof scaleKmValue === 'number' && scaleKmValue > 0;

    // Calculate total pixel distance
    let totalPixelDistance = 0;
    if (multiPointPath.length >= 2) {
        for (let i = 0; i < multiPointPath.length - 1; i++) {
            totalPixelDistance += map.distance(multiPointPath[i], multiPointPath[i + 1]);
        }
    }

    // --- Build the Tooltip Content String ---
    let tooltipContent = '';
    let displayDistanceString = '';

    if (hasValidScale) {
        // Calculate distance in kilometers (or the unit defined by scaleKmValue)
        const totalDistanceInKm = (totalPixelDistance / scalePx) * scaleKmValue;
        lastMeasuredDistanceKm = totalDistanceInKm;
        displayDistanceString = `${totalDistanceInKm.toFixed(2)} ${scaleUnitName}`;

        // --- Updated Pace Values in Kilometers per Day ---
        const fastPaceKmPerDay = 48.28;
        const normalPaceKmPerDay = 38.62;
        const slowPaceKmPerDay = 28.97;
        // ---

        // Calculate days for each pace
        const daysFastPace = (totalDistanceInKm / fastPaceKmPerDay).toFixed(1);
        const daysNormalPace = (totalDistanceInKm / normalPaceKmPerDay).toFixed(1);
        const daysSlowPace = (totalDistanceInKm / slowPaceKmPerDay).toFixed(1);

        // Construct the multi-line tooltip content
        tooltipContent = `Total ≈ ${displayDistanceString}<br>Fast ≈ ${daysFastPace} Day(s)<br>Normal ≈ ${daysNormalPace} Day(s)<br>Slow ≈ ${daysSlowPace} Day(s)`;

    } else {
        // Scale is unknown or distance is zero
        if (totalPixelDistance > 0) {
            displayDistanceString = `${totalPixelDistance.toFixed(0)} pixels (Scale unknown)`;
            tooltipContent = `Total: ${displayDistanceString}<br>Days at Fast Pace: N/A<br>Days at Normal Pace: N/A<br>Days at Slow Pace: N/A`;
        } else if (multiPointPath.length === 1) {
            displayDistanceString = "Start point";
            tooltipContent = displayDistanceString; // Only show "Start point"
        } else {
            displayDistanceString = "0 pixels";
            tooltipContent = `Total: ${displayDistanceString}<br>Days at Fast Pace: N/A<br>Days at Normal Pace: N/A<br>Days at Slow Pace: N/A`;
        }
    }
    // --- Tooltip Content String is now built ---

    // Remove the previous total tooltip (if it exists)
    if (multiPointTotalTooltip) {
        map.removeLayer(multiPointTotalTooltip);
    }

    // Create and add the new total tooltip using the constructed content
    if (multiPointPath.length > 0) {
        multiPointTotalTooltip = L.tooltip({
            permanent: true,
            direction: 'right',
            className: 'measure-tooltip',
            offset: L.point(10, 0) // Position offset from the point
        })
            .setLatLng(multiPointPath[multiPointPath.length - 1]) // Position at the last point
            .setContent(tooltipContent) // Use the full tooltipContent string
            .addTo(map);
    } else {
        multiPointTotalTooltip = null; // Ensure it's null if path is empty
    }
}

function finalizeMultiPointMeasure(makePermanent = true) {
    if (!isMeasuringMultiPoint && !makePermanent) { // If called to just clean up
        measurementLayerGroup.clearLayers();
        if (multiPointPolyline) map.removeLayer(multiPointPolyline);
        if (multiPointTotalTooltip) map.removeLayer(multiPointTotalTooltip);
        if (temporaryMouseMoveLine) measurementLayerGroup.removeLayer(temporaryMouseMoveLine);
        if (temporaryMouseMoveTooltip) map.removeLayer(temporaryMouseMoveTooltip);
        multiPointPath = [];
        multiPointVertexMarkers = [];
        multiPointPolyline = null;
        multiPointTotalTooltip = null;
        temporaryMouseMoveLine = null;
        temporaryMouseMoveTooltip = null;
    }

    isMeasuringMultiPoint = false;
    map.off('click', handleMultiPointMeasureClick);
    map.off('mousemove', handleMultiPointMouseMove);
    map.off('dblclick', finalizeMultiPointMeasure);
    document.removeEventListener('keydown', handleMeasureKeyDown);
    mapElement.classList.remove('measuring-cursor');
    measureToolBtn.classList.remove('active');
    measureToolBtn.title = "Measure Distance";


    if (temporaryMouseMoveLine) {
        measurementLayerGroup.removeLayer(temporaryMouseMoveLine);
        temporaryMouseMoveLine = null;
    }
    if (temporaryMouseMoveTooltip) {
        map.removeLayer(temporaryMouseMoveTooltip);
        temporaryMouseMoveTooltip = null;
    }

    if (!makePermanent || multiPointPath.length < 2) {
        measurementLayerGroup.clearLayers();
        if (multiPointPolyline) map.removeLayer(multiPointPolyline);
        multiPointPolyline = null;
        if (multiPointTotalTooltip) map.removeLayer(multiPointTotalTooltip);
        multiPointTotalTooltip = null;
        multiPointPath = [];
        multiPointVertexMarkers = [];
    } else {
        // Path and markers are already on measurementLayerGroup.
        // Make the total tooltip permanent on the polyline itself.
        if (multiPointPolyline && multiPointTotalTooltip) {
            // The multiPointTotalTooltip already has the full content
            // from the last call to updateMeasurementTooltips.
            // We just need to re-bind it or ensure it stays.
            // For simplicity, let's ensure it uses the latest content if it was removed and re-added.
            const finalContent = multiPointTotalTooltip.getContent(); // Get the already formatted content
            map.removeLayer(multiPointTotalTooltip); // Remove the one that was following the mouse

            multiPointPolyline.bindTooltip(finalContent, { // Use the captured finalContent
                permanent: true,
                direction: 'center',
                className: 'measure-tooltip',
                sticky: true // Make it sticky to the line
            }).openTooltip();
            // Ensure the individual vertex markers are cleared if they are not desired permanently
            multiPointVertexMarkers.forEach(marker => measurementLayerGroup.removeLayer(marker));
            multiPointVertexMarkers = [];
        }
    }
}

function handleMeasureKeyDown(e) {
    if (e.key === 'Escape' && isMeasuringMultiPoint) {
        e.preventDefault();
        finalizeMultiPointMeasure(false); // Cancel measurement
    }
}

measureToolBtn.addEventListener('click', (e) => {
    unlockAdvancedControls('measure_toggle');
    e.stopPropagation();
    toggleMeasurementTool(); // This should now call the multi-point version
});

// --- Inject Map Icon CSS ---
// REMOVED: Icons are now inline SVGs.

// --- NEW: Data Loading Functions ---
async function loadMapData() {
    try {
        // Show loading indicator for data fetch
        if (loadingIndicator) {
            loadingIndicator.style.display = 'flex';
            loadingIndicator.classList.add('initial-loader');
            const progressBar = loadingIndicator.querySelector('.progress-bar');
            if (progressBar) progressBar.style.width = '10%'; // Initial progress
            setLoadingMessage('Loading map index...', {
                showSpinner: true,
                showProgress: true,
                showRetry: false
            });
        }

        const response = await fetch(withAssetVersion('maps/maps.json'));
        if (!response.ok) throw new Error(`Failed to load maps.json: ${response.statusText}`);
        const maps = await response.json();

        if (loadingIndicator && loadingIndicator.querySelector('.progress-bar')) {
            loadingIndicator.querySelector('.progress-bar').style.width = '30%';
            setLoadingMessage('Processing map data...', {
                showSpinner: true,
                showProgress: true,
                showRetry: false
            });
        }

        // Process map data (fetch children, etc.)
        mapData = await processMapData(maps);

        if (loadingIndicator && loadingIndicator.querySelector('.progress-bar')) {
            loadingIndicator.querySelector('.progress-bar').style.width = '100%';
        }

        // --- Keyboard Shortcut & Modal Logic ---
        const aboutModal = document.getElementById('about-modal');
        const closeAboutModalBtn = document.getElementById('close-about-modal-btn');
        const helpBtn = document.getElementById('help-btn');
        const aboutLink = document.getElementById('about-link');
        const tabBtns = document.querySelectorAll('.tab-btn');
        const tabContents = document.querySelectorAll('.tab-content');
        let lastFocus = null;

        function toggleAboutModal(show, tabName = 'guide', source = 'manual') {
            if (!aboutModal) return;

            if (show) {
                lastFocus = document.activeElement; // Save focus
                aboutModal.style.display = 'flex';
                // Small delay to allow display:flex to apply before adding visible class for transition
                requestAnimationFrame(() => {
                    aboutModal.classList.add('visible');
                    // Focus management: Focus the active tab or first tab
                    const focusTarget = aboutModal.querySelector('.tab-btn.active') || aboutModal.querySelector('.tab-btn') || closeAboutModalBtn;
                    if (focusTarget) focusTarget.focus();
                });
                if (tabName) switchTab(tabName);
                if (source !== 'onboarding_auto') {
                    unlockAdvancedControls('help_open');
                }
                trackAnalytics('help_opened', { tab: tabName, source });
            } else {
                aboutModal.classList.remove('visible');
                setTimeout(() => {
                    aboutModal.style.display = 'none';
                    if (lastFocus) lastFocus.focus(); // Restore focus
                }, 300); // Match transition duration
            }
        }

        // Trap focus inside modal
        if (aboutModal) {
            aboutModal.addEventListener('keydown', function(e) {
                if (e.key === 'Tab') {
                    const focusableContent = aboutModal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
                    const first = focusableContent[0];
                    const last = focusableContent[focusableContent.length - 1];

                    if (e.shiftKey) { // Shift + Tab
                        if (document.activeElement === first) {
                            last.focus();
                            e.preventDefault();
                        }
                    } else { // Tab
                        if (document.activeElement === last) {
                            first.focus();
                            e.preventDefault();
                        }
                    }
                }
            });
        }

        openAboutModal = (tabName = 'guide', source = 'manual') => toggleAboutModal(true, tabName, source);
        closeAboutModal = () => toggleAboutModal(false);
        isAboutModalVisible = () => !!aboutModal && aboutModal.classList.contains('visible');

        function switchTab(tabName) {
            tabBtns.forEach(btn => {
                if (btn.dataset.tab === tabName) btn.classList.add('active');
                else btn.classList.remove('active');
            });
            tabContents.forEach(content => {
                if (content.id === `tab-${tabName}`) content.classList.add('active');
                else content.classList.remove('active');
            });
        }

        // Event Listeners for Modal
        if (closeAboutModalBtn) {
            closeAboutModalBtn.addEventListener('click', () => toggleAboutModal(false));
        }

        if (aboutModal) {
            aboutModal.addEventListener('click', (e) => {
                if (e.target === aboutModal) toggleAboutModal(false);
            });
        }

        if (helpBtn) {
            helpBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                toggleAboutModal(true, 'guide', 'help_button');
            });
        }

        if (aboutLink) {
            aboutLink.addEventListener('click', (e) => {
                e.preventDefault();
                toggleAboutModal(true, 'lore', 'about_link');
            });
        }

        tabBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                switchTab(btn.dataset.tab);
            });
        });

        if (onboardingOpenHelpBtn) {
            onboardingOpenHelpBtn.addEventListener('click', () => {
                safeSetStorage(UX_STORAGE_KEYS.onboardingSeen, 'true');
                unlockAdvancedControls('onboarding_open_guide');
                setOnboardingVisibility(false);
                if (openAboutModal) openAboutModal('guide', 'onboarding_card');
            });
        }

        if (onboardingDismissBtn) {
            onboardingDismissBtn.addEventListener('click', () => {
                safeSetStorage(UX_STORAGE_KEYS.onboardingSeen, 'true');
                setOnboardingVisibility(false);
                trackAnalytics('onboarding_dismissed');
            });
        }

        function isInputFocused() {
            const activeElement = document.activeElement;
            return activeElement && (activeElement.tagName === 'INPUT' ||
                activeElement.tagName === 'TEXTAREA' ||
                activeElement.isContentEditable);
        }

        document.addEventListener('keydown', function (e) {
            // Handle modal display first
            if (e.key === '?') {
                if (!isInputFocused()) { // Don't trigger if typing '?' in search
                    e.preventDefault();
                    if (aboutModal) {
                        const isVisible = aboutModal.classList.contains('visible');
                        if (isVisible) toggleAboutModal(false, 'guide', 'shortcut');
                        else toggleAboutModal(true, 'guide', 'shortcut');
                    }
                    return;
                }
            }

            // If help modal is open, Esc should close it
            if (aboutModal && aboutModal.classList.contains('visible') && e.key === 'Escape') {
                e.preventDefault();
                toggleAboutModal(false);
                return;
            }

            // Handle Escape for other UI elements
            if (e.key === 'Escape') {
                if (map.getPanes().popupPane.firstChild) { // Check if a Leaflet popup is open
                    map.closePopup();
                    e.preventDefault();
                } else if (filtersPanelVisible) {
                    toggleFilterPanel(); // Your existing function
                    e.preventDefault();
                } else if (searchResultsContainer.style.display === 'block') {
                    searchResultsContainer.style.display = 'none';
                    if (poiSearchInput) poiSearchInput.blur();
                    e.preventDefault();
                } else if (isMeasuringMultiPoint) { // For the new measurement tool
                    finalizeMultiPointMeasure(false); // Cancel measurement
                    e.preventDefault();
                }
                // Add other Escape handlers here if needed
                return; // Processed Escape, no further checks for this key press
            }

            // For other shortcuts, don't act if an input is focused or help modal is open
            if (isInputFocused() || (aboutModal && aboutModal.classList.contains('visible'))) {
                return;
            }

            // Non-input-focused shortcuts
            switch (e.key.toLowerCase()) {
                case '+':
                case '=':
                    if (map) map.zoomIn();
                    e.preventDefault();
                    break;
                case '-':
                    if (map) map.zoomOut();
                    e.preventDefault();
                    break;
                case 's':
                    if (toggleBtn) toggleBtn.click(); // Toggle Sidebar
                    e.preventDefault();
                    break;
                case 't':
                    if (themeToggle) themeToggle.click(); // Toggle Theme
                    e.preventDefault();
                    break;
                case 'm':
                    if (measureToolBtn && measureToolBtn.style.display !== 'none') {
                        measureToolBtn.click();
                        e.preventDefault();
                    }
                    break;
                case 'h': // Toggle Markers/Regions
                    if (toggleMarkersBtn && toggleMarkersBtn.style.display !== 'none') {
                        toggleMarkersBtn.click();
                        e.preventDefault();
                    }
                    break;
                case 'f': // Toggle Filters Panel
                    if (toggleFiltersBtn && toggleFiltersBtn.style.display !== 'none') {
                        toggleFiltersBtn.click();
                        e.preventDefault();
                    }
                    break;
                case '/':
                    if (searchControlContainer && searchControlContainer.style.display !== 'none' && poiSearchInput) {
                        poiSearchInput.focus();
                        e.preventDefault();
                    }
                    break;
            }

            // Example for Ctrl/Cmd + F (if you want to override browser find for your search)
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
                if (searchControlContainer && searchControlContainer.style.display !== 'none' && poiSearchInput) {
                    poiSearchInput.focus();
                    e.preventDefault(); // Prevent browser's default find
                }
            }
        });


        // Now that data is loaded, initialize the application
        initializeApp();

    } catch (error) {
        console.error('Error loading map data:', error);
        if (loadingIndicator) {
            setLoadingMessage(
                'Error loading map index. Check your connection and press Retry.',
                { showSpinner: false, showProgress: false, showRetry: true }
            );
        }
        // Optionally display an error message to the user in the UI
        sidebar.innerHTML = '<h2>Error</h2><p>Could not load map data. Please try refreshing the page or check the console for details.</p>';
        trackAnalytics('map_index_load_failed', { reason: error?.message || 'unknown' });
    }
}

// --- NEW Recursive Helper Function ---
async function processChild(childId, level = 0) {
    // Base case for recursion depth limit or invalid ID
    if (level > 5 || !childId || typeof childId !== 'string') {
        // console.warn(`Skipping child processing for: ${childId} at level ${level}`);
        // Return a placeholder that populateSidebar can handle as coming soon/error
        return { id: childId, name: String(childId || 'Invalid Child'), status: 'coming-soon', error: true };
    }

    try {
        // Optional: Handle known 'coming-soon' IDs directly if needed
        // if (childId === 'some-known-coming-soon-id') {
        //     return { id: childId, name: 'Known Coming Soon Item', status: 'coming-soon' };
        // }

        // Fetch the child map data
        const response = await fetch(withAssetVersion(`maps/${childId}.json`));

        if (response.ok) {
            let childData = await response.json();

            // *** RECURSIVE STEP ***
            // Check if the fetched child ALSO has children that are string IDs
            if (childData.children && Array.isArray(childData.children) && childData.children.length > 0 && typeof childData.children[0] === 'string') {
                const subChildIds = childData.children;
                childData.children = []; // Prepare for processed sub-children
                const subChildPromises = subChildIds.map(subId => processChild(subId, level + 1)); // Recursive call
                childData.children = await Promise.all(subChildPromises);
            }
            // *** END RECURSIVE STEP ***

            // Ensure basic properties exist if fetched data is incomplete
            childData.id = childData.id || childId;
            childData.name = childData.name || childId; // Use ID as fallback name

            return childData; // Return the processed child data

        } else if (response.status === 404) {
            console.warn(`Child map file not found: maps/${childId}.json - Marking as 'coming-soon'`);
            // File not found, treat as coming soon
            return { id: childId, name: childId, status: 'coming-soon', error: 'not found' };
        } else {
            console.warn(`Failed to load child map: ${childId} (${response.statusText}) - Marking as 'coming-soon'`);
            // Other fetch error, treat as coming soon
            return { id: childId, name: childId, status: 'coming-soon', error: `Workspace failed (${response.status})` };
        }
    } catch (error) {
        console.error(`Error processing child ${childId}:`, error);
        // Error during fetch/parse, treat as coming soon
        return { id: childId, name: childId, status: 'coming-soon', error: error.message };
    }
}
async function processMapData(maps) {
    const processedMaps = [];

    for (let map of maps) {
        if (map.children && Array.isArray(map.children) && map.children.length > 0 && typeof map.children[0] === 'string') {
            const childIds = map.children;
            map.children = [];
            const childPromises = childIds.map(childId => processChild(childId, 1));
            map.children = await Promise.all(childPromises);
        }
        processedMaps.push(map);
    }
    return processedMaps;
}

function initializeApp() {
    const urlParams = getUrlParameters();
    isEmbeddedView = urlParams.embed === 'true' || urlParams.hideUI === 'true';
    if (advancedControlsUnlocked) {
        safeSetStorage(UX_STORAGE_KEYS.advancedControlsUnlocked, 'true');
    }
    initializeGMVisibility();
    setPanelCollapsed(
        routePanel,
        routeCollapseBtn,
        safeGetStorage(UX_STORAGE_KEYS.routePanelCollapsed) === 'true',
        null
    );
    setPanelCollapsed(
        sessionToolkitPanel,
        toolkitCollapseBtn,
        safeGetStorage(UX_STORAGE_KEYS.toolkitPanelCollapsed) === 'true',
        null
    );
    updatePanelToggleButtons();

    // Handle embedded view - hide UI elements
    if (isEmbeddedView) {
        const wipPopup = document.getElementById('wip-popup');
        if (wipPopup) wipPopup.style.display = 'none';

        const bottomLinkBar = document.getElementById('bottom-link-bar');
        if (bottomLinkBar) bottomLinkBar.style.display = 'none';

        if (toggleBlurbBtn) toggleBlurbBtn.style.display = 'none';
        if (toggleGMPanelBtn) toggleGMPanelBtn.style.display = 'none';
        if (toggleToolkitPanelBtn) toggleToolkitPanelBtn.style.display = 'none';
        if (mapBlurbElement) mapBlurbElement.classList.remove('visible');

        // Hide the sidebar toggle button
        const toggleSidebarBtn = document.getElementById('toggle-sidebar-btn');
        if (toggleSidebarBtn) toggleSidebarBtn.style.display = 'none';

        // Hide the sound toggle button.
        if (toggleSoundBtn) toggleSoundBtn.style.display = 'none';

        // Force sidebar to be collapsed initially
        setSidebarState('c', false);

        // Optional: Add a class to the body for additional styling
        document.body.classList.add('embedded-view');

        if (window.innerWidth <= 600) { // Or your preferred mobile breakpoint
            const wipPopup = document.getElementById('wip-popup');
            if (wipPopup) {
                setTimeout(() => {
                    wipPopup.classList.add('fade-out');
                }, 7000); // 7 seconds delay
            }
        }
    }
    // --- END: Embedding Check ---


    // Populate sidebar now that mapData is ready
    populateSidebar(mapListElement, mapData);
    initializeGMPillDrag();

    // Determine initial map and sidebar state
    const { mapId: initialMapIdFromHash, sidebarState: hashSidebarState } = parseHash();
    const sidebarFromStorage = safeGetStorage(UX_STORAGE_KEYS.sidebarState);
    const hasSidebarInHash = window.location.hash.includes('-s=');
    const initialSidebarState = hasSidebarInHash ? hashSidebarState : (sidebarFromStorage || hashSidebarState);

    let mapIdToLoad = initialMapIdFromHash;
    let mapToLoadData = null;

    const storedMapId = safeGetStorage(UX_STORAGE_KEYS.lastMapId);
    if (!mapIdToLoad && storedMapId) {
        mapIdToLoad = storedMapId;
    }

    // If hash points to a valid map, try to load it
    if (mapIdToLoad) {
        mapToLoadData = findMapRecursive(mapData, mapIdToLoad);
    }

    // If hash/storage target is invalid or non-renderable, fall back to first renderable map
    if (!isRenderableMapEntry(mapToLoadData)) {
        mapIdToLoad = findFirstLoadableIdRecursive(mapData);
        mapToLoadData = findMapRecursive(mapData, mapIdToLoad);
    }


    const effectiveSidebarState = isEmbeddedView ? 'c' : initialSidebarState;
    setSidebarState(effectiveSidebarState, false); // Set sidebar state without updating hash yet

    // Hide controls initially (loadMap will show them if needed)
    toggleMarkersBtn.style.display = 'none';
    toggleFiltersBtn.style.display = 'none';
    measureToolBtn.style.display = 'none';
    // toggleSoundBtn is handled above for embed mode, otherwise shown by initializeSoundState
    searchControlContainer.style.display = 'none';
    searchResultsContainer.style.display = 'none';
    poiFilterContainer.classList.remove('visible');

    // Load the determined map
    if (mapIdToLoad && isRenderableMapEntry(mapToLoadData)) {
        markersVisible = true; // Default to visible
        regionsVisible = true;
        loadMap(mapIdToLoad, false); // Load map, don't update hash yet
    } else {
        console.error("No loadable map data found for initialization.");
        sidebar.innerHTML = '<h2>Select Map</h2><p>No maps available.</p>';
        mapBlurbElement.classList.remove('visible');
        // Ensure loading indicator is hidden if it somehow wasn't
        if (loadingIndicator) loadingIndicator.style.display = 'none';
        // Set a clean hash state
        const fallbackHash = generateHash('', effectiveSidebarState);
        history.replaceState(null, '', buildAppUrlWithHash(fallbackHash, window.location.search));
        isInitializing = false;
        return; // Stop initialization
    }

    // Initialize sound state (after theme is applied)
    // This will now check for embed mode internally
    initializeSoundState();

    // Set the correct initial history state *after* loading the map
    const correctInitialHash = generateHash(currentlyLoadedMapId, currentSidebarState);
    const currentSearch = window.location.search; // Get current search params like ?embed=true
    const finalUrl = buildAppUrlWithHash(correctInitialHash, currentSearch);
    history.replaceState({ mapId: currentlyLoadedMapId, sidebarState: currentSidebarState }, mapToLoadData?.name || '', finalUrl);

    if (!isEmbeddedView) {
        if (advancedControlsUnlocked && safeGetStorage(UX_STORAGE_KEYS.onboardingSeen) !== 'true') {
            safeSetStorage(UX_STORAGE_KEYS.onboardingSeen, 'true');
        }
        const hasSeenOnboarding = safeGetStorage(UX_STORAGE_KEYS.onboardingSeen) === 'true' || advancedControlsUnlocked;
        if (!hasSeenOnboarding) {
            setOnboardingVisibility(true);
            safeSetStorage(UX_STORAGE_KEYS.onboardingSeen, 'true');
            trackAnalytics('onboarding_shown');
            setTimeout(() => {
                if (openAboutModal) openAboutModal('guide', 'onboarding_auto');
            }, 500);
        } else {
            setOnboardingVisibility(false);
        }
    } else {
        setOnboardingVisibility(false);
    }

    syncSidebarBackdropState();
    isInitializing = false;
}

// --- Start the application by loading data ---
loadMapData();
