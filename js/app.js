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
    toolkitPanelVisible: 'toolkitPanelVisible',
    mobileLayoutMode: 'mobileLayoutMode',
    shareRelayDismissedSession: 'shareRelayDismissedSession'
};
let isEmbeddedView = window.__INITIAL_EMBEDDED_VIEW__ === true;
let isInitializing = true;
let advancedControlsUnlocked = false;
let coordsDisplayEnabled = false;
let openAboutModal = null;
let closeAboutModal = null;
let isAboutModalVisible = () => false;
let loadingMapId = null;
let lastTrackedSearchSignature = '';
let atlasSearchIndex = [];
const mapDefinitionCache = new Map();
const mapDefinitionPromiseCache = new Map();
let currentMapData = null;
let loadRequestToken = 0;
const prefetchedJsonUrls = new Set();
const prefetchedImageUrls = new Set();
let prefetchImageQueue = [];
let prefetchImageInFlight = false;
let scheduledPrefetchIdleId = null;
const SEARCH_SCOPE_MAP = 'map';
const SEARCH_SCOPE_ATLAS = 'atlas';
const SEARCH_RESULT_GROUP_ORDER = ['poi', 'region', 'line', 'route', 'step', 'map'];
let currentSearchScope = SEARCH_SCOPE_MAP;
let renderedSearchResults = [];
let activeSearchResultIndex = -1;
const isFirefox = typeof navigator !== 'undefined' && /firefox|fxios/i.test(navigator.userAgent);
const MOBILE_LAYOUT_BREAKPOINT = 768;
const MOBILE_LAYOUT_QUERY_PARAM = 'mobileLayout';
const MOBILE_LAYOUT_MODE_V2 = 'v2';
const MOBILE_LAYOUT_MODE_LEGACY = 'legacy';
const MOBILE_PANEL_MARGIN = 10;

if (typeof document !== 'undefined') {
    document.documentElement.classList.toggle('is-firefox', isFirefox);
}

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
const mapOptions = {
    crs: L.CRS.Simple,
    minZoom: -4,
    maxZoom: 4,
    attributionControl: false,
    zoomControl: false // Disable default zoom, using custom styled one
};

if (isFirefox) {
    mapOptions.preferCanvas = true;
    mapOptions.markerZoomAnimation = false;
    mapOptions.fadeAnimation = false;
}

const map = L.map('map', mapOptions);

let atmosphereLayer = null;

// Register URL update listeners
map.on('moveend zoomend', updateURLWithMapView);
map.on('popupopen', refreshLucideIcons);
let interactionCooldownId = null;
const beginMapInteraction = () => {
    if (mobileLayoutV2Enabled && isMobileLayoutActive) {
        rootElement.classList.add('map-interacting');
    }
    if (interactionCooldownId) {
        clearTimeout(interactionCooldownId);
        interactionCooldownId = null;
    }
};
const endMapInteraction = () => {
    if (interactionCooldownId) clearTimeout(interactionCooldownId);
    interactionCooldownId = setTimeout(() => {
        rootElement.classList.remove('map-interacting');
    }, 140);
};
map.on('movestart zoomstart', beginMapInteraction);
map.on('moveend zoomend', endMapInteraction);

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

