// =====================================
// Spiders Tools – Application Logic
// =====================================
//
// This file controls:
//   • Loading data (local defaults + spiders-data.json override)
//   • "Fails" screen: model → tester → fail explanation (+ search)
//   • "Calculators" screen: pallet-count and end-of-day helpers
//   • Simple hash-based navigation between tabs
//   • Visual transitions between screens + button press animation
//

// Main content container where templates are rendered
const content = document.getElementById('content');

// Track which screen is currently shown so we can animate direction
let currentScreen = 'fails';

// -------------------------------------
// Data: defaults + optional JSON override
// -------------------------------------

// Default in-app data, used if spiders-data.json is missing
const DEFAULT_DATA = {
    models: [
        {
            id: 'generic',
            label: 'Generic Model',
            testers: [
                {
                    id: 'board',
                    label: 'Board Tester',
                    fails: [
                        {
                            id: 'no-boot',
                            label: 'No Boot',
                            info: 'Check power rails, shorts to ground, and firmware programming.'
                        },
                        {
                            id: 'usb-fail',
                            label: 'USB Fail',
                            info: 'Inspect connector solder joints and ESD diodes; verify 5V and data lines.'
                        }
                    ]
                },
                {
                    id: 'smoke',
                    label: 'Smoke Box',
                    fails: [
                        {
                            id: 'flag-check',
                            label: 'Flag Check',
                            info: 'Flag sensor not detected or flag out of position. Verify flag is seated, check optical sensor alignment, ensure wiring/connector is secure, and clean dust from the sensor window.'
                        },
                        {
                            id: 'leak',
                            label: 'Leak Detected',
                            info: 'Inspect gasket, hose connections, and enclosure screws; re-seat and retest.'
                        }
                    ]
                },
                {
                    id: 'function',
                    label: 'Function Tester',
                    fails: [
                        {
                            id: 'calibration',
                            label: 'Calibration Out',
                            info: 'Run calibration procedure. If still out, verify reference standard and replace the suspect module.'
                        },
                        {
                            id: 'button-dead',
                            label: 'Button Not Responding',
                            info: 'Check switch flex cable and connector; test continuity; replace switch if open.'
                        }
                    ]
                }
            ]
        }
    ],
    calculatorModels: [
        { id: 'EI3016', label: 'EI3016', rows: 10, packs: 21, units: 4 },
        { id: 'EI3024', label: 'EI3024', rows: 12, packs: 20, units: 4 },
        { id: 'GENERIC', label: 'Generic', rows: 10, packs: 10, units: 1 }
    ]
};

let APP_DATA = DEFAULT_DATA;

/**
 * Attempt to load spiders-data.json and merge it over DEFAULT_DATA.
 * If the file is missing or invalid, we silently keep DEFAULT_DATA.
 */
async function tryLoadData() {
    try {
        const res = await fetch('spiders-data.json', { cache: 'no-store' });

        if (!res.ok) return;

        const json = await res.json();

        APP_DATA = {
            ...DEFAULT_DATA,
            ...json,
            // Ensure we always have arrays for these keys
            models: Array.isArray(json.models) ? json.models : DEFAULT_DATA.models,
            calculatorModels: Array.isArray(json.calculatorModels)
                ? json.calculatorModels
                : DEFAULT_DATA.calculatorModels
        };
    } catch (_) {
        // Ignore and use defaults
    }
}

function data() {
    return APP_DATA || DEFAULT_DATA;
}

// =====================================
// Button press animation helper
// =====================================
//
// Adds and removes a small "pressed" class for a nicer click/tap feeling.
//

function attachPressAnimation(element) {
    if (!element) return;

    const add = () => element.classList.add('is-pressed');
    const remove = () => element.classList.remove('is-pressed');

    element.addEventListener('mousedown', add);
    element.addEventListener('mouseup', remove);
    element.addEventListener('mouseleave', remove);

    // Touch support for phones/tablets
    element.addEventListener('touchstart', add, { passive: true });
    element.addEventListener('touchend', remove);
    element.addEventListener('touchcancel', remove);
}

