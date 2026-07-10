(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
        return;
    }
    root.SharedUtils = factory();
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    function withAssetVersion(url, versionOverride = '') {
        const fallbackVersion = typeof window !== 'undefined' && window.APP_ASSET_VERSION
            ? window.APP_ASSET_VERSION
            : '0';
        const version = encodeURIComponent(String(versionOverride || fallbackVersion));
        const rawUrl = String(url);
        const hashIndex = rawUrl.indexOf('#');
        const pathAndQuery = hashIndex >= 0 ? rawUrl.slice(0, hashIndex) : rawUrl;
        const hash = hashIndex >= 0 ? rawUrl.slice(hashIndex) : '';
        if (/[?&]v=[^&#]*/.test(pathAndQuery)) {
            return `${pathAndQuery.replace(/([?&])v=[^&#]*/, `$1v=${version}`)}${hash}`;
        }
        const separator = pathAndQuery.includes('?') ? '&' : '?';
        return `${pathAndQuery}${separator}v=${version}${hash}`;
    }

    async function fetchJsonAsset(url) {
        const response = await fetch(withAssetVersion(url));
        if (!response.ok) {
            throw new Error(`Failed to load ${url}: ${response.status} ${response.statusText}`);
        }
        return response.json();
    }


    function debounce(func, wait) {
        let timeout;
        return function(...args) {
            const context = this;
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(context, args), wait);
        };
    }

    return {
        debounce,
        withAssetVersion,
        fetchJsonAsset
    };
}));
