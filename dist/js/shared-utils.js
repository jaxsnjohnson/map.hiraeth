(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
        return;
    }
    root.SharedUtils = factory();
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    function withAssetVersion(url) {
        const version = typeof window !== 'undefined' && window.APP_ASSET_VERSION
            ? encodeURIComponent(window.APP_ASSET_VERSION)
            : '0';
        const separator = String(url).includes('?') ? '&' : '?';
        return `${url}${separator}v=${version}`;
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