// =====================================
// "Fails" Screen
// =====================================

function initFails() {
    const appData = data();

    const modelSelect = content.querySelector('#modelSelect');
    const testerSelect = content.querySelector('#testerSelect');
    const failSelect = content.querySelector('#failSelect');
    const explanation = content.querySelector('#failExplanation');

    // Optional search elements
    const searchArea = content.querySelector('#failSearchArea');
    const searchInput = content.querySelector('#failSearchInput');
    const searchResults = content.querySelector('#failSearchResults');

    // Initial state for dropdowns
    modelSelect.innerHTML =
        '<option value="" selected disabled>Select a model</option>' +
        appData.models
            .map(model => `<option value="${model.id}">${model.label}</option>`)
            .join('');

    testerSelect.disabled = true;
    failSelect.disabled = true;
    explanation.textContent = 'Select a model to begin.';

    // Hide search area until a model is selected (if it exists)
    if (searchArea) {
        searchArea.classList.add('hidden');
        if (searchInput) searchInput.value = '';
        if (searchResults) searchResults.innerHTML = '';
    }

    // When model changes, populate tester dropdown and reset the rest
    modelSelect.addEventListener('change', () => {
        const selectedModel = appData.models.find(
            model => model.id === modelSelect.value
        );
        if (!selectedModel) return;

        testerSelect.innerHTML =
            '<option value="" selected disabled>Select a tester</option>' +
            selectedModel.testers
                .map(tester => `<option value="${tester.id}">${tester.label}</option>`)
                .join('');

        testerSelect.disabled = false;
        failSelect.disabled = true;
        failSelect.innerHTML =
            '<option value="" disabled selected>Select a fail</option>';
        explanation.textContent = 'Pick a tester next or search.';

        // Show and reset search area
        if (searchArea) {
            searchArea.classList.remove('hidden');
        }
        if (searchInput) searchInput.value = '';
        if (searchResults) searchResults.innerHTML = '';
    });

    // When tester changes, populate fail dropdown
    testerSelect.addEventListener('change', () => {
        const selectedModel = appData.models.find(
            model => model.id === modelSelect.value
        );
        if (!selectedModel) return;

        const selectedTester = selectedModel.testers.find(
            tester => tester.id === testerSelect.value
        );
        if (!selectedTester) return;

        const fails = selectedTester.fails || [];

        const groupedFails = {};
        for (const fail of fails) {
            const groupName = fail.group || 'Other';
            if (!groupedFails[groupName]) groupedFails[groupName] = [];
            groupedFails[groupName].push(fail);
        }

        const groupNames = Object.keys(groupedFails);
        const showGroupLabels = groupNames.length > 1;

        let html =
            '<option value="" disabled selected>Select a fail</option>';

        for (const groupName of groupNames) {
            if (showGroupLabels) {
                html += `<optgroup label="${groupName}">`;
            }

            html += groupedFails[groupName]
                .map(fail => `<option value="${fail.id}">${fail.label}</option>`)
                .join('');

            if (showGroupLabels) {
                html += '</optgroup>';
            }
        }

        failSelect.innerHTML = html;
        failSelect.disabled = fails.length === 0;

        explanation.textContent = fails.length
            ? 'Select a fail for details.'
            : 'No fails found for this tester.';
    });

    // When fail changes, show explanation
    failSelect.addEventListener('change', () => {
        const selectedModel = appData.models.find(
            model => model.id === modelSelect.value
        );
        if (!selectedModel) return;

        const selectedTester = selectedModel.testers.find(
            tester => tester.id === testerSelect.value
        );
        if (!selectedTester) return;

        const selectedFail = (selectedTester.fails || []).find(
            fail => fail.id === failSelect.value
        );

        explanation.textContent = selectedFail ? selectedFail.info : '';
    });

    // ==============================
    // Fail Search Feature (simple list)
    // ==============================
    if (searchInput && searchResults) {
        searchInput.addEventListener('input', () => {
            const query = searchInput.value.trim().toLowerCase();
            searchResults.innerHTML = '';

            if (!query) {
                // Empty search: nothing to show
                return;
            }

            const selectedModel = appData.models.find(
                model => model.id === modelSelect.value
            );
            if (!selectedModel) {
                // No model selected yet – cannot search
                searchResults.innerHTML = `<div class="muted">Select a model first.</div>`;
                return;
            }

            const matches = [];

            // Search all testers and fails of this model
            for (const tester of selectedModel.testers) {
                const fails = tester.fails || [];
                for (const fail of fails) {
                    const labelMatch = fail.label.toLowerCase().includes(query);
                    const groupMatch =
                        fail.group && fail.group.toLowerCase().includes(query);
                    const infoMatch = fail.info.toLowerCase().includes(query);

                    if (labelMatch || groupMatch || infoMatch) {
                        matches.push({ tester, fail });
                    }
                }
            }

            if (matches.length === 0) {
                searchResults.innerHTML = `<div class="muted">No results found.</div>`;
                return;
            }

            // Build visual list of results
            for (const { tester, fail } of matches) {
                const div = document.createElement('div');
                div.className = 'search-result';
                div.innerHTML = `
                    <strong>${fail.label}</strong>
                    <small>${tester.label}</small>
                `;

                div.addEventListener('click', () => {
                    // Select tester
                    testerSelect.value = tester.id;
                    testerSelect.dispatchEvent(new Event('change'));

                    // Wait a moment for the fail dropdown to populate, then select
                    setTimeout(() => {
                        failSelect.value = fail.id;
                        failSelect.dispatchEvent(new Event('change'));

                        // Scroll to the explanation area
                        explanation.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }, 50);
                });

                searchResults.appendChild(div);
            }
        });
    }
}

