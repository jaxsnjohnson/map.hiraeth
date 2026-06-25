const { performance } = require('node:perf_hooks');
const { JSDOM } = require('jsdom');

const groupCount = Number.parseInt(process.env.REGION_FILTER_BENCH_GROUPS || '180', 10);
const childrenPerGroup = Number.parseInt(process.env.REGION_FILTER_BENCH_CHILDREN || '24', 10);
const rounds = Number.parseInt(process.env.REGION_FILTER_BENCH_ROUNDS || '9', 10);

function buildRegionFilterDOM(mapChildren) {
    const { document } = (new JSDOM('<!doctype html><div id="filters"></div>')).window;
    const container = document.getElementById('filters');
    const childMap = new WeakMap();
    const groupCheckboxes = [];

    for (let groupIndex = 0; groupIndex < groupCount; groupIndex += 1) {
        const groupName = `region-group-${groupIndex}`;
        const groupContainer = document.createElement('div');
        groupContainer.className = 'filter-group closed';

        const groupHeader = document.createElement('div');
        groupHeader.className = 'filter-group-header';

        const groupCheckbox = document.createElement('input');
        groupCheckbox.type = 'checkbox';
        groupCheckbox.value = groupName;
        groupCheckbox.checked = true;
        groupCheckbox.className = 'region-group-filter';

        groupHeader.appendChild(groupCheckbox);
        groupContainer.appendChild(groupHeader);

        const nestedList = document.createElement('div');
        nestedList.className = 'nested-filter-list';
        const nestedCheckboxes = [];

        for (let childIndex = 0; childIndex < childrenPerGroup; childIndex += 1) {
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.value = `region-${groupIndex}-${childIndex}`;
            checkbox.checked = true;
            checkbox.className = 'region-type-filter';
            checkbox.dataset.group = groupName;
            nestedCheckboxes.push(checkbox);
            nestedList.appendChild(checkbox);
        }

        groupContainer.appendChild(nestedList);
        container.appendChild(groupContainer);
        groupCheckboxes.push(groupCheckbox);

        if (mapChildren) {
            childMap.set(groupCheckbox, nestedCheckboxes);
        }
    }

    return { childMap, groupCheckboxes };
}

function runLegacyToggle(groupCheckboxes, checked) {
    let checksum = 0;

    for (let i = 0; i < groupCheckboxes.length; i += 1) {
        const target = groupCheckboxes[i];
        const groupName = target.value;
        const groupContainer = target.closest('.filter-group');
        if (groupContainer && !groupContainer._cachedNestedCheckboxes) {
            groupContainer._cachedNestedCheckboxes = groupContainer.querySelectorAll('.region-type-filter');
        }

        const nestedCheckboxes = groupContainer ? groupContainer._cachedNestedCheckboxes : [];
        for (let j = 0; j < nestedCheckboxes.length; j += 1) {
            const checkbox = nestedCheckboxes[j];
            if (checkbox.dataset.group === groupName) {
                checkbox.checked = checked;
                checksum += checkbox.checked ? 1 : 3;
            }
        }
    }

    return checksum;
}

function runMappedToggle(groupCheckboxes, childMap, checked) {
    let checksum = 0;

    for (let i = 0; i < groupCheckboxes.length; i += 1) {
        const target = groupCheckboxes[i];
        const groupName = target.value;
        const nestedCheckboxes = childMap.get(target) || [];
        for (let j = 0; j < nestedCheckboxes.length; j += 1) {
            const checkbox = nestedCheckboxes[j];
            if (checkbox.dataset.group === groupName) {
                checkbox.checked = checked;
                checksum += checkbox.checked ? 1 : 3;
            }
        }
    }

    return checksum;
}

function median(values) {
    const sorted = [...values].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0
        ? (sorted[middle - 1] + sorted[middle]) / 2
        : sorted[middle];
}

function measureTogglePath(label, buildMapped, runner) {
    const durations = [];
    let checksum = 0;

    for (let round = 0; round < rounds; round += 1) {
        const setup = buildRegionFilterDOM(buildMapped);
        const start = performance.now();
        checksum = runner(setup, round % 2 === 0);
        durations.push(performance.now() - start);
    }

    return {
        label,
        medianMs: median(durations),
        checksum
    };
}

function measurePopulateAndToggle(label, buildMapped, runner) {
    const durations = [];
    let checksum = 0;

    for (let round = 0; round < rounds; round += 1) {
        const start = performance.now();
        const setup = buildRegionFilterDOM(buildMapped);
        checksum = runner(setup, round % 2 === 0);
        durations.push(performance.now() - start);
    }

    return {
        label,
        medianMs: median(durations),
        checksum
    };
}

function printComparison(name, legacy, mapped) {
    if (legacy.checksum !== mapped.checksum) {
        throw new Error(`${name} checksums diverged: legacy=${legacy.checksum}, mapped=${mapped.checksum}`);
    }

    const delta = legacy.medianMs - mapped.medianMs;
    const percent = legacy.medianMs === 0 ? 0 : (delta / legacy.medianMs) * 100;
    console.log(`${name}:`);
    console.log(`  Legacy median: ${legacy.medianMs.toFixed(2)} ms`);
    console.log(`  Mapped median: ${mapped.medianMs.toFixed(2)} ms`);
    console.log(`  Delta: ${delta.toFixed(2)} ms (${percent.toFixed(2)}%)`);
}

const legacyToggle = measureTogglePath('legacy', false, (setup, checked) => runLegacyToggle(setup.groupCheckboxes, checked));
const mappedToggle = measureTogglePath('mapped', true, (setup, checked) => runMappedToggle(setup.groupCheckboxes, setup.childMap, checked));
const legacyEndToEnd = measurePopulateAndToggle('legacy', false, (setup, checked) => runLegacyToggle(setup.groupCheckboxes, checked));
const mappedEndToEnd = measurePopulateAndToggle('mapped', true, (setup, checked) => runMappedToggle(setup.groupCheckboxes, setup.childMap, checked));

console.log(`Groups: ${groupCount}`);
console.log(`Children per group: ${childrenPerGroup}`);
console.log(`Rounds: ${rounds}`);
printComparison('First parent-toggle path', legacyToggle, mappedToggle);
printComparison('Populate plus first parent-toggle path', legacyEndToEnd, mappedEndToEnd);