function isEmbedModeFromUrl() {
    const urlParams = getUrlParameters();
    return urlParams.embed === 'true' || urlParams.hideUI === 'true';
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

function sanitizeWikiLinkForHref(value) {
    const rawValue = String(value || '').trim();
    if (!rawValue) return null;
    if (/[\u0000-\u001F\u007F]/.test(rawValue)) return null;

    // Reject protocol-relative links (e.g., //example.com) to keep behavior constrained
    // to explicit http(s) or local-relative/hash navigation.
    if (rawValue.startsWith('//')) return null;

    if (rawValue.startsWith('#') || rawValue.startsWith('/') || rawValue.startsWith('./') || rawValue.startsWith('../')) {
        // Keep href attribute safe and reject malformed local links.
        if (/["'<>`]/.test(rawValue)) return null;
        if (/\s/.test(rawValue)) return null;
        return rawValue;
    }

    try {
        const parsed = new URL(rawValue);
        const protocol = String(parsed.protocol || '').toLowerCase();
        if (protocol !== 'http:' && protocol !== 'https:') {
            return null;
        }
        return parsed.href;
    } catch (error) {
        return null;
    }
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

function createPoiTooltipContent(data) {
    const safeName = sanitizeTextForHtml(data?.name || 'Unnamed Location');
    const rawType = String(data?.type || '').trim();
    if (!rawType) return safeName;

    return `${safeName} <span class="poi-hover-tooltip-separator">•</span> ${sanitizeTextForHtml(rawType)}`;
}

function getPoiTooltipOptions() {
    return {
        direction: 'top',
        offset: L.point(0, -32),
        opacity: 0.96,
        className: 'poi-hover-tooltip'
    };
}

function attachPoiTooltipBehavior(marker) {
    if (!marker || typeof marker.on !== 'function') return marker;

    marker.poiPopupActive = false;

    marker.on('popupopen', () => {
        marker.poiPopupActive = true;
        if (typeof marker.closeTooltip === 'function') {
            marker.closeTooltip();
        }
    });

    marker.on('popupclose', () => {
        marker.poiPopupActive = false;
    });

    marker.on('tooltipopen', () => {
        if (marker.poiPopupActive && typeof marker.closeTooltip === 'function') {
            marker.closeTooltip();
        }
    });

    return marker;
}

function clearTransientMapSearchParams(search = window.location.search) {
    const params = new URLSearchParams(search);
    [
        'view',
        'poi',
        'region',
        'line',
        'route',
        'step',
        'src',
        'stype'
    ].forEach((key) => params.delete(key));

    const nextSearch = params.toString();
    return nextSearch ? `?${nextSearch}` : '';
}

function navigateToMap(mapId, { preResolvedMap = null, preserveSearch = false } = {}) {
    const nextSearch = preserveSearch ? window.location.search : clearTransientMapSearchParams(window.location.search);
    const nextHash = generateHash(mapId, currentSidebarState);
    const nextUrl = buildAppUrlWithHash(nextHash, nextSearch);

    if (`${window.location.pathname}${window.location.search}${window.location.hash}` !== nextUrl) {
        history.pushState(
            {
                mapId,
                sidebarState: currentSidebarState,
                search: nextSearch,
                hash: nextHash
            },
            '',
            nextUrl
        );
    }

    if (isMobileLayoutActive) {
        closeMobileSheet({ restoreFocus: false });
    }
    loadMap(mapId, false, preResolvedMap);
}

function resolveInitialMapViewport(params) {
    const hasFeatureTarget = params.has('poi') || params.has('region') || params.has('line');
    if (hasFeatureTarget) {
        return { mode: 'feature' };
    }

    if (params.has('route')) {
        return { mode: 'route' };
    }

    const explicitViewParam = params.get('view');
    if (explicitViewParam) {
        const [lat, lng, zoom] = explicitViewParam.split(',').map(Number);
        if (!isNaN(lat) && !isNaN(lng) && !isNaN(zoom)) {
            return {
                mode: 'explicit-view',
                view: { lat, lng, zoom },
                rawView: explicitViewParam
            };
        }
    }

    return { mode: 'fit-bounds' };
}

function applySearchParamsToCurrentMap(params = new URLSearchParams(window.location.search)) {
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
        const initialViewport = resolveInitialMapViewport(params);
        if (initialViewport.mode === 'explicit-view' && initialViewport.view) {
            map.setView(
                [initialViewport.view.lat, initialViewport.view.lng],
                initialViewport.view.zoom,
                { animate: false }
            );
            trackShareViewOpenFromParams(params, initialViewport.rawView);
            const shareContext = getShareContextFromParams(params);
            if (shareContext) {
                showShareRelayPrompt(shareContext);
            }
        } else if (currentBounds) {
            map.fitBounds(currentBounds);
        }
    }

    return featureFocused;
}

// --- NEW: Unified Popup Content Generator ---
function createPopupContent(data, type) {
    const safePronunciation = data.pronunciation ? sanitizeTextForHtml(data.pronunciation) : '';
    const safeSummary = data.summary ? sanitizeTextForHtml(data.summary) : '';
    const safeDescription = data.description ? sanitizeTextForHtml(data.description) : '';

    // Part 1: Build the header, which is always visible.
    let headerHtml = '';
    if (data.name) {
        const safeName = sanitizeTextForHtml(data.name);
        const escapedName = escapeForSingleQuotedAttribute(data.name);
        const safeWikiHref = sanitizeWikiLinkForHref(data.wikiLink);
        let shareButtonHtml = '';
        if (type) {
            // Using an SVG icon to match the site theme
            const linkIcon = `<i class="ui-icon" data-lucide="link-2" aria-hidden="true"></i>`;
            shareButtonHtml = ` <button class="share-btn" onclick="copyFeatureLink(this, '${type}', '${escapedName}')" title="Share this location">${linkIcon}</button>`;
        }

        if (safeWikiHref) {
            headerHtml += `<div class="popup-header-row"><h3><a href="${safeWikiHref}" target="_blank" rel="noopener noreferrer" title="Visit wiki page for ${safeName}">${safeName}</a></h3>${shareButtonHtml}</div>`;
        } else {
            headerHtml += `<div class="popup-header-row"><h3>${safeName}</h3>${shareButtonHtml}</div>`;
        }
    }
    if (safePronunciation) {
        headerHtml += `<p style="margin-top: -10px; margin-bottom: 5px;"><em>${safePronunciation}</em></p>`;
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
    fullContentInnerHtml += formatPropertiesForPopup(data.properties, !!safeDescription);
    if (safeDescription) {
        fullContentInnerHtml += `<p>${safeDescription}</p>`;
    }

    // Part 3: Check for summary and full content presence.
    const hasSummary = safeSummary && safeSummary.trim() !== '';
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
                    <p>${safeSummary}</p>
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
let currentMapUnderlay = null;
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

const DEFAULT_MAP_BACKGROUND_COLORS = {
    light: '#f4f0eb',
    dark: '#050510'
};

function getMapBackgroundColor(mapEntry) {
    const candidate = String(mapEntry?.backgroundColor || '').trim();
    if (candidate) return candidate;
    return currentEffectiveTheme === 'dark'
        ? DEFAULT_MAP_BACKGROUND_COLORS.dark
        : DEFAULT_MAP_BACKGROUND_COLORS.light;
}

function updateMapUnderlayColor(mapEntry = null) {
    if (!currentMapUnderlay) return;
    currentMapUnderlay.setStyle({
        fillColor: getMapBackgroundColor(mapEntry),
        color: getMapBackgroundColor(mapEntry)
    });
}

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
const mobileMapsLauncherBtn = document.getElementById('mobile-maps-launcher-btn');
const themeToggle = document.getElementById('theme-checkbox');
const themeSwitchWrapper = themeToggle ? themeToggle.closest('.theme-switch-wrapper') : null;
const bodyElement = document.body;
const mapElement = document.getElementById('map'); // Get map div
const mapContainerElement = document.getElementById('map-container');
if (mapElement) {
    atmosphereLayer = document.createElement('div');
    atmosphereLayer.id = 'atmosphere-layer';
    atmosphereLayer.setAttribute('aria-hidden', 'true');
    mapElement.appendChild(atmosphereLayer);
}
const toggleBlurbBtn = document.getElementById('toggle-blurb-btn');
const toggleGMPanelBtn = document.getElementById('toggle-gm-panel-btn');
const toggleToolkitPanelBtn = document.getElementById('toggle-toolkit-panel-btn');
const mapBlurbElement = document.getElementById('map-blurb');
const toggleMarkersBtn = document.getElementById('toggle-markers-btn');
const searchControlContainer = document.getElementById('search-control-container');
const poiSearchInput = document.getElementById('poi-search-input');
const searchScopeAtlasBtn = document.getElementById('search-scope-atlas-btn');
const searchResultsContainer = document.getElementById('search-results-container');
const poiFilterContainer = document.getElementById('poi-filter-container');
const filterToggleAllCheckbox = document.getElementById('filter-toggle-all');
const toggleFiltersBtn = document.getElementById('toggle-filters-btn');
const measureToolBtn = document.getElementById('measure-tool-btn');
const loadingIndicator = document.getElementById('loading-indicator');
const loadingRetryBtn = document.getElementById('loading-retry-btn');
const searchRefineFiltersBtn = document.getElementById('search-refine-filters-btn');
const searchRefineClearBtn = document.getElementById('search-refine-clear-btn');
const activeFiltersContainer = document.getElementById('active-filters-container');
const sidebarBackdrop = document.getElementById('sidebar-backdrop');
const mobileSearchPanel = document.getElementById('mobile-search-panel');
const mobileSearchPanelCloseBtn = document.getElementById('mobile-search-panel-close-btn');
const mobileSearchPanelTitle = document.getElementById('mobile-search-panel-title');
const mobileMapsSheet = document.getElementById('mobile-maps-sheet');
const mobileMapsSheetCloseBtn = document.getElementById('mobile-maps-sheet-close-btn');
const mobileCurrentMapSummaryCard = document.getElementById('mobile-current-map-summary-card');
const mobileCurrentMapSummaryName = document.getElementById('mobile-current-map-summary-name');
const mobileCurrentMapSummaryBlurb = document.getElementById('mobile-current-map-summary-blurb');
const mobileSearchCard = document.getElementById('mobile-search-card');
const mobileSearchPanelSearchSlot = document.getElementById('mobile-search-panel-search-slot');
const mobileSearchResultsCard = document.getElementById('mobile-search-results-card');
const mobileSearchPanelResultsSlot = document.getElementById('mobile-search-panel-results-slot');
const mobileMapListSection = document.getElementById('mobile-map-list-section');
const mobileMapsSheetMapListSlot = document.getElementById('mobile-maps-sheet-map-list-slot');
const mobileCurrentMapName = document.getElementById('mobile-current-map-name');
const mobileMapBlurbToggleBtn = document.getElementById('mobile-map-blurb-toggle-btn');
const mobileMapBlurbPanel = document.getElementById('mobile-map-blurb-panel');
const mobileMarkersBtn = document.getElementById('mobile-markers-btn');
const mobileMeasureBtn = document.getElementById('mobile-measure-btn');
const mobileShareViewBtn = document.getElementById('mobile-share-view-btn');
const mobileSoundBtn = document.getElementById('mobile-sound-btn');
const mobileCoordsBtn = document.getElementById('mobile-coords-btn');
const mobileHelpBtn = document.getElementById('mobile-help-btn');
const onboardingCoachmark = document.getElementById('onboarding-coachmark');
const onboardingOpenHelpBtn = document.getElementById('onboarding-open-help-btn');
const onboardingDismissBtn = document.getElementById('onboarding-dismiss-btn');
const shareRelayCoachmark = document.getElementById('share-relay-coachmark');
const shareRelayCopy = document.getElementById('share-relay-copy');
const shareRelayActionBtn = document.getElementById('share-relay-action-btn');
const shareRelayDismissBtn = document.getElementById('share-relay-dismiss-btn');
const toggleCoordsBtn = document.getElementById('toggle-coords-btn');
const shareViewBtn = document.getElementById('share-view-btn');
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
let mobileLayoutV2Enabled = false;
let isMobileLayoutActive = false;
let mobileSearchPanelOpen = false;
let mobileMapsSheetOpen = false;
let mobileFilterExpanded = false;
let lastControlTouchAt = 0;
let activeShareRelayContext = null;
const shownShareRelaySessionKeys = new Set();
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

function safeGetSessionStorage(key) {
    try {
        return sessionStorage.getItem(key);
    } catch (error) {
        return null;
    }
}

function safeSetSessionStorage(key, value) {
    try {
        sessionStorage.setItem(key, value);
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

function normalizeMobileLayoutMode(rawValue) {
    const normalized = String(rawValue || '').trim().toLowerCase();
    if (normalized === MOBILE_LAYOUT_MODE_V2 || normalized === MOBILE_LAYOUT_MODE_LEGACY) {
        return normalized;
    }
    return null;
}

function getMobileLayoutModeFromUrl() {
    const urlParams = getUrlParameters();
    return normalizeMobileLayoutMode(urlParams[MOBILE_LAYOUT_QUERY_PARAM]);
}

function resolveMobileLayoutV2Enabled() {
    const modeFromUrl = getMobileLayoutModeFromUrl();
    if (modeFromUrl) {
        safeSetStorage(UX_STORAGE_KEYS.mobileLayoutMode, modeFromUrl);
        return modeFromUrl === MOBILE_LAYOUT_MODE_V2;
    }

    const modeFromStorage = normalizeMobileLayoutMode(safeGetStorage(UX_STORAGE_KEYS.mobileLayoutMode));
    if (modeFromStorage) {
        return modeFromStorage === MOBILE_LAYOUT_MODE_V2;
    }

    // Default to v2 for new sessions while allowing explicit query/storage rollback.
    safeSetStorage(UX_STORAGE_KEYS.mobileLayoutMode, MOBILE_LAYOUT_MODE_V2);
    return true;
}

function resolveControlVisibilityState({
    isEmbedded = false,
    isMobileLayout = false,
    advancedControls = false,
    hasPOIs = false,
    hasRegions = false,
    hasRoads = false,
    hasRoutes = false,
    hasValidScale = false,
    hasBlurb = false,
    hasLatLonBounds = false,
    allowGMToolkit = false,
    atlasSearchCount = 0,
    routeCount = 0,
    toolkitVisible = false,
    gmVisible = false
} = {}) {
    const showMarkers = hasPOIs || hasRegions;
    const showSearch = hasPOIs || hasRegions || hasRoads || hasRoutes || atlasSearchCount > 0;
    const showFilters = hasPOIs || hasRegions || hasRoads;
    const showAdvanced = advancedControls && !isEmbedded;
    const showMobileSheet = isMobileLayout && !isEmbedded;

    return {
        showMarkersButton: showMarkers && !isMobileLayout,
        showSearchControl: showSearch,
        showMobileSheetToggle: showMobileSheet,
        showFiltersButton: showFilters && !isMobileLayout,
        showSearchFilterAction: showFilters,
        showMeasureButton: showAdvanced && hasValidScale && !isMobileLayout,
        showSoundButton: showAdvanced && !isMobileLayout,
        showBlurbButton: showAdvanced && hasBlurb && !isMobileLayout,
        showCoordsButton: showAdvanced && hasLatLonBounds && !isMobileLayout,
        showShareButton: showAdvanced && !isMobileLayout,
        showGMButton: showAdvanced && allowGMToolkit && !isMobileLayout,
        showToolkitButton: showAdvanced && allowGMToolkit && !isMobileLayout,
        showRoutePanel: routeCount > 0 && !isEmbedded && !isMobileLayout,
        showToolkitPanel: allowGMToolkit && toolkitVisible && !isMobileLayout,
        showGMPill: allowGMToolkit && gmVisible && !isMobileLayout,
        showMobileExploreMode: showMobileSheet,
        showMobileMapMode: showMobileSheet,
        showMobileMapList: showMobileSheet,
        showMobileMoreSection: false,
        showMobileMarkersAction: false,
        showMobileMeasureAction: false,
        showMobileShareAction: false,
        showMobileSoundAction: false,
        showMobileCoordsAction: false,
        showMobileHelpAction: false,
        showMobileMapBlurb: false,
        mobileMarkersDisabled: !showMarkers,
        mobileMeasureDisabled: !hasValidScale,
        mobileShareDisabled: false,
        mobileSoundDisabled: false,
        mobileCoordsDisabled: !hasLatLonBounds,
        mobileHelpDisabled: false
    };
}

function shouldAutoOpenOnboardingGuide({
    isEmbedded = false,
    isMobileLayout = false,
    hasSeenOnboarding = false
} = {}) {
    return !isEmbedded && !isMobileLayout && !hasSeenOnboarding;
}

function setElementHiddenState(element, hidden) {
    if (!element) return;
    element.hidden = !!hidden;
}

function createMobilePlacementAnchor(element) {
    if (!element || !element.parentNode) return null;
    const anchor = document.createElement('span');
    anchor.hidden = true;
    anchor.setAttribute('aria-hidden', 'true');
    anchor.className = 'mobile-placement-anchor';
    element.parentNode.insertBefore(anchor, element);
    return anchor;
}

const mobileSearchControlAnchor = createMobilePlacementAnchor(searchControlContainer);
const mobileSearchResultsAnchor = createMobilePlacementAnchor(searchResultsContainer);
const mobileFilterAnchor = createMobilePlacementAnchor(poiFilterContainer);
const mobileMapListAnchor = createMobilePlacementAnchor(mapListElement);

function restorePlacedNode(anchor, element) {
    if (!anchor || !anchor.parentNode || !element) return;
    if (element.parentNode === anchor.parentNode && anchor.nextSibling === element) return;
    anchor.parentNode.insertBefore(element, anchor.nextSibling);
}

function syncMobileSheetPlacement() {
    if (isMobileLayoutActive) {
        if (mobileSearchPanelSearchSlot && searchControlContainer && searchControlContainer.parentNode !== mobileSearchPanelSearchSlot) {
            mobileSearchPanelSearchSlot.appendChild(searchControlContainer);
        }
        if (mobileSearchPanelSearchSlot && poiFilterContainer && poiFilterContainer.parentNode !== mobileSearchPanelSearchSlot) {
            mobileSearchPanelSearchSlot.appendChild(poiFilterContainer);
        }
        if (mobileSearchPanelResultsSlot && searchResultsContainer && searchResultsContainer.parentNode !== mobileSearchPanelResultsSlot) {
            mobileSearchPanelResultsSlot.appendChild(searchResultsContainer);
        }
        if (mobileMapsSheetMapListSlot && mapListElement && mapListElement.parentNode !== mobileMapsSheetMapListSlot) {
            mobileMapsSheetMapListSlot.appendChild(mapListElement);
        }
        syncMobileSearchResultsCardState();
        return;
    }

    restorePlacedNode(mobileSearchControlAnchor, searchControlContainer);
    restorePlacedNode(mobileSearchResultsAnchor, searchResultsContainer);
    restorePlacedNode(mobileFilterAnchor, poiFilterContainer);
    restorePlacedNode(mobileMapListAnchor, mapListElement);
    syncMobileSearchResultsCardState();
}

function syncMobileSearchResultsCardState() {
    if (!mobileSearchResultsCard) return;
    const hasVisibleResults =
        isMobileLayoutActive &&
        searchResultsContainer &&
        searchResultsContainer.style.display !== 'none' &&
        searchResultsContainer.innerHTML.trim() !== '';
    mobileSearchResultsCard.hidden = !hasVisibleResults;
}

function resolveSearchScope(scope, {
    isMobileLayout = isMobileLayoutActive
} = {}) {
    const normalizedScope = scope === SEARCH_SCOPE_ATLAS ? SEARCH_SCOPE_ATLAS : SEARCH_SCOPE_MAP;
    if (isMobileLayout) {
        return SEARCH_SCOPE_MAP;
    }
    return normalizedScope;
}

function hasOpenMobileSurface() {
    return mobileSearchPanelOpen || mobileMapsSheetOpen;
}

mobileLayoutV2Enabled = resolveMobileLayoutV2Enabled();
updateMobileLayoutState();
setSearchScope(SEARCH_SCOPE_MAP);

if (isEmbeddedView) {
    if (bodyElement) bodyElement.classList.add('embedded-view');
    if (container) container.classList.add('sidebar-collapsed');
    currentSidebarState = 'c';
}

function syncDynamicViewportHeight() {
    const viewportHeight = window.visualViewport ? window.visualViewport.height : window.innerHeight;
    rootElement.style.setProperty('--app-height', `${Math.round(viewportHeight)}px`);
}

function syncBottomBarHeightVariable() {
    const bottomLinkBar = document.getElementById('bottom-link-bar');
    const bottomBarHeight = (!isEmbeddedView && bottomLinkBar && bottomLinkBar.style.display !== 'none')
        ? Math.ceil(bottomLinkBar.getBoundingClientRect().height)
        : 0;
    rootElement.style.setProperty('--bottom-link-bar-height', `${bottomBarHeight}px`);
}

function getViewportHeight() {
    return window.visualViewport ? window.visualViewport.height : window.innerHeight;
}

function clampFloatingPanels() {
    if (!mobileLayoutV2Enabled || isMobileLayoutActive) return;
    [routePanel, sessionToolkitPanel, gmPill, poiFilterContainer].forEach((panel) => {
        if (!panel) return;
        panel.style.maxHeight = '';
        panel.style.top = '';
        panel.style.right = '';
        panel.style.left = '';
    });
}

function updateMobileLayoutState() {
    syncDynamicViewportHeight();
    syncBottomBarHeightVariable();

    const active = mobileLayoutV2Enabled && window.innerWidth <= MOBILE_LAYOUT_BREAKPOINT;
    isMobileLayoutActive = active;

    rootElement.classList.toggle('mobile-layout-v2', mobileLayoutV2Enabled);
    rootElement.classList.toggle('is-mobile-layout', active);
    bodyElement.classList.toggle('mobile-layout-v2', mobileLayoutV2Enabled);
    bodyElement.classList.toggle('is-mobile-layout', active);
    container.classList.toggle('is-mobile-layout', active);

    rootElement.style.setProperty('--mobile-bottom-offset', active ? '14px' : '10px');
    if (!active && hasOpenMobileSurface()) {
        mobileSearchPanelOpen = false;
        mobileMapsSheetOpen = false;
    }
    if (toggleBtn) {
        const collapsed = container.classList.contains('sidebar-collapsed');
        if (active) {
            toggleBtn.title = mobileSearchPanelOpen ? 'Close search' : 'Open search';
            toggleBtn.setAttribute('aria-label', mobileSearchPanelOpen ? 'Close search' : 'Open search');
            toggleBtn.setAttribute('aria-expanded', mobileSearchPanelOpen ? 'true' : 'false');
        } else {
            toggleBtn.classList.remove('active');
            toggleBtn.innerHTML = collapsed
                ? `<i class="ui-icon" data-lucide="chevron-right" aria-hidden="true"></i>`
                : `<i class="ui-icon" data-lucide="chevron-left" aria-hidden="true"></i>`;
            toggleBtn.title = collapsed ? 'Expand Sidebar' : 'Collapse Sidebar';
            toggleBtn.setAttribute('aria-label', collapsed ? 'Expand Sidebar' : 'Collapse Sidebar');
            toggleBtn.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
            refreshLucideIcons();
        }
    }
    syncMobileSheetPlacement();
    syncMobileSearchResultsCardState();
    syncMobileSearchPanelState();
    syncMobileMapsSheetState();
    syncMobileFilterState();
    clampFloatingPanels();
}

function syncMobileSearchPanelState() {
    if (!mobileSearchPanel) return;
    const shouldShowPanel = isMobileLayoutActive && mobileSearchPanelOpen;
    mobileSearchPanel.setAttribute('aria-hidden', shouldShowPanel ? 'false' : 'true');
    container.classList.toggle('mobile-search-panel-open', shouldShowPanel);
    syncMobileDockState();
}

function syncMobileMapsSheetState() {
    if (!mobileMapsSheet) return;
    const shouldShowSheet = isMobileLayoutActive && mobileMapsSheetOpen;
    mobileMapsSheet.setAttribute('aria-hidden', shouldShowSheet ? 'false' : 'true');
    container.classList.toggle('mobile-maps-sheet-open', shouldShowSheet);
    syncMobileDockState();
}

function closeMobileSearchPanel({ restoreFocus = false } = {}) {
    if (!mobileSearchPanelOpen) return;
    mobileSearchPanelOpen = false;
    syncMobileSearchPanelState();
    syncSidebarBackdropState();
    if (restoreFocus && toggleBtn) {
        toggleBtn.focus();
    }
}

function openMobileSearchPanel({ focusSearch = false } = {}) {
    if (!isMobileLayoutActive) return;
    if (!searchControlContainer || searchControlContainer.style.display === 'none') return;
    if (mobileMapsSheetOpen) {
        mobileMapsSheetOpen = false;
        syncMobileMapsSheetState();
    }
    mobileSearchPanelOpen = true;
    setSearchScope(currentSearchScope);
    syncMobileSearchPanelState();
    syncSidebarBackdropState();
    if (focusSearch && poiSearchInput) {
        requestAnimationFrame(() => poiSearchInput.focus());
    }
}

function closeMobileMapsSheet({ restoreFocus = false } = {}) {
    if (!mobileMapsSheetOpen) return;
    mobileMapsSheetOpen = false;
    syncMobileMapsSheetState();
    syncSidebarBackdropState();
    if (restoreFocus && mobileMapsLauncherBtn) {
        mobileMapsLauncherBtn.focus();
    }
}

function openMobileMapsSheet() {
    if (!isMobileLayoutActive) return;
    if (mobileSearchPanelOpen) {
        mobileSearchPanelOpen = false;
        syncMobileSearchPanelState();
    }
    mobileMapsSheetOpen = true;
    syncMobileMapsSheetState();
    syncSidebarBackdropState();
}

function setMobileMapBlurbExpanded(expanded) {
    if (!mobileMapBlurbToggleBtn || !mobileMapBlurbPanel) return;
    const nextExpanded = !!expanded;
    mobileMapBlurbToggleBtn.setAttribute('aria-expanded', nextExpanded ? 'true' : 'false');
    mobileMapBlurbPanel.hidden = !nextExpanded;
    mobileMapBlurbToggleBtn.classList.toggle('active', nextExpanded);
}

function syncMobileMapMeta(mapInfo, visibilityState) {
    if (mobileCurrentMapSummaryCard) {
        mobileCurrentMapSummaryCard.hidden = !(isMobileLayoutActive && !!mapInfo);
    }
    if (mobileCurrentMapSummaryName) {
        mobileCurrentMapSummaryName.textContent = mapInfo?.name || 'Atlas';
    }
    if (mobileCurrentMapSummaryBlurb) {
        mobileCurrentMapSummaryBlurb.textContent = getMobileMapSummaryExcerpt(mapInfo);
    }
    if (mobileCurrentMapName) {
        mobileCurrentMapName.textContent = mapInfo?.name || 'Atlas';
    }
    if (!mobileMapBlurbPanel || !mobileMapBlurbToggleBtn) return;

    const blurb = String(mapInfo?.blurb || '').trim();
    mobileMapBlurbPanel.innerHTML = blurb;
    setElementHiddenState(mobileMapBlurbToggleBtn, !visibilityState.showMobileMapBlurb);
    if (!visibilityState.showMobileMapBlurb) {
        setMobileMapBlurbExpanded(false);
    }

    if (mobileSearchPanelTitle) {
        mobileSearchPanelTitle.textContent = 'Explore';
    }
}

function syncMobileUtilityButton(button, {
    visible = false,
    pressed = false,
    disabled = false
} = {}) {
    if (!button) return;
    button.hidden = !visible;
    button.disabled = visible ? !!disabled : false;
    button.classList.toggle('active', visible && !disabled && pressed);
    button.setAttribute('aria-pressed', visible && !disabled && pressed ? 'true' : 'false');
    button.setAttribute('aria-disabled', visible && disabled ? 'true' : 'false');
}

function syncMobileSheetActionState(visibilityState) {
    syncMobileUtilityButton(mobileMarkersBtn, {
        visible: visibilityState.showMobileMarkersAction,
        pressed: markersVisible,
        disabled: visibilityState.mobileMarkersDisabled
    });
    syncMobileUtilityButton(mobileMeasureBtn, {
        visible: visibilityState.showMobileMeasureAction,
        pressed: isMeasuringMultiPoint,
        disabled: visibilityState.mobileMeasureDisabled
    });
    if (mobileShareViewBtn) {
        mobileShareViewBtn.hidden = !visibilityState.showMobileShareAction;
        mobileShareViewBtn.disabled = visibilityState.showMobileShareAction ? !!visibilityState.mobileShareDisabled : false;
        mobileShareViewBtn.setAttribute('aria-disabled', visibilityState.showMobileShareAction && visibilityState.mobileShareDisabled ? 'true' : 'false');
    }
    syncMobileUtilityButton(mobileSoundBtn, {
        visible: visibilityState.showMobileSoundAction,
        pressed: soundEnabled,
        disabled: visibilityState.mobileSoundDisabled
    });
    syncMobileUtilityButton(mobileCoordsBtn, {
        visible: visibilityState.showMobileCoordsAction,
        pressed: coordsDisplayEnabled,
        disabled: visibilityState.mobileCoordsDisabled
    });
    if (mobileHelpBtn) {
        mobileHelpBtn.hidden = !visibilityState.showMobileHelpAction;
        mobileHelpBtn.disabled = visibilityState.showMobileHelpAction ? !!visibilityState.mobileHelpDisabled : false;
        mobileHelpBtn.setAttribute('aria-disabled', visibilityState.showMobileHelpAction && visibilityState.mobileHelpDisabled ? 'true' : 'false');
    }
}

function syncMobileExploreVisibility() {
    if (!mobileMapListSection) return;
    mobileMapListSection.hidden = false;
}

function syncMobileFilterState() {
    container.classList.toggle('mobile-filters-open', isMobileLayoutActive && mobileFilterExpanded);
    if (searchRefineFiltersBtn) {
        searchRefineFiltersBtn.classList.toggle('active', mobileFilterExpanded);
        searchRefineFiltersBtn.setAttribute('aria-pressed', mobileFilterExpanded ? 'true' : 'false');
        searchRefineFiltersBtn.textContent = mobileFilterExpanded ? 'Hide Filters' : 'Filters';
    }
}

function syncMobileDockState() {
    if (toggleBtn && isMobileLayoutActive) {
        toggleBtn.classList.toggle('active', mobileSearchPanelOpen);
        toggleBtn.setAttribute('aria-expanded', mobileSearchPanelOpen ? 'true' : 'false');
        toggleBtn.title = mobileSearchPanelOpen ? 'Close search' : 'Open search';
        toggleBtn.setAttribute('aria-label', mobileSearchPanelOpen ? 'Close search' : 'Open search');
        toggleBtn.innerHTML = mobileSearchPanelOpen
            ? `<i class="ui-icon" data-lucide="x" aria-hidden="true"></i>`
            : `<i class="ui-icon" data-lucide="search" aria-hidden="true"></i>`;
        refreshLucideIcons();
    }
    if (mobileMapsLauncherBtn) {
        const mapsActive = isMobileLayoutActive && mobileMapsSheetOpen;
        mobileMapsLauncherBtn.hidden = !isMobileLayoutActive || isEmbeddedView;
        mobileMapsLauncherBtn.classList.toggle('active', mapsActive);
        mobileMapsLauncherBtn.setAttribute('aria-pressed', mapsActive ? 'true' : 'false');
        mobileMapsLauncherBtn.setAttribute('aria-label', mapsActive ? 'Close maps' : 'Open maps');
    }
}

function markControlTouch(event) {
    const target = event?.target;
    if (!(target instanceof Element)) return;
    if (!target.closest('.leaflet-control, .map-control-button, #toggle-sidebar-btn, #mobile-search-panel, #mobile-maps-sheet, #sidebar-backdrop, .modal-overlay, .modal-content')) return;
    lastControlTouchAt = Date.now();
}

function shouldIgnoreMapPointerEvent(event) {
    const target = event?.originalEvent?.target;
    if (target instanceof Element && target.closest('.leaflet-control, .map-control-button, #toggle-sidebar-btn, #mobile-search-panel, #mobile-maps-sheet, .modal-overlay, .modal-content')) {
        return true;
    }
    if (isMobileLayoutActive && (Date.now() - lastControlTouchAt) < 150) {
        return true;
    }
    return false;
}

function getPreferredMapImageUrl(mapInfo) {
    if (!mapInfo) return '';
    const variants = mapInfo && typeof mapInfo.imageVariants === 'object' ? mapInfo.imageVariants : null;
    const defaultUrl = String(
        (variants && (variants.default || variants.desktop)) ||
        mapInfo.imageUrl ||
        ''
    ).trim();
    if (!defaultUrl) return '';

    if (!mobileLayoutV2Enabled || !isMobileLayoutActive) return defaultUrl;

    const candidateValues = [
        variants && variants.mobile,
        variants && variants.compact,
        mapInfo.mobileImageUrl,
        mapInfo.imageUrlMobile,
        mapInfo.smallImageUrl,
        mapInfo.imageUrlSmall
    ];
    for (const candidateValue of candidateValues) {
        const candidate = String(candidateValue || '').trim();
        if (candidate) {
            return candidate;
        }
    }
    return defaultUrl;
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
    if (isMobileLayoutActive && (panelEl === routePanel || panelEl === sessionToolkitPanel || panelEl === gmPill)) {
        panelEl.style.display = 'none';
        return;
    }
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
    void text;
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
    if (isMobileLayoutActive) {
        poiFilterContainer.style.left = '';
        poiFilterContainer.style.right = '';
        poiFilterContainer.style.top = '';
        poiFilterContainer.style.maxHeight = '';
        return;
    }
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
    updateMobileLayoutState();
    const isMobile = window.innerWidth <= MOBILE_LAYOUT_BREAKPOINT;
    const sidebarIsOpen = !container.classList.contains('sidebar-collapsed');
    const legacyDrawerOpen = isMobile && !isMobileLayoutActive && sidebarIsOpen;
    const mobileSurfaceOpen = isMobileLayoutActive && hasOpenMobileSurface();
    container.classList.toggle('mobile-sidebar-open', legacyDrawerOpen);
    container.classList.toggle('mobile-surface-open', mobileSurfaceOpen);
    if (sidebarBackdrop) {
        sidebarBackdrop.setAttribute('aria-hidden', (legacyDrawerOpen || mobileSurfaceOpen) ? 'false' : 'true');
    }
    syncMobileSearchPanelState();
    syncMobileMapsSheetState();
    clampFloatingPanels();
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

function stripHtml(value) {
    return String(value || '')
        .replace(/<[^>]*>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function getMapRuntimeData(mapId = currentlyLoadedMapId) {
    if (!mapId) return null;
    if (currentMapData && currentMapData.id === mapId) {
        return currentMapData;
    }
    return findMapRecursive(mapData, mapId);
}

function getMapDataUrl(mapEntry) {
    const explicitUrl = String(mapEntry?.dataUrl || '').trim();
    if (explicitUrl) return explicitUrl;
    const mapId = String(mapEntry?.id || '').trim();
    return mapId ? `maps/${mapId}.json` : '';
}

async function fetchJsonAsset(url) {
    const response = await fetch(withAssetVersion(url));
    if (!response.ok) {
        throw new Error(`Failed to load ${url}: ${response.status} ${response.statusText}`);
    }
    return response.json();
}

async function getMapDefinition(mapId, preResolvedMap = null) {
    const manifestEntry = preResolvedMap || findMapRecursive(mapData, mapId);
    if (!manifestEntry) {
        throw new Error(`Map "${mapId}" not found in atlas index.`);
    }

    if (mapDefinitionCache.has(mapId)) {
        return mapDefinitionCache.get(mapId);
    }

    if (mapDefinitionPromiseCache.has(mapId)) {
        return mapDefinitionPromiseCache.get(mapId);
    }

    const dataUrl = getMapDataUrl(manifestEntry);
    const definitionPromise = fetchJsonAsset(dataUrl)
        .then((mapDefinition) => {
            const mergedDefinition = {
                ...manifestEntry,
                ...mapDefinition
            };
            prefetchedJsonUrls.add(withAssetVersion(dataUrl));
            mapDefinitionCache.set(mapId, mergedDefinition);
            mapDefinitionPromiseCache.delete(mapId);
            return mergedDefinition;
        })
        .catch((error) => {
            mapDefinitionPromiseCache.delete(mapId);
            throw error;
        });

    mapDefinitionPromiseCache.set(mapId, definitionPromise);
    return definitionPromise;
}

function getSearchScopeLabel(scope = currentSearchScope) {
    return scope === SEARCH_SCOPE_ATLAS ? 'Atlas' : 'This Map';
}

function setSearchScope(scope) {
    currentSearchScope = resolveSearchScope(scope);
    if (searchScopeAtlasBtn) {
        const active = currentSearchScope === SEARCH_SCOPE_ATLAS;
        searchScopeAtlasBtn.setAttribute('aria-pressed', active ? 'true' : 'false');
    }
}

function getMobileMapSummaryExcerpt(mapInfo, maxLength = 148) {
    const rawBlurb = stripHtml(mapInfo?.blurb || '');
    if (!rawBlurb) {
        return 'Search locations, routes, and regions on this map.';
    }
    if (rawBlurb.length <= maxLength) {
        return rawBlurb;
    }
    const shortened = rawBlurb.slice(0, Math.max(0, maxLength - 1));
    const trimmed = shortened.replace(/\s+\S*$/, '').trim();
    return `${trimmed || shortened.trim()}…`;
}

function closeSearchResults({ clearMeta = true } = {}) {
    renderedSearchResults = [];
    activeSearchResultIndex = -1;
    searchResultsContainer.style.display = 'none';
    searchResultsContainer.innerHTML = '';
    if (clearMeta) {
        setSearchMeta('');
        lastTrackedSearchSignature = '';
        setSearchScope(SEARCH_SCOPE_MAP);
    }
    syncMobileSearchResultsCardState();
    syncMobileExploreVisibility();
}

function normalizeSearchValue(value) {
    return String(value || '').trim().toLowerCase();
}

function getFuzzyMatchScore(term, target) {
    if (!term || !target) return -1;
    let searchIndex = 0;
    let lastMatchIndex = -1;
    let spreadPenalty = 0;

    for (const char of term) {
        const foundIndex = target.indexOf(char, searchIndex);
        if (foundIndex === -1) return -1;
        if (lastMatchIndex >= 0) {
            spreadPenalty += Math.max(0, foundIndex - lastMatchIndex - 1);
        }
        lastMatchIndex = foundIndex;
        searchIndex = foundIndex + 1;
    }

    return Math.max(40, 160 - spreadPenalty);
}

function computeSearchMatch(term, primaryText, secondaryText = '') {
    const normalizedPrimary = normalizeSearchValue(primaryText);
    const normalizedSecondary = normalizeSearchValue(secondaryText);
    if (!term || !normalizedPrimary) return { matched: false, score: -1, matchedByContent: false };

    if (normalizedPrimary === term) {
        return { matched: true, score: 520, matchedByContent: false };
    }
    if (normalizedPrimary.startsWith(term)) {
        return { matched: true, score: 430, matchedByContent: false };
    }
    const primaryIndex = normalizedPrimary.indexOf(term);
    if (primaryIndex >= 0) {
        return { matched: true, score: 320 - Math.min(primaryIndex, 120), matchedByContent: false };
    }

    const fuzzyScore = getFuzzyMatchScore(term, normalizedPrimary);
    if (fuzzyScore >= 0) {
        return { matched: true, score: fuzzyScore, matchedByContent: false };
    }

    if (normalizedSecondary) {
        if (normalizedSecondary.includes(term)) {
            return { matched: true, score: 180, matchedByContent: true };
        }
        const fuzzySecondaryScore = getFuzzyMatchScore(term, normalizedSecondary);
        if (fuzzySecondaryScore >= 0) {
            return { matched: true, score: Math.max(80, fuzzySecondaryScore - 40), matchedByContent: true };
        }
    }

    return { matched: false, score: -1, matchedByContent: false };
}

function escapeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function highlightSearchText(text, term) {
    const safeText = escapeHtml(text);
    if (!term) return safeText;
    const escapedTerm = escapeRegExp(term);
    return safeText.replace(new RegExp(escapedTerm, 'gi'), '<span class="search-result-highlight">$&</span>');
}

function scheduleIdleTask(callback, timeout = 900) {
    if (typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function') {
        return window.requestIdleCallback(callback, { timeout });
    }
    return window.setTimeout(() => callback({ didTimeout: false, timeRemaining: () => 0 }), Math.min(timeout, 400));
}

function cancelIdleTask(id) {
    if (id == null) return;
    if (typeof window !== 'undefined' && typeof window.cancelIdleCallback === 'function') {
        window.cancelIdleCallback(id);
        return;
    }
    clearTimeout(id);
}

function registerServiceWorker() {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
    if (!/^https?:$/i.test(window.location.protocol)) return;

    const swUrl = `sw.js?v=${encodeURIComponent(window.APP_ASSET_VERSION || '0')}`;
    window.addEventListener('load', () => {
        navigator.serviceWorker.register(swUrl).catch((error) => {
            console.warn('Service worker registration failed:', error);
        });
    }, { once: true });
}

async function prefetchJsonAsset(url) {
    const normalizedUrl = withAssetVersion(url);
    if (!url || prefetchedJsonUrls.has(normalizedUrl)) return;
    prefetchedJsonUrls.add(normalizedUrl);
    try {
        await fetch(normalizedUrl, { credentials: 'same-origin' });
    } catch (error) {
        prefetchedJsonUrls.delete(normalizedUrl);
    }
}

function prefetchImageAsset(url) {
    const normalizedUrl = withAssetVersion(url);
    if (!url || prefetchedImageUrls.has(normalizedUrl)) return;
    prefetchedImageUrls.add(normalizedUrl);
    prefetchImageQueue.push(normalizedUrl);
    drainPrefetchImageQueue();
}

function drainPrefetchImageQueue() {
    if (prefetchImageInFlight || prefetchImageQueue.length === 0) return;
    const nextUrl = prefetchImageQueue.shift();
    if (!nextUrl) return;
    prefetchImageInFlight = true;
    const img = new Image();
    const finalize = () => {
        prefetchImageInFlight = false;
        drainPrefetchImageQueue();
    };
    img.onload = finalize;
    img.onerror = () => {
        prefetchedImageUrls.delete(nextUrl);
        finalize();
    };
    img.src = nextUrl;
}

function collectLinkedMapPrefetchCandidates(mapDefinition) {
    const candidateIds = new Set();
    const maybeAdd = (mapId) => {
        const normalizedId = String(mapId || '').trim();
        if (!normalizedId || normalizedId === currentlyLoadedMapId) return;
        const target = findMapRecursive(mapData, normalizedId);
        if (isRenderableMapEntry(target)) {
            candidateIds.add(normalizedId);
        }
    };

    getVisiblePoints(mapDefinition).forEach((point) => maybeAdd(point.linkedMapId));
    getVisibleRegions(mapDefinition).forEach((region) => maybeAdd(region.linkedMapId));
    getVisibleLines(mapDefinition).forEach((line) => maybeAdd(line.linkedMapId));
    getVisibleRoutes(mapDefinition).forEach((route) => {
        route.steps.forEach((step) => {
            if (step.targetType === 'map') {
                maybeAdd(step.targetId);
            }
        });
    });

    return Array.from(candidateIds);
}

function schedulePostLoadPrefetch(mapDefinition) {
    if (isEmbeddedView || !mapDefinition) return;
    if (scheduledPrefetchIdleId) {
        cancelIdleTask(scheduledPrefetchIdleId);
        scheduledPrefetchIdleId = null;
    }

    scheduledPrefetchIdleId = scheduleIdleTask(() => {
        scheduledPrefetchIdleId = null;
        const currentManifest = findMapRecursive(mapData, mapDefinition.id);
        if (currentManifest) {
            prefetchJsonAsset(getMapDataUrl(currentManifest));
            prefetchImageAsset(getPreferredMapImageUrl(currentManifest));
        }

        collectLinkedMapPrefetchCandidates(mapDefinition)
            .slice(0, 3)
            .forEach((candidateId, index) => {
                const candidateEntry = findMapRecursive(mapData, candidateId);
                if (!candidateEntry) return;
                prefetchJsonAsset(getMapDataUrl(candidateEntry));
                if (index === 0) {
                    prefetchImageAsset(getPreferredMapImageUrl(candidateEntry));
                }
            });
    });
}

// --- Function to Set Sidebar State ---
function setSidebarState(state, updateHash = true) {
    const shouldBeCollapsed = (state === 'c');
    const isCurrentlyCollapsed = container.classList.contains('sidebar-collapsed');
    if (!shouldBeCollapsed && isMobileLayoutActive && hasOpenMobileSurface()) {
        closeMobileSearchPanel({ restoreFocus: false });
        closeMobileMapsSheet({ restoreFocus: false });
    }
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
    if (isMobileLayoutActive) {
        coordinateDisplay.style.display = 'none';
    }
    if (mobileCoordsBtn) {
        mobileCoordsBtn.classList.toggle('active', coordsDisplayEnabled);
        mobileCoordsBtn.setAttribute('aria-pressed', coordsDisplayEnabled ? 'true' : 'false');
    }
    trackAnalytics('coords_display_toggled', { visible: coordsDisplayEnabled });
}

function updateCurrentControlVisibility(selectedMap = null) {
    const mapInfo = selectedMap || getMapRuntimeData(currentlyLoadedMapId);
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
    const allowGMToolkit = canAccessGMToolkit() && !isEmbeddedView;

    const visibilityState = resolveControlVisibilityState({
        isEmbedded: isEmbeddedView,
        isMobileLayout: isMobileLayoutActive,
        advancedControls: advancedControlsUnlocked,
        hasPOIs,
        hasRegions,
        hasRoads,
        hasRoutes: Array.isArray(currentRoutes) && currentRoutes.length > 0,
        hasValidScale,
        hasBlurb: !!mapInfo.blurb,
        hasLatLonBounds: !!mapInfo.latLonBounds,
        allowGMToolkit,
        atlasSearchCount: Array.isArray(atlasSearchIndex) ? atlasSearchIndex.length : 0,
        routeCount: Array.isArray(currentRoutes) ? currentRoutes.length : 0,
        toolkitVisible: toolkitPanelVisible,
        gmVisible: gmPanelVisible
    });

    toggleMarkersBtn.style.display = visibilityState.showMarkersButton ? 'block' : 'none';
    searchControlContainer.style.display = visibilityState.showSearchControl ? 'block' : 'none';
    toggleFiltersBtn.style.display = visibilityState.showFiltersButton ? 'block' : 'none';
    measureToolBtn.style.display = visibilityState.showMeasureButton ? 'block' : 'none';
    if (toggleSoundBtn) toggleSoundBtn.style.display = visibilityState.showSoundButton ? 'block' : 'none';
    toggleBlurbBtn.style.display = visibilityState.showBlurbButton ? 'block' : 'none';
    toggleCoordsBtn.style.display = visibilityState.showCoordsButton ? 'block' : 'none';
    if (shareViewBtn) shareViewBtn.style.display = visibilityState.showShareButton ? 'block' : 'none';
    if (toggleGMPanelBtn) toggleGMPanelBtn.style.display = visibilityState.showGMButton ? 'block' : 'none';
    if (toggleToolkitPanelBtn) toggleToolkitPanelBtn.style.display = visibilityState.showToolkitButton ? 'block' : 'none';
    if (toggleBtn) toggleBtn.hidden = isEmbeddedView;
    if (searchRefineFiltersBtn) searchRefineFiltersBtn.hidden = !visibilityState.showSearchFilterAction;
    toggleCoordsBtn.setAttribute('aria-pressed', coordsDisplayEnabled ? 'true' : 'false');
    if (routePanel) routePanel.style.display = visibilityState.showRoutePanel ? 'block' : 'none';
    if (sessionToolkitPanel) sessionToolkitPanel.style.display = visibilityState.showToolkitPanel ? 'block' : 'none';
    if (gmPill) gmPill.style.display = visibilityState.showGMPill ? 'flex' : 'none';

    syncMobileMapMeta(mapInfo, visibilityState);
    syncMobileSheetActionState(visibilityState);
    syncMobileExploreVisibility();

    if (!visibilityState.showSearchControl) {
        closeSearchResults();
        if (isMobileLayoutActive) {
            closeMobileSearchPanel({ restoreFocus: false });
        }
    }

    if (!visibilityState.showSearchFilterAction) {
        if (filtersPanelVisible) {
            filtersPanelVisible = false;
            mobileFilterExpanded = false;
            poiFilterContainer.classList.remove('visible');
            toggleFiltersBtn.classList.remove('active');
            toggleFiltersBtn.setAttribute('aria-expanded', 'false');
        }
        syncMobileFilterState();
    }

    if (!advancedControlsUnlocked || isMobileLayoutActive) {
        if (filtersPanelVisible) {
            filtersPanelVisible = false;
            mobileFilterExpanded = false;
            poiFilterContainer.classList.remove('visible');
            toggleFiltersBtn.classList.remove('active');
            toggleFiltersBtn.setAttribute('aria-expanded', 'false');
        }
        syncMobileFilterState();
        mapBlurbElement.classList.remove('visible');
        toggleBlurbBtn.classList.remove('active');
        coordinateDisplay.style.display = 'none';
        setAuxPanelVisible(gmPill, false);
        setAuxPanelVisible(sessionToolkitPanel, false);
        if (activeFiltersContainer) {
            activeFiltersContainer.style.display = 'none';
            activeFiltersContainer.innerHTML = '';
        }
        if (isMobileLayoutActive) {
            mapBlurbElement.classList.remove('visible');
            toggleBlurbBtn.classList.remove('active');
        }
        updatePanelToggleButtons();
        if (!advancedControlsUnlocked) return;
    }

    if (!isMobileLayoutActive && mapInfo.latLonBounds) {
        coordinateDisplay.style.display = coordsDisplayEnabled ? 'block' : 'none';
    } else {
        coordinateDisplay.style.display = 'none';
    }
    updatePanelToggleButtons();
    clampFloatingPanels();
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
    if (!activeFiltersContainer || isEmbeddedView || isMobileLayoutActive) {
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
        if (searchRefineFiltersBtn.hidden) return;
        if (toggleFiltersBtn.style.display === 'none' && !isMobileLayoutActive) return;
        toggleFilterPanel();
    });
}

if (searchRefineClearBtn) {
    searchRefineClearBtn.addEventListener('click', (event) => {
        event.stopPropagation();
        poiSearchInput.value = '';
        setSearchScope(SEARCH_SCOPE_MAP);

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

function setActiveSearchResult(index) {
    activeSearchResultIndex = index;
    const items = Array.from(searchResultsContainer.querySelectorAll('.search-result-item'));
    items.forEach((item, itemIndex) => {
        const isActive = itemIndex === activeSearchResultIndex;
        item.classList.toggle('active', isActive);
        item.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });
}

function moveSearchResultSelection(direction) {
    if (!renderedSearchResults.length) return;
    const itemCount = renderedSearchResults.length;
    const nextIndex = activeSearchResultIndex < 0
        ? (direction > 0 ? 0 : itemCount - 1)
        : (activeSearchResultIndex + direction + itemCount) % itemCount;
    setActiveSearchResult(nextIndex);
    const activeItem = searchResultsContainer.querySelector(`.search-result-item[data-result-index="${nextIndex}"]`);
    if (activeItem && typeof activeItem.scrollIntoView === 'function') {
        activeItem.scrollIntoView({ block: 'nearest' });
    }
}

function selectSearchResult(index = activeSearchResultIndex) {
    const result = renderedSearchResults[index];
    if (!result || typeof result.onSelect !== 'function') return;
    result.onSelect();
    poiSearchInput.value = '';
    setSearchScope(SEARCH_SCOPE_MAP);
    closeSearchResults();
    closeMobileSheet({ restoreFocus: false });
    updateActiveFilterChips();
    syncMobileExploreVisibility();
}

function buildScopedSearchParams(entry) {
    const params = new URLSearchParams(window.location.search);
    ['view', 'poi', 'region', 'line', 'route', 'step', 'src', 'stype'].forEach((key) => params.delete(key));

    switch (entry.kind) {
        case 'poi':
            params.set('poi', entry.name);
            break;
        case 'region':
            params.set('region', entry.name);
            break;
        case 'line':
            params.set('line', entry.name);
            break;
        case 'route':
            params.set('route', entry.routeId || entry.itemId || entry.id);
            break;
        case 'step':
            params.set('route', entry.routeId);
            params.set('step', entry.itemId || entry.stepId);
            break;
        default:
            break;
    }

    return params;
}

function openAtlasSearchResult(entry) {
    const targetMap = findMapRecursive(mapData, entry.mapId);
    if (!isRenderableMapEntry(targetMap)) return;

    const params = buildScopedSearchParams(entry);
    const nextSearch = params.toString() ? `?${params.toString()}` : '';
    const nextHash = generateHash(entry.mapId, currentSidebarState);
    const nextUrl = buildAppUrlWithHash(nextHash, nextSearch);
    history.pushState(
        {
            mapId: entry.mapId,
            sidebarState: currentSidebarState,
            search: nextSearch,
            hash: nextHash
        },
        '',
        nextUrl
    );
    setSearchScope(SEARCH_SCOPE_MAP);
    loadMap(entry.mapId, false, targetMap);
    trackAnalytics('search_result_opened', {
        scope: SEARCH_SCOPE_ATLAS,
        kind: entry.kind,
        targetMapId: entry.mapId
    });
}

function renderSearchResults(term, results) {
    renderedSearchResults = results;
    activeSearchResultIndex = results.length > 0 ? 0 : -1;
    searchResultsContainer.innerHTML = '';

    if (!term) {
        closeSearchResults();
        syncMobileExploreVisibility();
        return;
    }

    if (results.length === 0) {
        const summary = document.createElement('div');
        summary.className = 'search-results-summary';
        summary.textContent = `0 results in ${getSearchScopeLabel()}`;
        searchResultsContainer.appendChild(summary);

        const emptyState = document.createElement('div');
        emptyState.className = 'search-results-empty';
        emptyState.textContent = `No ${getSearchScopeLabel().toLowerCase()} results match this search.`;
        searchResultsContainer.appendChild(emptyState);
    } else {
        const summary = document.createElement('div');
        summary.className = 'search-results-summary';
        summary.textContent = `${results.length} result${results.length === 1 ? '' : 's'} in ${getSearchScopeLabel()}`;
        searchResultsContainer.appendChild(summary);

        results.forEach((result, index) => {
            const resultItem = document.createElement('div');
            resultItem.className = 'search-result-item';
            resultItem.dataset.resultIndex = String(index);
            resultItem.tabIndex = -1;
            resultItem.setAttribute('role', 'option');
            resultItem.setAttribute('aria-selected', index === activeSearchResultIndex ? 'true' : 'false');

            const titleRow = document.createElement('div');
            titleRow.className = 'search-result-title';
            const titleLabel = document.createElement('span');
            titleLabel.className = 'search-result-label';
            titleLabel.innerHTML = highlightSearchText(result.title, term);

            const badge = document.createElement('span');
            badge.className = 'badge-kind';
            badge.textContent = result.badge;

            titleRow.appendChild(titleLabel);
            titleRow.appendChild(badge);

            const metaRow = document.createElement('div');
            metaRow.className = 'search-result-meta';
            metaRow.textContent = result.subtitle;

            resultItem.appendChild(titleRow);
            if (result.subtitle) {
                resultItem.appendChild(metaRow);
            }

            resultItem.addEventListener('mouseenter', () => setActiveSearchResult(index));
            resultItem.addEventListener('click', () => selectSearchResult(index));
            resultItem.addEventListener('keydown', (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    selectSearchResult(index);
                }
            });

            searchResultsContainer.appendChild(resultItem);
        });
    }

    searchResultsContainer.style.display = 'block';
    setActiveSearchResult(activeSearchResultIndex);
    syncMobileSearchResultsCardState();
    syncMobileExploreVisibility();

    const searchSignature = `${currentSearchScope}:${term}:${results.length}`;
    if (results.length > 0 && searchSignature !== lastTrackedSearchSignature) {
        lastTrackedSearchSignature = searchSignature;
        trackAnalytics('search_success', {
            term: poiSearchInput.value.trim(),
            scope: currentSearchScope,
            resultCount: results.length
        });
    }
}

function sortSearchResults(results) {
    return results
        .sort((a, b) => {
            if (b.score !== a.score) return b.score - a.score;
            const groupDelta = SEARCH_RESULT_GROUP_ORDER.indexOf(a.group) - SEARCH_RESULT_GROUP_ORDER.indexOf(b.group);
            if (groupDelta !== 0) return groupDelta;
            return a.title.localeCompare(b.title);
        })
        .slice(0, 40);
}

function updateVisibleMarkersAndSearch() {
    const hasMarkers = !!currentMarkerGroup && allMapMarkers.length > 0;
    const hasRegions = !!currentRegionGroup && currentRegionGroup.getLayers().length > 0;
    const hasLines = !!currentRoadGroup && currentRoadGroup.getLayers().length > 0;
    const hasRoutes = Array.isArray(currentRoutes) && currentRoutes.length > 0;
    const hasAtlasIndex = Array.isArray(atlasSearchIndex) && atlasSearchIndex.length > 0;
    const searchable = hasMarkers || hasRegions || hasLines || hasRoutes || hasAtlasIndex;

    if (!searchable) {
        searchControlContainer.style.display = 'none';
        closeMobileSheet({ restoreFocus: false });
        closeSearchResults();
        updateActiveFilterChips();
        syncMobileExploreVisibility();
        return;
    }

    searchControlContainer.style.display = 'block';
    const searchTerm = normalizeSearchValue(poiSearchInput.value);
    const results = [];

    const activeSpecificGroupFilters = new Set();
    poiFilterContainer.querySelectorAll('.poi-filter-checkbox:not(#filter-toggle-all):checked').forEach((checkbox) => {
        activeSpecificGroupFilters.add(checkbox.value);
    });
    const allPoiGroupsChecked = filterToggleAllCheckbox.checked && !filterToggleAllCheckbox.indeterminate;
    const searchFiltersCurrentMap = currentSearchScope === SEARCH_SCOPE_MAP && !!searchTerm;

    allMapMarkers.forEach((marker) => {
        const poi = marker.poiData;
        if (!poi) return;

        const poiGroup = getPoiGroup(poi.type);
        const groupMatch = allPoiGroupsChecked || activeSpecificGroupFilters.has(poiGroup);
        const match = computeSearchMatch(searchTerm, poi.name, `${poi.summary || ''} ${poi.description || ''}`);
        const isSearchMatch = !searchTerm || match.matched;

        if (markersVisible && groupMatch && (!searchFiltersCurrentMap || isSearchMatch)) {
            if (!currentMarkerGroup.hasLayer(marker)) currentMarkerGroup.addLayer(marker);
        } else if (currentMarkerGroup.hasLayer(marker)) {
            currentMarkerGroup.removeLayer(marker);
        }

        if (searchFiltersCurrentMap && groupMatch && match.matched) {
            results.push({
                group: 'poi',
                badge: 'POI',
                title: poi.name,
                subtitle: match.matchedByContent ? `Matched in ${poiGroup.toLowerCase()} details` : poiGroup,
                score: match.score,
                onSelect: () => {
                    map.flyTo(marker.getLatLng(), Math.max(map.getZoom(), 1));
                    marker.openPopup();
                }
            });
        }
    });

    const activeRegionTypeFilters = new Set();
    poiFilterContainer.querySelectorAll('.region-type-filter:checked').forEach((checkbox) => {
        activeRegionTypeFilters.add(checkbox.value);
    });
    const allRegionTypesChecked = filterToggleAllCheckbox.checked && !filterToggleAllCheckbox.indeterminate;

    if (currentRegionGroup) {
        currentRegionGroup.eachLayer((layer) => {
            const region = layer.regionData;
            if (!region || !region.name) return;

            const regionFilterValue = region.value || region.name;
            const typeMatch = allRegionTypesChecked || activeRegionTypeFilters.has(regionFilterValue);
            const match = computeSearchMatch(searchTerm, region.name, `${region.summary || ''} ${region.description || ''}`);

            if (searchFiltersCurrentMap && typeMatch && match.matched) {
                results.push({
                    group: 'region',
                    badge: 'Region',
                    title: region.name,
                    subtitle: match.matchedByContent ? `Matched in ${region.type || 'region'} description` : (region.value || region.type || 'Region'),
                    score: match.score,
                    onSelect: () => {
                        map.fitBounds(layer.getBounds(), { maxZoom: Math.max(map.getZoom(), 1) });
                        layer.openPopup();
                    }
                });
            }
        });
    }

    const activeLineTypeFilters = new Set();
    poiFilterContainer.querySelectorAll('.line-type-filter:checked').forEach((checkbox) => {
        activeLineTypeFilters.add(checkbox.value);
    });
    const allLineTypesChecked = filterToggleAllCheckbox.checked && !filterToggleAllCheckbox.indeterminate;

    if (currentRoadGroup) {
        currentRoadGroup.eachLayer((layer) => {
            const line = layer.roadData;
            if (!line) return;
            const lineName = line.name || line.type || 'Unnamed Line';
            const lineType = line.type || 'Unnamed Road Type';
            const typeMatch = allLineTypesChecked || activeLineTypeFilters.has(lineType);
            const match = computeSearchMatch(searchTerm, lineName, `${lineType} ${line.summary || ''} ${line.description || ''}`);

            if (searchFiltersCurrentMap && typeMatch && match.matched) {
                results.push({
                    group: 'line',
                    badge: 'Line',
                    title: lineName,
                    subtitle: match.matchedByContent ? `Matched in ${lineType.toLowerCase()} details` : lineType,
                    score: match.score,
                    onSelect: () => {
                        map.fitBounds(layer.getBounds(), { maxZoom: Math.max(map.getZoom(), 1) });
                        if (layer.getPopup()) layer.openPopup();
                    }
                });
            }
        });
    }

    if (searchFiltersCurrentMap && currentRoutes && currentRoutes.length > 0) {
        currentRoutes.forEach((route) => {
            const routeName = route.name || route.id;
            const routeMatch = computeSearchMatch(searchTerm, routeName, route.summary || '');
            if (routeMatch.matched) {
                results.push({
                    group: 'route',
                    badge: 'Route',
                    title: routeName,
                    subtitle: routeMatch.matchedByContent ? 'Matched in route summary' : 'Start route',
                    score: routeMatch.score,
                    onSelect: () => startRoute(route.id)
                });
            }

            route.steps.forEach((step) => {
                const stepTitle = step.title || step.id;
                const stepMatch = computeSearchMatch(searchTerm, stepTitle, step.body || '');
                if (!stepMatch.matched) return;
                results.push({
                    group: 'step',
                    badge: 'Step',
                    title: stepTitle,
                    subtitle: routeName,
                    score: stepMatch.score,
                    onSelect: () => startRoute(route.id, step.id)
                });
            });
        });
    }

    if (currentSearchScope === SEARCH_SCOPE_ATLAS && searchTerm) {
        atlasSearchIndex.forEach((entry) => {
            if (!visibilityAllowed(entry)) return;
            const match = computeSearchMatch(
                searchTerm,
                entry.name,
                `${entry.mapName || ''} ${entry.typeLabel || ''} ${entry.summary || ''} ${entry.description || ''}`
            );
            if (!match.matched) return;
            results.push({
                group: entry.kind,
                badge: entry.kind === 'map' ? 'Map' : (entry.typeLabel || entry.kind),
                title: entry.name,
                subtitle: entry.mapId === currentlyLoadedMapId
                    ? `${entry.mapName || 'Current map'}${match.matchedByContent ? ' • matched in details' : ''}`
                    : `${entry.mapName || entry.mapId}${match.matchedByContent ? ' • matched in details' : ''}`,
                score: match.score + (entry.kind === 'map' ? 10 : 0),
                onSelect: () => openAtlasSearchResult(entry)
            });
        });
    }

    if (!searchTerm) {
        setSearchScope(SEARCH_SCOPE_MAP);
        closeSearchResults();
    } else {
        renderSearchResults(searchTerm, sortSearchResults(results));
    }

    updateActiveFilterChips();
    syncMobileExploreVisibility();
}

// --- Route Mode Helpers ---
function renderRoutesPanel() {
    if (!routePanel || !routeSelect || !routeStepList) return;
    routeSelect.innerHTML = '';
    routeStepList.innerHTML = '';
    if (isMobileLayoutActive || !currentRoutes || currentRoutes.length === 0) {
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
                    navigateToMap(step.targetId, { preResolvedMap: targetMap, preserveSearch: true });
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
    let draggingPointerId = null;
    let offsetX = 0;
    let offsetY = 0;

    const positionPill = (clientX, clientY) => {
        const mapRect = mapElement.getBoundingClientRect();
        const pillRect = gmPill.getBoundingClientRect();
        const maxLeft = Math.max(0, mapRect.width - pillRect.width);
        const maxTop = Math.max(0, mapRect.height - pillRect.height);
        const left = Math.min(Math.max(0, clientX - mapRect.left - offsetX), maxLeft);
        const top = Math.min(Math.max(0, clientY - mapRect.top - offsetY), maxTop);
        gmPill.style.left = `${left}px`;
        gmPill.style.top = `${top}px`;
        gmPill.style.right = 'auto';
    };

    const onPointerMove = (event) => {
        if (draggingPointerId === null || event.pointerId !== draggingPointerId) return;
        positionPill(event.clientX, event.clientY);
    };

    const onPointerUp = (event) => {
        if (draggingPointerId === null || event.pointerId !== draggingPointerId) return;
        draggingPointerId = null;
        gmPill.classList.remove('dragging');
        dragHandle.releasePointerCapture?.(event.pointerId);
    };

    dragHandle.addEventListener('pointerdown', (event) => {
        if (event.target === gmToggleBtn) return;
        const pillRect = gmPill.getBoundingClientRect();
        draggingPointerId = event.pointerId;
        offsetX = event.clientX - pillRect.left;
        offsetY = event.clientY - pillRect.top;
        dragHandle.setPointerCapture?.(event.pointerId);
        gmPill.classList.add('dragging');
        event.preventDefault();
    });

    document.addEventListener('pointermove', onPointerMove);
    document.addEventListener('pointerup', onPointerUp);
    document.addEventListener('pointercancel', onPointerUp);
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
    const selectedMap = getMapRuntimeData(mapId);
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
const sharedLinkOpenSessionKeys = new Set();
const SHARE_RELAY_DEFAULT_COPY = 'Shared with you. Pass it on to your party.';

function getShareContextFromParams(params) {
    if (!(params instanceof URLSearchParams)) return null;

    const source = String(params.get('src') || '').trim().toLowerCase();
    const sharedType = String(params.get('stype') || '').trim().toLowerCase();

    if (source !== 'share') return null;
    if (!['poi', 'region', 'line', 'view'].includes(sharedType)) return null;

    if (sharedType === 'view') {
        const normalizedView = String(params.get('view') || '').trim();
        if (!normalizedView) return null;
        return {
            source,
            sharedType,
            featureType: 'view',
            featureName: 'current_view',
            view: normalizedView
        };
    }

    const featureName = String(params.get(sharedType) || '').trim();
    if (!featureName) return null;
    return {
        source,
        sharedType,
        featureType: sharedType,
        featureName
    };
}

function buildShareRelaySessionKey(context) {
    if (!context || typeof context !== 'object') return null;
    const sharedType = String(context.sharedType || '').trim().toLowerCase();
    if (!sharedType) return null;

    if (sharedType === 'view') {
        const normalizedView = String(context.view || '').trim();
        return normalizedView ? `view:${normalizedView}` : null;
    }

    const featureName = String(context.featureName || '').trim().toLowerCase();
    return featureName ? `${sharedType}:${featureName}` : null;
}

function isShareRelayDismissedForSession() {
    return safeGetSessionStorage(UX_STORAGE_KEYS.shareRelayDismissedSession) === 'true';
}

function markShareRelayDismissedForSession() {
    safeSetSessionStorage(UX_STORAGE_KEYS.shareRelayDismissedSession, 'true');
}

function hideShareRelayPrompt(reason = 'hidden') {
    activeShareRelayContext = null;
    if (!shareRelayCoachmark) return;

    shareRelayCoachmark.hidden = true;
    if (shareRelayCopy) {
        shareRelayCopy.textContent = SHARE_RELAY_DEFAULT_COPY;
    }
    if (shareRelayActionBtn && shareRelayActionBtn.dataset.originalInnerHtml) {
        shareRelayActionBtn.innerHTML = shareRelayActionBtn.dataset.originalInnerHtml;
    }

    if (reason === 'dismissed' || reason === 'completed') {
        markShareRelayDismissedForSession();
    }
}

function showShareRelayPrompt(context) {
    if (!context || isEmbeddedView || !shareRelayCoachmark || !shareRelayActionBtn || !shareRelayDismissBtn) {
        return;
    }
    if (isShareRelayDismissedForSession()) return;

    const sessionKey = buildShareRelaySessionKey(context);
    if (!sessionKey) return;

    activeShareRelayContext = context;
    if (shareRelayCopy) {
        const featureName = String(context.featureName || '').trim();
        shareRelayCopy.textContent = context.sharedType === 'view'
            ? 'Shared with you. Pass this map view to your party.'
            : `Shared with you: ${featureName}. Pass it on to your party.`;
    }
    shareRelayCoachmark.hidden = false;

    if (shownShareRelaySessionKeys.has(sessionKey)) return;
    shownShareRelaySessionKeys.add(sessionKey);
    trackAnalytics('share_relay_prompt_shown', {
        source: 'share',
        entryPoint: 'relay_prompt',
        sharedType: context.sharedType
    });
}

function trackShareLinkOpenFromParams(params, focusedType, focusedName) {
    if (!(params instanceof URLSearchParams)) return;

    const source = String(params.get('src') || '').trim().toLowerCase();
    const sharedType = String(params.get('stype') || '').trim().toLowerCase();
    const normalizedFocusedType = String(focusedType || '').trim().toLowerCase();
    const normalizedFocusedName = String(focusedName || '').trim();

    if (source !== 'share') return;
    if (!['poi', 'region', 'line'].includes(sharedType)) return;
    if (!normalizedFocusedType || sharedType !== normalizedFocusedType) return;
    if (!normalizedFocusedName) return;

    const sessionKey = `${sharedType}:${normalizedFocusedName.toLowerCase()}`;
    if (sharedLinkOpenSessionKeys.has(sessionKey)) return;
    sharedLinkOpenSessionKeys.add(sessionKey);

    trackAnalytics('share_link_opened', {
        source,
        sharedType,
        featureType: normalizedFocusedType,
        featureName: normalizedFocusedName
    });
}

function trackShareViewOpenFromParams(params, viewParam) {
    if (!(params instanceof URLSearchParams)) return;

    const source = String(params.get('src') || '').trim().toLowerCase();
    const sharedType = String(params.get('stype') || '').trim().toLowerCase();
    const normalizedView = String(viewParam || '').trim();

    if (source !== 'share') return;
    if (sharedType !== 'view') return;
    if (!normalizedView) return;

    const sessionKey = `view:${normalizedView}`;
    if (sharedLinkOpenSessionKeys.has(sessionKey)) return;
    sharedLinkOpenSessionKeys.add(sessionKey);

    trackAnalytics('share_link_opened', {
        source,
        sharedType,
        featureType: 'view',
        featureName: 'current_view',
        view: normalizedView
    });
}

function buildFeatureShareUrl(type, name) {
    const normalizedType = String(type || '').trim().toLowerCase();
    const normalizedName = String(name || '').trim();

    if (!['poi', 'region', 'line'].includes(normalizedType)) return null;
    if (!normalizedName) return null;

    const url = new URL(window.location.href);
    url.searchParams.delete('poi');
    url.searchParams.delete('region');
    url.searchParams.delete('line');
    url.searchParams.set(normalizedType, normalizedName);
    url.searchParams.set('src', 'share');
    url.searchParams.set('stype', normalizedType);
    return url.toString();
}

function buildCurrentViewShareUrl() {
    if (!map || !currentlyLoadedMapId) return null;

    const center = map.getCenter();
    const zoom = map.getZoom();
    const lat = parseFloat(center.lat.toFixed(4));
    const lng = parseFloat(center.lng.toFixed(4));
    const view = `${lat},${lng},${zoom}`;

    const url = new URL(window.location.href);
    url.searchParams.delete('poi');
    url.searchParams.delete('region');
    url.searchParams.delete('line');
    url.searchParams.set('view', view);
    url.searchParams.set('src', 'share');
    url.searchParams.set('stype', 'view');
    return url.toString();
}

function canUseNativeShare(shareUrl) {
    if (typeof navigator === 'undefined' || typeof navigator.share !== 'function') {
        return false;
    }
    if (typeof navigator.canShare === 'function') {
        try {
            return navigator.canShare({ url: shareUrl });
        } catch (error) {
            return false;
        }
    }
    return true;
}

function showShareButtonSuccessState(btn) {
    if (!btn) return;
    if (!btn.dataset.originalInnerHtml) {
        btn.dataset.originalInnerHtml = btn.innerHTML;
    }
    btn.innerHTML = '✔';
    if (btn.__shareResetTimeoutId) {
        clearTimeout(btn.__shareResetTimeoutId);
    }
    btn.__shareResetTimeoutId = setTimeout(() => {
        btn.innerHTML = btn.dataset.originalInnerHtml;
    }, 1500);
}

// Global function for onclick
window.copyFeatureLink = async function(btn, type, name) {
    const featureType = String(type || '').trim().toLowerCase();
    const featureName = String(name || '').trim();
    const shareUrl = buildFeatureShareUrl(featureType, featureName);

    if (!shareUrl) return;

    const nativeShareSupported = canUseNativeShare(shareUrl);
    trackAnalytics('share_clicked', {
        featureType,
        featureName,
        nativeShareSupported
    });

    if (nativeShareSupported) {
        const shareData = {
            title: `Hiraeth Maps: ${featureName}`,
            text: `Explore ${featureName} on the Hiraeth map.`,
            url: shareUrl
        };

        try {
            await navigator.share(shareData);
            showShareButtonSuccessState(btn);
            trackAnalytics('share_native_completed', { featureType, featureName });
            return;
        } catch (error) {
            const errorName = error && error.name ? String(error.name) : 'unknown';
            if (errorName === 'AbortError') {
                trackAnalytics('share_native_cancelled', { featureType, featureName });
                return;
            }
            console.warn('Native share failed; falling back to clipboard.', error);
            trackAnalytics('share_native_failed', { featureType, featureName, errorName });
        }
    }

    if (typeof navigator === 'undefined' || !navigator.clipboard || typeof navigator.clipboard.writeText !== 'function') {
        alert("Sharing is not supported in this browser.");
        trackAnalytics('share_copy_unavailable', { featureType, featureName });
        return;
    }

    try {
        await navigator.clipboard.writeText(shareUrl);
        showShareButtonSuccessState(btn);
        trackAnalytics('share_link_copied', { featureType, featureName });
    } catch (err) {
        console.error('Failed to copy link: ', err);
        alert("Failed to copy link to clipboard.");
    }
};

async function shareCurrentView(btn) {
    const shareUrl = buildCurrentViewShareUrl();
    if (!shareUrl) return;

    const featureType = 'view';
    const featureName = 'current_view';
    const nativeShareSupported = canUseNativeShare(shareUrl);
    trackAnalytics('share_clicked', {
        featureType,
        featureName,
        nativeShareSupported,
        entryPoint: 'map_controls'
    });

    if (nativeShareSupported) {
        const shareData = {
            title: 'Hiraeth Maps: Current View',
            text: 'Explore this map view on Hiraeth Maps.',
            url: shareUrl
        };

        try {
            await navigator.share(shareData);
            showShareButtonSuccessState(btn);
            trackAnalytics('share_native_completed', { featureType, featureName });
            return;
        } catch (error) {
            const errorName = error && error.name ? String(error.name) : 'unknown';
            if (errorName === 'AbortError') {
                trackAnalytics('share_native_cancelled', { featureType, featureName });
                return;
            }
            console.warn('Native share failed; falling back to clipboard.', error);
            trackAnalytics('share_native_failed', { featureType, featureName, errorName });
        }
    }

    if (typeof navigator === 'undefined' || !navigator.clipboard || typeof navigator.clipboard.writeText !== 'function') {
        alert("Sharing is not supported in this browser.");
        trackAnalytics('share_copy_unavailable', { featureType, featureName });
        return;
    }

    try {
        await navigator.clipboard.writeText(shareUrl);
        showShareButtonSuccessState(btn);
        trackAnalytics('share_link_copied', { featureType, featureName });
    } catch (err) {
        console.error('Failed to copy link: ', err);
        alert("Failed to copy link to clipboard.");
    }
}

async function relaySharedContext(btn) {
    const context = activeShareRelayContext;
    if (!context) return;

    const sharedType = String(context.sharedType || '').trim().toLowerCase();
    const featureType = String(context.featureType || '').trim().toLowerCase();
    const featureName = String(context.featureName || '').trim();
    const shareUrl = sharedType === 'view'
        ? buildCurrentViewShareUrl()
        : buildFeatureShareUrl(featureType, featureName);

    if (!shareUrl) return;

    const nativeShareSupported = canUseNativeShare(shareUrl);
    trackAnalytics('share_clicked', {
        featureType,
        featureName,
        nativeShareSupported,
        entryPoint: 'relay_prompt'
    });

    if (nativeShareSupported) {
        const shareData = {
            title: sharedType === 'view' ? 'Hiraeth Maps: Shared View' : `Hiraeth Maps: ${featureName}`,
            text: sharedType === 'view'
                ? 'Explore this shared map view on Hiraeth Maps.'
                : `Explore ${featureName} on the Hiraeth map.`,
            url: shareUrl
        };

        try {
            await navigator.share(shareData);
            showShareButtonSuccessState(btn);
            trackAnalytics('share_relay_completed', {
                sharedType,
                featureType,
                featureName,
                method: 'native'
            });
            hideShareRelayPrompt('completed');
            return;
        } catch (error) {
            const errorName = error && error.name ? String(error.name) : 'unknown';
            if (errorName === 'AbortError') {
                trackAnalytics('share_native_cancelled', { featureType, featureName, entryPoint: 'relay_prompt' });
                return;
            }
            console.warn('Native share failed; falling back to clipboard.', error);
            trackAnalytics('share_native_failed', { featureType, featureName, errorName, entryPoint: 'relay_prompt' });
        }
    }

    if (typeof navigator === 'undefined' || !navigator.clipboard || typeof navigator.clipboard.writeText !== 'function') {
        alert('Sharing is not supported in this browser.');
        trackAnalytics('share_copy_unavailable', { featureType, featureName, entryPoint: 'relay_prompt' });
        return;
    }

    try {
        await navigator.clipboard.writeText(shareUrl);
        showShareButtonSuccessState(btn);
        trackAnalytics('share_relay_completed', {
            sharedType,
            featureType,
            featureName,
            method: 'clipboard'
        });
        hideShareRelayPrompt('completed');
    } catch (err) {
        console.error('Failed to copy link: ', err);
        alert('Failed to copy link to clipboard.');
    }
}

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
        navigateToMap(trimmedMapId, { preResolvedMap: targetMap });
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
    let focusedType = '';
    let focusedName = '';

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
            focusedType = 'poi';
            focusedName = poiName;
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
             focusedType = 'region';
             focusedName = regionName;
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
             focusedType = 'line';
             focusedName = lineName;
         } else {
             console.warn("Line not found for focus:", lineName);
         }
    }
    if (focused) {
        trackShareLinkOpenFromParams(params, focusedType, focusedName);
        const shareContext = getShareContextFromParams(params);
        if (shareContext) {
            showShareRelayPrompt(shareContext);
        }
    } else {
        hideShareRelayPrompt('not_focused');
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
async function loadMap(mapId, updateHash = true, preResolvedMap = null) {
    hideShareRelayPrompt('map_loading');
    const requestedMapId = String(mapId || '').trim();
    const requestToken = ++loadRequestToken;
    const manifestEntry = preResolvedMap || findMapRecursive(mapData, requestedMapId);
    const loadStartedAt = performance.now();
    loadingMapId = requestedMapId;
    trackAnalytics('map_load_started', { mapId: requestedMapId });
    setMapAtmosphere(manifestEntry?.atmosphere || null);

    if (currentlyLoadedMapId && currentlyLoadedMapId !== requestedMapId) {
        trackAnalytics('map_switched', {
            fromMapId: currentlyLoadedMapId,
            toMapId: requestedMapId
        });
    }

    if (loadingIndicator) {
        loadingIndicator.style.display = 'flex';
        const progressBar = loadingIndicator.querySelector('.progress-bar');
        loadingProgress = 0;
        if (progressBar) progressBar.style.width = '0%';
        setLoadingMessage(
            manifestEntry ? `Loading "${manifestEntry.name}"...` : 'Loading map...',
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
    closeSearchResults();
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
    if (currentMapUnderlay) map.removeLayer(currentMapUnderlay);
    if (miniMapControl) miniMapControl.remove();
    miniMapControl = null;
    if (currentMarkerGroup) map.removeLayer(currentMarkerGroup);
    if (currentRegionGroup) map.removeLayer(currentRegionGroup);
    if (currentRoadGroup) map.removeLayer(currentRoadGroup);

    currentImageLayer = null;
    currentMapUnderlay = null;
    currentMarkerGroup = null;
    currentRegionGroup = null;
    currentRoadGroup = null;
    allMapMarkers = [];

    if (!manifestEntry || manifestEntry.status === 'coming-soon') {
        console.warn('Attempted to load unavailable map:', mapId);
        if (manifestEntry) alert(`The map "${manifestEntry.name}" is coming soon.`);
        if (loadingProgressInterval) clearInterval(loadingProgressInterval);
        loadingProgressInterval = null;
        loadingMapId = null;
        currentMapData = null;
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
        trackAnalytics('map_load_failed', { mapId: requestedMapId, reason: 'unavailable' });
        return;
    }

    if (requestedMapId === currentlyLoadedMapId && currentImageLayer) {
        loadingMapId = null;
        if (updateHash) {
            const newHash = generateHash(requestedMapId, currentSidebarState);
            const currentSearch = window.location.search;
            const newUrl = buildAppUrlWithHash(newHash, currentSearch);
            if (window.location.href !== new URL(newUrl, window.location.href).href) {
                history.replaceState(
                    {
                        mapId: requestedMapId,
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
        applySearchParamsToCurrentMap(new URLSearchParams(window.location.search));
        return;
    }

    let selectedMap = manifestEntry;
    try {
        selectedMap = await getMapDefinition(requestedMapId, manifestEntry);
    } catch (error) {
        if (requestToken !== loadRequestToken) return;
        console.error(`Failed to load map definition for ${requestedMapId}:`, error);
        if (loadingProgressInterval) clearInterval(loadingProgressInterval);
        loadingProgressInterval = null;
        currentlyLoadedMapId = null;
        currentMapData = null;
        setMapAtmosphere(null);
        toggleMarkersBtn.style.display = 'none';
        measureToolBtn.style.display = 'none';
        toggleFiltersBtn.style.display = 'none';
        searchControlContainer.style.display = 'none';
        setLoadingMessage(
            `Could not load "${manifestEntry.name || requestedMapId}" data. Check the map definition and press Retry.`,
            { showSpinner: false, showProgress: false, showRetry: true }
        );
        trackAnalytics('map_load_failed', { mapId: requestedMapId, reason: 'definition_error' });
        return;
    }

    if (requestToken !== loadRequestToken) {
        return;
    }

    currentMapData = selectedMap;
    setMapAtmosphere(selectedMap?.atmosphere || manifestEntry?.atmosphere || null);

    currentMarkerGroup = L.layerGroup();
    currentRegionGroup = L.layerGroup().addTo(map);
    currentRoadGroup = L.layerGroup().addTo(map);

    const mapHeight = selectedMap.height;
    const mapWidth = selectedMap.width;
    const mapImageUrl = getPreferredMapImageUrl(selectedMap);
    prefetchedImageUrls.add(withAssetVersion(mapImageUrl));
    const defaultImageUrl = String(selectedMap.imageUrl || '').trim();
    const usingAlternateMobileImage = !!defaultImageUrl && mapImageUrl !== defaultImageUrl;
    if (isNaN(mapHeight) || isNaN(mapWidth) || !mapImageUrl) {
        console.error(`Invalid dimensions or missing imageUrl for map ID ${requestedMapId}`);
        if (loadingProgressInterval) clearInterval(loadingProgressInterval);
        loadingProgressInterval = null;
        currentlyLoadedMapId = null;
        currentMapData = null;
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
        trackAnalytics('map_load_failed', { mapId: requestedMapId, reason: 'invalid_data' });
        return;
    }

    currentBounds = [[0, 0], [mapHeight, mapWidth]];
    currentMapUnderlay = L.rectangle(currentBounds, {
        stroke: false,
        fill: true,
        fillOpacity: 1,
        fillColor: getMapBackgroundColor(selectedMap),
        color: getMapBackgroundColor(selectedMap),
        interactive: false,
        pane: 'tilePane'
    });
    currentImageLayer = L.imageOverlay(mapImageUrl, currentBounds);

    const preloadImg = new Image();
    let loadingComplete = false;
    let loadingTimeout = null;

    function finishLoading() {
        if (loadingComplete) return;
        loadingComplete = true;
        clearTimeout(loadingTimeout);

        // Defensive: if layers got detached during async startup, attach them again.
        if (currentMapUnderlay && !map.hasLayer(currentMapUnderlay)) {
            currentMapUnderlay.addTo(map);
        }
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

        applySearchParamsToCurrentMap(new URLSearchParams(window.location.search));

        const miniMapLayer = L.imageOverlay(mapImageUrl, currentBounds);
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
            mapId: requestedMapId,
            mapName: selectedMap.name,
            imageVariant: usingAlternateMobileImage ? 'mobile' : 'default',
            durationMs: Math.round(performance.now() - loadStartedAt)
        });
        clampFloatingPanels();
    }

    preloadImg.onload = function () { finishLoading(); };
    currentImageLayer.on('load', function () { finishLoading(); });
    currentImageLayer.on('error', function () {
        if (loadingComplete) return;
        loadingComplete = true;
        clearTimeout(loadingTimeout);
        console.error('Image overlay failed to load:', mapImageUrl);
        if (loadingProgressInterval) clearInterval(loadingProgressInterval);
        loadingProgressInterval = null;
        setLoadingMessage(
            `Could not load "${selectedMap.name}" image. Check the image path and press Retry.`,
            { showSpinner: false, showProgress: false, showRetry: true }
        );
        if (currentImageLayer) map.removeLayer(currentImageLayer);
        if (currentMapUnderlay) map.removeLayer(currentMapUnderlay);
        currentImageLayer = null;
        currentMapUnderlay = null;
        currentlyLoadedMapId = null;
        currentMapData = null;
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
        trackAnalytics('map_load_failed', { mapId: requestedMapId, reason: 'image_error' });
    });

    loadingTimeout = setTimeout(() => {
        console.warn('Loading fallback timer triggered.');
        finishLoading();
    }, 8000);

    currentMapUnderlay.addTo(map);
    preloadImg.src = mapImageUrl;
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
    populateFilters(visiblePointsCache, requestedMapId);

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
                        marker.bindTooltip(createPoiTooltipContent(point), getPoiTooltipOptions());
                        attachPoiTooltipBehavior(marker);
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

    addRegionsToMap(requestedMapId);
    addRoadsToMap(requestedMapId);
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
        if (mobileMapBlurbPanel) {
            mobileMapBlurbPanel.innerHTML = selectedMap.blurb;
        }
    } else {
        mapBlurbElement.innerHTML = '';
        if (mobileMapBlurbPanel) {
            mobileMapBlurbPanel.innerHTML = '';
        }
        mapBlurbElement.classList.remove('visible');
        toggleBlurbBtn.classList.remove('active');
    }
    setMobileMapBlurbExpanded(false);

    updateCurrentControlVisibility(selectedMap);
    updateActiveFilterChips();

    document.querySelectorAll('#map-list .map-item, #map-list .folder-header').forEach(item => item.classList.remove('active'));
    const activeMapItem = document.querySelector(`#map-list .map-item[data-map-id="${requestedMapId}"]`);
    const activeFolderHeader = document.querySelector(`#map-list .folder-header[data-map-id="${requestedMapId}"]`);
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

    currentlyLoadedMapId = requestedMapId;
    safeSetStorage(UX_STORAGE_KEYS.lastMapId, requestedMapId);
    loadingMapId = null;
    schedulePostLoadPrefetch(selectedMap);

    if (!isEmbeddedView && window.innerWidth <= MOBILE_LAYOUT_BREAKPOINT && !container.classList.contains('sidebar-collapsed')) {
        setSidebarState('c', false);
    }

    if (updateHash) {
        const newHash = generateHash(requestedMapId, currentSidebarState);
        const currentSearch = window.location.search;
        const newUrl = buildAppUrlWithHash(newHash, currentSearch);
        history.pushState(
            {
                mapId: requestedMapId,
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

    const selectedMap = getMapRuntimeData(mapId);
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
                    navigateToMap(item.id);
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
                    navigateToMap(item.id);
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
    if (isMobileLayoutActive) {
        if (mobileSearchPanelOpen) {
            closeMobileSearchPanel({ restoreFocus: true });
        } else {
            openMobileSearchPanel({ focusSearch: true });
        }
        return;
    }
    unlockAdvancedControls('sidebar_toggle');
    const newState = container.classList.contains('sidebar-collapsed') ? 'o' : 'c';
    setSidebarState(newState, true);
});

if (mobileMapsLauncherBtn) {
    mobileMapsLauncherBtn.addEventListener('click', (event) => {
        event.stopPropagation();
        if (!isMobileLayoutActive) return;
        if (mobileMapsSheetOpen) {
            closeMobileMapsSheet({ restoreFocus: false });
            return;
        }
        openMobileMapsSheet();
    });
}

if (mobileSearchPanelCloseBtn) {
    mobileSearchPanelCloseBtn.addEventListener('click', (event) => {
        event.stopPropagation();
        closeMobileSearchPanel({ restoreFocus: true });
    });
}

if (mobileMapsSheetCloseBtn) {
    mobileMapsSheetCloseBtn.addEventListener('click', (event) => {
        event.stopPropagation();
        closeMobileMapsSheet({ restoreFocus: true });
    });
}

if (sidebarBackdrop) {
    sidebarBackdrop.addEventListener('click', () => {
        closeMobileSearchPanel({ restoreFocus: true });
        closeMobileMapsSheet({ restoreFocus: false });
        if (!isMobileLayoutActive && !container.classList.contains('sidebar-collapsed')) {
            setSidebarState('c', true);
        }
    });
}

window.addEventListener('resize', debounce(syncSidebarBackdropState, 120));
window.addEventListener('resize', debounce(positionFilterPanel, 120));
window.addEventListener('resize', debounce(clampFloatingPanels, 120));
window.addEventListener('orientationchange', () => {
    setTimeout(() => {
        syncSidebarBackdropState();
        positionFilterPanel();
        clampFloatingPanels();
    }, 120);
});
if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', debounce(() => {
        updateMobileLayoutState();
        clampFloatingPanels();
    }, 80));
}
document.addEventListener('touchstart', markControlTouch, { passive: true, capture: true });
document.addEventListener('pointerdown', markControlTouch, { capture: true });

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
    updateMapUnderlayColor(getMapRuntimeData(currentlyLoadedMapId));

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
        ensureAmbientTracksLoaded();
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
function ensureAmbientAudioLoaded(audioElement) {
    if (!audioElement) return;
    const source = audioElement.querySelector('source[data-src]');
    if (!source) return;
    if (source.dataset.loaded === 'true') return;

    const src = String(source.dataset.src || '').trim();
    if (!src) return;

    source.src = withAssetVersion(src);
    source.dataset.loaded = 'true';
    audioElement.load();
}

function ensureAmbientTracksLoaded() {
    ensureAmbientAudioLoaded(lightAmbient);
    ensureAmbientAudioLoaded(darkAmbient);
}

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

    const selectedMap = getMapRuntimeData(mapId);
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

function canUseSoundControlsNow() {
    return !isEmbeddedView && (advancedControlsUnlocked || isMobileLayoutActive);
}

function syncMobileSoundButtonIcon(enabled) {
    const icon = mobileSoundBtn?.querySelector('.ui-icon');
    if (!icon) return;
    icon.setAttribute('data-lucide', enabled ? 'volume-2' : 'volume-x');
    refreshLucideIcons();
}

function applySoundEnabledState(nextEnabled, {
    trackEvent = true
} = {}) {
    soundEnabled = !!nextEnabled;
    safeSetStorage(UX_STORAGE_KEYS.soundEnabled, String(soundEnabled));

    if (soundEnabled) {
        ensureAmbientTracksLoaded();
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

    if (mobileSoundBtn) {
        mobileSoundBtn.classList.toggle('active', soundEnabled);
        mobileSoundBtn.setAttribute('aria-pressed', soundEnabled ? 'true' : 'false');
    }
    syncMobileSoundButtonIcon(soundEnabled);

    if (trackEvent) {
        trackAnalytics('sound_toggled', { enabled: soundEnabled });
    }
}

function initializeSoundState() {
    const setSoundIcon = (enabled) => {
        if (!soundIcon) return;
        soundIcon.innerHTML = `<i class="ui-icon" data-lucide="${enabled ? 'volume-2' : 'volume-x'}" aria-hidden="true"></i>`;
        refreshLucideIcons();
        if (mobileSoundBtn) {
            mobileSoundBtn.classList.toggle('active', enabled);
            mobileSoundBtn.setAttribute('aria-pressed', enabled ? 'true' : 'false');
        }
        syncMobileSoundButtonIcon(enabled);
    };

    if (isEmbeddedView) {
        soundEnabled = false; // Ensure state reflects no sound
        // Set icon/title to muted state (even though button is hidden)
        setSoundIcon(false);
        if (toggleSoundBtn) toggleSoundBtn.title = "Unmute Sound"; // Check if button exists before setting title
        return; // Exit early, do not proceed with sound logic
    }

    const savedSoundState = safeGetStorage(UX_STORAGE_KEYS.soundEnabled);
    soundEnabled = savedSoundState === 'true'; // Convert string to boolean
    const canUseSoundNow = canUseSoundControlsNow();

    // Set initial volume to 0 to prevent autoplay issues on load
    lightAmbient.volume = 0;
    darkAmbient.volume = 0;

    if (soundEnabled && canUseSoundNow) {
        ensureAmbientTracksLoaded();
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
    if (toggleSoundBtn) toggleSoundBtn.style.display = (advancedControlsUnlocked && !isEmbeddedView && !isMobileLayoutActive) ? 'block' : 'none';
}

if (toggleSoundBtn) {
    toggleSoundBtn.addEventListener('click', (e) => {
        unlockAdvancedControls('sound_toggle');
        e.stopPropagation();
        applySoundEnabledState(!soundEnabled);
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
    // In Leaflet CRS.Simple, lat=0 is the bottom and lat=mapHeight is the top.
    // Interpolate from south (bottom) to north (top).
    const lat = south + (e.latlng.lat / mapHeight) * (north - south);
    lockedCoords = { lat, lon };
    updateCoordinateDisplay(lat, lon);
}

// --- Map Click Handler ---
map.on('click', function (e) {
    if (shouldIgnoreMapPointerEvent(e)) return;
    closeMobileSearchPanel({ restoreFocus: false });
    closeMobileMapsSheet({ restoreFocus: false });
    if (mapBlurbElement.classList.contains('visible')) {
        mapBlurbElement.classList.remove('visible');
        toggleBlurbBtn.classList.remove('active');
    }
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
        closeSearchResults();
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

if (shareViewBtn) {
    shareViewBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        unlockAdvancedControls('share_view');
        if (shareViewBtn.style.display === 'none') return;
        await shareCurrentView(shareViewBtn);
    });
}

if (mobileMarkersBtn) {
    mobileMarkersBtn.addEventListener('click', (event) => {
        event.stopPropagation();
        if (mobileMarkersBtn.hidden || mobileMarkersBtn.disabled) return;
        toggleMarkersVisibility();
    });
}

if (mobileMeasureBtn) {
    mobileMeasureBtn.addEventListener('click', (event) => {
        event.stopPropagation();
        if (mobileMeasureBtn.hidden || mobileMeasureBtn.disabled) return;
        toggleMeasurementTool();
    });
}

if (mobileShareViewBtn) {
    mobileShareViewBtn.addEventListener('click', async (event) => {
        event.stopPropagation();
        if (mobileShareViewBtn.hidden || mobileShareViewBtn.disabled) return;
        await shareCurrentView(mobileShareViewBtn);
    });
}

if (mobileSoundBtn) {
    mobileSoundBtn.addEventListener('click', (event) => {
        event.stopPropagation();
        if (mobileSoundBtn.hidden || mobileSoundBtn.disabled) return;
        applySoundEnabledState(!soundEnabled);
    });
}

if (mobileCoordsBtn) {
    mobileCoordsBtn.addEventListener('click', (event) => {
        event.stopPropagation();
        if (mobileCoordsBtn.hidden || mobileCoordsBtn.disabled) return;
        setCoordsDisplayVisible(!coordsDisplayEnabled);
    });
}

if (mobileHelpBtn) {
    mobileHelpBtn.addEventListener('click', (event) => {
        event.stopPropagation();
        if (openAboutModal) openAboutModal('guide', 'mobile_sheet');
    });
}

if (mobileMapBlurbToggleBtn) {
    mobileMapBlurbToggleBtn.addEventListener('click', (event) => {
        event.stopPropagation();
        const expanded = mobileMapBlurbToggleBtn.getAttribute('aria-expanded') === 'true';
        setMobileMapBlurbExpanded(!expanded);
    });
}

// --- Handle Hash Changes / Back/Forward Navigation ---
window.addEventListener('popstate', (event) => {
    const { mapId: hashMpId, sidebarState: hashSidebarState } = parseHash(); // Re-parse hash
    const targetMapId = getHistoryStateValue(event.state, 'mapId', hashMpId);
    const targetSidebarState = getHistoryStateValue(event.state, 'sidebarState', hashSidebarState);


    if (targetMapId !== currentlyLoadedMapId) {
        loadMap(targetMapId || '', false); // Load map without pushing new state
    } else {
        applySearchParamsToCurrentMap(new URLSearchParams(window.location.search));
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
        mobile: window.innerWidth <= MOBILE_LAYOUT_BREAKPOINT
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
function toggleMarkersVisibility() {
    markersVisible = !markersVisible;
    regionsVisible = markersVisible; // Sync regions with markers

    toggleMarkersBtn.title = markersVisible ? "Hide Markers & Regions" : "Show Markers & Regions";
    toggleMarkersBtn.setAttribute('aria-label', markersVisible ? "Hide Markers & Regions" : "Show Markers & Regions");
    toggleMarkersBtn.classList.toggle('markers-hidden', !markersVisible);

    updateVisibleRegions(); // Update regions visibility
    updateVisibleMarkersAndSearch(); // Update marker visibility

    if (mobileMarkersBtn) {
        mobileMarkersBtn.classList.toggle('active', markersVisible);
        mobileMarkersBtn.setAttribute('aria-pressed', markersVisible ? 'true' : 'false');
    }
    trackAnalytics('markers_toggled', { visible: markersVisible });
}

toggleMarkersBtn.addEventListener('click', () => {
    unlockAdvancedControls('markers_toggle');
    toggleMarkersVisibility();
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
    if (isMobileLayoutActive && !mobileSearchPanelOpen) {
        openMobileSearchPanel({ focusSearch: false });
    }
    filtersPanelVisible = !filtersPanelVisible;
    mobileFilterExpanded = isMobileLayoutActive ? filtersPanelVisible : false;
    poiFilterContainer.classList.toggle('visible', filtersPanelVisible);
    toggleFiltersBtn.classList.toggle('active', filtersPanelVisible);
    toggleFiltersBtn.title = filtersPanelVisible ? "Hide Filters" : "Show Filters";
    toggleFiltersBtn.setAttribute('aria-label', filtersPanelVisible ? "Hide Filters" : "Show Filters");
    toggleFiltersBtn.setAttribute('aria-expanded', filtersPanelVisible);
    syncMobileFilterState();
    safeSetStorage(UX_STORAGE_KEYS.filterPanelOpen, String(filtersPanelVisible));
    if (filtersPanelVisible) {
        positionFilterPanel();
    }
    clampFloatingPanels();
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
    if (isMobileLayoutActive && !mobileSearchPanelOpen) {
        openMobileSearchPanel({ focusSearch: false });
    }
});
poiSearchInput.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowDown') {
        event.preventDefault();
        moveSearchResultSelection(1);
        return;
    }
    if (event.key === 'ArrowUp') {
        event.preventDefault();
        moveSearchResultSelection(-1);
        return;
    }
    if (event.key === 'Enter' && activeSearchResultIndex >= 0) {
        event.preventDefault();
        selectSearchResult(activeSearchResultIndex);
        return;
    }
    if (event.key === 'Escape') {
        event.preventDefault();
        closeSearchResults();
        poiSearchInput.blur();
    }
});
poiSearchInput.addEventListener('click', (e) => e.stopPropagation());
searchResultsContainer.addEventListener('click', (e) => e.stopPropagation());
if (searchScopeAtlasBtn) {
    searchScopeAtlasBtn.addEventListener('click', (event) => {
        event.stopPropagation();
        const nextScope = currentSearchScope === SEARCH_SCOPE_ATLAS ? SEARCH_SCOPE_MAP : SEARCH_SCOPE_ATLAS;
        setSearchScope(nextScope);
        updateVisibleMarkersAndSearch();
        poiSearchInput.focus();
    });
}
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
    if (shouldIgnoreMapPointerEvent(e)) return; // Ignore clicks on controls

    const clickPoint = e.latlng;
    const currentMapInfo = getMapRuntimeData(currentlyLoadedMapId);
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

    if (mobileMeasureBtn) {
        mobileMeasureBtn.classList.toggle('active', isMeasuringMultiPoint);
        mobileMeasureBtn.setAttribute('aria-pressed', isMeasuringMultiPoint ? 'true' : 'false');
    }
    trackAnalytics('measurement_toggled', { enabled: isMeasuringMultiPoint });
}

function handleMultiPointMeasureClick(e) {
    if (!isMeasuringMultiPoint || !currentlyLoadedMapId) return;
    if (shouldIgnoreMapPointerEvent(e)) return;

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

    const currentMapInfo = getMapRuntimeData(currentlyLoadedMapId);
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
    const currentMapInfo = getMapRuntimeData(currentlyLoadedMapId);
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

        const atlas = await fetchJsonAsset('maps/atlas-index.json');
        if (!atlas || !Array.isArray(atlas.tree)) {
            throw new Error('Atlas index is missing a valid tree.');
        }
        prefetchedJsonUrls.add(withAssetVersion('maps/atlas-index.json'));

        if (loadingIndicator && loadingIndicator.querySelector('.progress-bar')) {
            loadingIndicator.querySelector('.progress-bar').style.width = '30%';
            setLoadingMessage('Processing map data...', {
                showSpinner: true,
                showProgress: true,
                showRetry: false
            });
        }

        mapData = atlas.tree;
        atlasSearchIndex = Array.isArray(atlas.searchIndex) ? atlas.searchIndex : [];

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

        if (shareRelayActionBtn) {
            shareRelayActionBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                await relaySharedContext(shareRelayActionBtn);
            });
        }

        if (shareRelayDismissBtn) {
            shareRelayDismissBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                hideShareRelayPrompt('dismissed');
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
                    closeSearchResults();
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
                        if (isMobileLayoutActive) {
                            openMobileSheet({ mode: 'explore', focusSearch: true });
                        } else {
                            poiSearchInput.focus();
                        }
                        e.preventDefault();
                    }
                    break;
            }

            // Example for Ctrl/Cmd + F (if you want to override browser find for your search)
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
                if (searchControlContainer && searchControlContainer.style.display !== 'none' && poiSearchInput) {
                    if (isMobileLayoutActive) {
                        openMobileSheet({ mode: 'explore', focusSearch: true });
                    } else {
                        poiSearchInput.focus();
                    }
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
    isEmbeddedView = isEmbedModeFromUrl();
    if (bodyElement) bodyElement.classList.toggle('embedded-view', isEmbeddedView);
    if (typeof document !== 'undefined') {
        document.documentElement.classList.toggle('embedded-view', isEmbeddedView);
    }
    if (isEmbeddedView && container) {
        container.classList.add('sidebar-collapsed');
    }
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
    closeSearchResults();
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
            if (shouldAutoOpenOnboardingGuide({
                isEmbedded: isEmbeddedView,
                isMobileLayout: isMobileLayoutActive,
                hasSeenOnboarding
            })) {
                setTimeout(() => {
                    if (openAboutModal) openAboutModal('guide', 'onboarding_auto');
                }, 500);
            }
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
registerServiceWorker();
loadMapData();