// =====================================
// Calculators Screen
// =====================================

function initCalculators() {
    const appData = data();

    const miniTabs = Array.from(
        content.querySelectorAll('.mini-tabs .tabbtn')
    );
    const formContainer = content.querySelector('#calcForm');
    const calcButton = content.querySelector('#calcGo');
    const resultOutput = content.querySelector('#calcResult');

    const modelSelect = content.querySelector('#calcModel');
    const modelSummary = content.querySelector('#modelSummary');

    // Button press animation for mini-tabs & calculate button
    miniTabs.forEach(attachPressAnimation);
    attachPressAnimation(calcButton);

    modelSelect.innerHTML =
        appData.calculatorModels
            .map(model => `<option value="${model.id}">${model.label}</option>`)
            .join('') +
        '<option value="CUSTOM">CUSTOM</option>';

    function getActiveCalcType() {
        return miniTabs.find(
            button => button.getAttribute('aria-selected') === 'true'
        ).dataset.calc;
    }

    function setActiveCalc(calcType) {
        miniTabs.forEach(button => {
            const isActive = button.dataset.calc === calcType;
            button.setAttribute('aria-selected', String(isActive));
        });

        renderForm(calcType);
        applyModelPreset();
    }

    function enforceIntegerInput(element) {
        element.addEventListener('input', () => {
            element.value = element.value.replace(/[^\d]/g, '');
        });

        element.addEventListener('blur', () => {
            if (element.value !== '') {
                const min = Number(element.min || '0');
                element.value = String(
                    Math.max(min, Math.floor(Number(element.value)))
                );
            }
        });
    }

    function wireInputs() {
        formContainer
            .querySelectorAll('input[type=number]')
            .forEach(enforceIntegerInput);
    }

    function readPositive(id) {
        const el = content.querySelector('#' + id);
        const value = el.value === '' ? NaN : Number(el.value);

        if (!Number.isInteger(value) || value <= 0) {
            throw new Error('Please enter a positive whole number.');
        }
        return BigInt(value);
    }

    function readNonNegative(id) {
        const el = content.querySelector('#' + id);
        const value = el.value === '' ? NaN : Number(el.value);

        if (!Number.isInteger(value) || value < 0) {
            throw new Error('Please enter a non-negative whole number.');
        }
        return BigInt(value);
    }

    function divRem(a, b) {
        if (b === 0n) return [0n, a];
        return [a / b, a % b];
    }

    function safeRun(fn) {
        try {
            fn();
        } catch (err) {
            resultOutput.innerHTML = `<p class="err">${err.message}</p>`;
        }
    }

    function renderForm(type) {
        if (type === 'pallet') {
            formContainer.innerHTML = `
                <div id="cfg" class="row">
                  <div class="muted">Configuration</div>
                  <label>Rows per pallet
                    <input id="rowsPerPallet" type="number" inputmode="numeric" min="1">
                  </label>
                  <label>Packs per row
                    <input id="packsPerRow" type="number" inputmode="numeric" min="1">
                  </label>
                  <label>Units per pack
                    <input id="unitsPerPack" type="number" inputmode="numeric" min="1">
                  </label>
                </div>
                <div class="muted" style="margin-top:10px;">What you currently have</div>
                <div class="row">
                  <label>Full rows
                    <input id="fullRows" type="number" inputmode="numeric" min="0">
                  </label>
                  <label>Packs in row
                    <input id="packsInRow" type="number" inputmode="numeric" min="0">
                  </label>
                  <label>Loose units
                    <input id="looseUnits" type="number" inputmode="numeric" min="0">
                  </label>
                </div>
            `;
        } else {
            formContainer.innerHTML = `
                <div id="cfg" class="row">
                  <div class="muted">Configuration</div>
                  <label>Rows per pallet
                    <input id="e_rows" type="number" inputmode="numeric" min="1">
                  </label>
                  <label>Packs per row
                    <input id="e_packs" type="number" inputmode="numeric" min="1">
                  </label>
                  <label>Units per pack
                    <input id="e_units" type="number" inputmode="numeric" min="1">
                  </label>
                </div>
                <div class="muted" style="margin-top:10px;">Today</div>
                <div class="row">
                  <label>Current units on open pallet
                    <input id="e_current" type="number" inputmode="numeric" min="0">
                  </label>
                  <label>Today's rate (units built)
                    <input id="e_rate" type="number" inputmode="numeric" min="0">
                  </label>
                </div>
            `;
        }

        wireInputs();
        resultOutput.textContent = 'Result will appear here.';
    }

    function applyModelPreset() {
        const calcType = getActiveCalcType();
        const selectedModelId = modelSelect.value;
        const model = appData.calculatorModels.find(
            m => m.id === selectedModelId
        );
        const cfgBlock = content.querySelector('#cfg');
        const isCustom = selectedModelId === 'CUSTOM' || !model;

        if (calcType === 'pallet') {
            const rowsInput = content.querySelector('#rowsPerPallet');
            const packsInput = content.querySelector('#packsPerRow');
            const unitsInput = content.querySelector('#unitsPerPack');

            if (isCustom) {
                rowsInput.disabled = false;
                packsInput.disabled = false;
                unitsInput.disabled = false;

                cfgBlock.classList.remove('hidden');
                modelSummary.textContent = 'CUSTOM: enter your own numbers.';
            } else {
                rowsInput.value = model.rows;
                packsInput.value = model.packs;
                unitsInput.value = model.units;

                rowsInput.disabled = true;
                packsInput.disabled = true;
                unitsInput.disabled = true;

                cfgBlock.classList.add('hidden');
                modelSummary.textContent =
                    `${model.label}. Rows: ${model.rows}, Packs: ${model.packs}, Units: ${model.units}`;
            }
        } else {
            const rowsInput = content.querySelector('#e_rows');
            const packsInput = content.querySelector('#e_packs');
            const unitsInput = content.querySelector('#e_units');

            if (isCustom) {
                rowsInput.disabled = false;
                packsInput.disabled = false;
                unitsInput.disabled = false;

                cfgBlock.classList.remove('hidden');
                modelSummary.textContent = 'CUSTOM: enter your own numbers.';
            } else {
                rowsInput.value = model.rows;
                packsInput.value = model.packs;
                unitsInput.value = model.units;

                rowsInput.disabled = true;
                packsInput.disabled = true;
                unitsInput.disabled = true;

                cfgBlock.classList.add('hidden');
                modelSummary.textContent =
                    `${model.label}. Rows: ${model.rows}, Packs: ${model.packs}, Units: ${model.units}`;
            }
        }
    }

    function calcPallet() {
        const rowsPerPallet = readPositive('rowsPerPallet');
        const packsPerRow = readPositive('packsPerRow');
        const unitsPerPack = readPositive('unitsPerPack');

        const fullRows = readNonNegative('fullRows');
        const packsInRow = readNonNegative('packsInRow');
        const looseUnits = readNonNegative('looseUnits');

        const carryPacks = unitsPerPack > 0n ? looseUnits / unitsPerPack : 0n;
        const unitsRemainder = unitsPerPack > 0n ? looseUnits % unitsPerPack : looseUnits;

        const totalPacksInRow = packsInRow + carryPacks;

        const carryRows = packsPerRow > 0n ? totalPacksInRow / packsPerRow : 0n;
        const packsRemainder = packsPerRow > 0n ? totalPacksInRow % packsPerRow : totalPacksInRow;

        const totalFullRows = fullRows + carryRows;

        const unitsPerRow = packsPerRow * unitsPerPack;
        const totalUnits =
            totalFullRows * unitsPerRow +
            packsRemainder * unitsPerPack +
            unitsRemainder;

        const thresholdUnitsPerPallet = rowsPerPallet * unitsPerRow;

        let pallets = 0n;
        let remainderUnits = totalUnits;

        if (thresholdUnitsPerPallet > 0n) {
            [pallets, remainderUnits] = divRem(totalUnits, thresholdUnitsPerPallet);
        }

        let tidyRows = 0n;
        let afterRowsUnits = remainderUnits;

        let tidyPacks = 0n;
        let tidyUnits = remainderUnits;

        if (unitsPerRow > 0n) {
            [tidyRows, afterRowsUnits] = divRem(remainderUnits, unitsPerRow);
        }

        if (unitsPerPack > 0n) {
            [tidyPacks, tidyUnits] = divRem(afterRowsUnits, unitsPerPack);
        }

        resultOutput.innerHTML = `
            <h3>Total units on pallet: <strong>${totalUnits}</strong></h3>
            <p>
                Breakdown:
                <strong>${pallets}</strong> full pallet(s),
                <strong>${tidyRows}</strong> row(s),
                <strong>${tidyPacks}</strong> pack(s),
                <strong>${tidyUnits}</strong> unit(s)
            </p>
        `;
    }

    function calcEod() {
        const rows = readPositive('e_rows');
        const packs = readPositive('e_packs');
        const units = readPositive('e_units');

        const currentOnPallet = readNonNegative('e_current');
        const todaysRate = readNonNegative('e_rate');

        const unitsPerRow = packs * units;
        const unitsPerPallet = rows * unitsPerRow;

        if (unitsPerRow <= 0n || unitsPerPallet <= 0n) {
            resultOutput.innerHTML = `
                <p class="err">Invalid pallet configuration (all values must be > 0).</p>
            `;
            return;
        }

        const current = currentOnPallet % unitsPerPallet;
        const rate = todaysRate;

        let palletsDTW = 0n;
        let usedToCompleteFirst = 0n;
        let remainderAfter = 0n;

        if (current > 0n) {
            const needToFinish = unitsPerPallet - current;

            if (rate >= needToFinish) {
                palletsDTW = 1n;
                usedToCompleteFirst = needToFinish;

                const afterFirst = rate - needToFinish;
                let extraPallets;
                [extraPallets, remainderAfter] = divRem(afterFirst, unitsPerPallet);

                palletsDTW += extraPallets;
            } else {
                palletsDTW = 0n;
                usedToCompleteFirst = 0n;
                remainderAfter = current + rate;
            }
        } else {
            [palletsDTW, remainderAfter] = divRem(rate, unitsPerPallet);
            usedToCompleteFirst = 0n;
        }

        const [rowsAfter, afterRows] = divRem(remainderAfter, unitsPerRow);
        const [packsAfter, unitsAfter] = divRem(afterRows, units);

        const palletWord = palletsDTW === 1n ? 'pallet' : 'pallets';

        resultOutput.innerHTML = `
            <p><strong>${palletsDTW}</strong> ${palletWord} went DTW (down to warehouse).</p>
            ${usedToCompleteFirst > 0n
                ? `<p>Units used to complete first pallet: <strong>${usedToCompleteFirst}</strong></p>`
                : ''}
            <p><strong>New pallet breakdown:</strong></p>
            <ul style="list-style:none;padding:0;margin:0;line-height:1.5;">
                <li>Rows: <strong>${rowsAfter}</strong></li>
                <li>Packs: <strong>${packsAfter}</strong></li>
                <li>Units: <strong>${unitsAfter}</strong></li>
                <li>Open Pallet Count: <strong>${remainderAfter}</strong></li>
            </ul>
        `;
    }

    function calculate() {
        safeRun(() => {
            const type = getActiveCalcType();
            if (type === 'pallet') {
                calcPallet();
            } else {
                calcEod();
            }
        });
    }

    miniTabs.forEach(button => {
        button.addEventListener('click', () => {
            setActiveCalc(button.dataset.calc);
        });
    });

    calcButton.addEventListener('click', calculate);

    modelSelect.addEventListener('change', () => {
        renderForm(getActiveCalcType());
        applyModelPreset();
    });

    setActiveCalc('pallet');
    modelSelect.value = (appData.calculatorModels[0]?.id) || 'CUSTOM';
    applyModelPreset();
}

// =====================================
// Bottom Navigation & Simple Routing
// =====================================
//
// Adds slide/fade animation when switching between screens.
//

document
    .querySelectorAll('nav.tabs .tabbtn')
    .forEach(button => {
        // Button press animation for bottom nav
        attachPressAnimation(button);

        button.addEventListener('click', () => {
            const target = button.dataset.target;
            location.hash = '#' + target;
            load(target);
        });
    });

/**
 * Load a given screen ("fails" or "calculators") with a small animation.
 */
function load(name) {
    const tpl = document.getElementById('tpl-' + name);
    if (!tpl) return;

    // Decide direction of animation based on where we are and where we're going
    let transitionClass = 'view--fade';
    if (currentScreen === 'fails' && name === 'calculators') {
        transitionClass = 'view--slide-up';
    } else if (currentScreen === 'calculators' && name === 'fails') {
        transitionClass = 'view--slide-down';
    }

    currentScreen = name;

    // Wrap template content in a .view div so CSS can animate it
    const wrapper = document.createElement('div');
    wrapper.className = `view ${transitionClass}`;
    wrapper.appendChild(tpl.content.cloneNode(true));

    content.innerHTML = '';
    content.appendChild(wrapper);

    document
        .querySelectorAll('nav.tabs .tabbtn')
        .forEach(button => {
            const isActive = button.dataset.target === name;
            button.setAttribute('aria-selected', String(isActive));
        });

    if (name === 'fails') initFails();
    if (name === 'calculators') initCalculators();
}

async function init() {
    await tryLoadData();

    const rawHash = location.hash || '#fails';
    const hashName = rawHash.replace('#', '');

    const validScreens = ['fails', 'calculators'];
    const initialScreen = validScreens.includes(hashName) ? hashName : 'fails';

    currentScreen = initialScreen;
    load(initialScreen);

    window.addEventListener('hashchange', () => {
        const currentHash = (location.hash || '#fails').replace('#', '');
        const screen = validScreens.includes(currentHash) ? currentHash : 'fails';
        load(screen);
    });
}

// Kick everything off
init();

// =====================================
// Service worker registration
// =====================================

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker
            .register('./service-worker.js')
            .catch(err => console.error('Service Worker registration failed:', err));
    });
}
