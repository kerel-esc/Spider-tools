// =====================================
// Spiders Tools – Application Logic
// =====================================
//
// Features:
//   • Data loading from fails-data.json + calculator-data.json (optional)
//   • "Fails" screen: model → tester → fail explanation + model-local search
//   • "Calculators" screen: pallet-count and end-of-day calculators
//   • Swipe gesture to switch calculator modes
//   • Haptic feedback (where supported)
//   • Hash-based navigation + "last screen" memory
//   • PWA: install banner, version checker, About modal metadata
//

const APP_VERSION = '1.1.1';

// Storage keys
const STORAGE_KEYS = {
    lastScreen: 'spiders:lastScreen',
    lastModelId: 'spiders:lastModelId',
    a2hsDismissed: 'spiders:a2hsDismissed'
};

// Main content container where templates are rendered
const content = document.getElementById('content');
let currentScreen = 'fails';

// -------------------------------------
// Data: defaults + optional JSON overrides
// -------------------------------------

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
    ],
    meta: {
        failsVersion: 'built-in',
        calcVersion: 'built-in'
    }
};

let APP_DATA = DEFAULT_DATA;

/**
 * Attempt to load fails-data.json and calculator-data.json.
 * Both are optional – if either is missing, defaults stay in place.
 */
async function tryLoadData() {
    let models = DEFAULT_DATA.models;
    let calculatorModels = DEFAULT_DATA.calculatorModels;
    let failsVersion = DEFAULT_DATA.meta.failsVersion;
    let calcVersion = DEFAULT_DATA.meta.calcVersion;

    // Load fails-data.json
    try {
        console.log('Fetching fails-data.json...');
        const res = await fetch('fails-data.json');
        if (res.ok) {
            const json = await res.json();
            if (Array.isArray(json.models)) {
                models = json.models;
                console.log('Loaded fails-data.json with', json.models.length, 'model(s)');
            }
            if (typeof json.version === 'string') {
                failsVersion = json.version;
            }
        } else {
            console.warn('fails-data.json HTTP status:', res.status);
        }
    } catch (e) {
        console.warn('Failed to load fails-data.json, using defaults', e);
    }

    // Load calculator-data.json
    try {
        console.log('Fetching calculator-data.json...');
        const res = await fetch('calculator-data.json');
        if (res.ok) {
            const json = await res.json();
            if (Array.isArray(json.calculatorModels)) {
                calculatorModels = json.calculatorModels;
                console.log('Loaded calculator-data.json with', json.calculatorModels.length, 'model(s)');
            }
            if (typeof json.version === 'string') {
                calcVersion = json.version;
            }
        } else {
            console.warn('calculator-data.json HTTP status:', res.status);
        }
    } catch (e) {
        console.warn('Failed to load calculator-data.json, using defaults', e);
    }

    APP_DATA = {
        models,
        calculatorModels,
        meta: {
            failsVersion,
            calcVersion
        }
    };

    console.log('Final APP_DATA meta:', APP_DATA.meta);
}

function data() {
    return APP_DATA || DEFAULT_DATA;
}

// =====================================
// Haptics (vibration helper)
// =====================================

function vibrate(pattern = 20) {
    if (navigator.vibrate) {
        navigator.vibrate(pattern);
    }
}

// =====================================
// Button press animation helper
// =====================================

function attachPressAnimation(element) {
    if (!element) return;

    const add = () => element.classList.add('is-pressed');
    const remove = () => element.classList.remove('is-pressed');

    element.addEventListener('mousedown', add);
    element.addEventListener('mouseup', remove);
    element.addEventListener('mouseleave', remove);

    // Touch support
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
    const testerSelect = content.querySelector('#testerSelect'); // hidden, used for logic
    const testerButtons = content.querySelector('#testerButtons');
    const failSelect = content.querySelector('#failSelect');
    const explanation = content.querySelector('#failExplanation');

    const searchArea = content.querySelector('#failSearchArea');
    const searchInput = content.querySelector('#failSearchInput');
    const searchResults = content.querySelector('#failSearchResults');

    // Populate models
    modelSelect.innerHTML =
        '<option value="" selected disabled>Select a model</option>' +
        appData.models
            .map(model => `<option value="${model.id}">${model.label}</option>`)
            .join('');

    testerSelect.disabled = true;
    failSelect.disabled = true;
    explanation.textContent = 'Select a model to begin.';

    // Hide search area initially
    if (searchArea) {
        searchArea.classList.add('hidden');
        if (searchInput) searchInput.value = '';
        if (searchResults) searchResults.innerHTML = '';
    }

    function renderTesterButtons(model) {
        testerButtons.innerHTML = '';

        if (!model || !Array.isArray(model.testers)) {
            testerSelect.disabled = true;
            return;
        }

        const testers = model.testers;

        testerSelect.innerHTML =
            '<option value="" selected disabled>Select a tester</option>' +
            testers
                .map(t => `<option value="${t.id}">${t.label}</option>`)
                .join('');

        testerSelect.disabled = false;

        testers.forEach((tester) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'tester-btn';
            btn.textContent = tester.label;
            btn.setAttribute('data-tester-id', tester.id);
            btn.setAttribute('aria-pressed', 'false');
            btn.setAttribute('role', 'tab');

            attachPressAnimation(btn);

            btn.addEventListener('click', () => {
                testerSelect.value = tester.id;
                testerSelect.dispatchEvent(new Event('change'));
                vibrate(15);
            });

            testerButtons.appendChild(btn);
        });
    }

    function updateTesterButtonState(selectedTesterId) {
        const buttons = testerButtons.querySelectorAll('.tester-btn');
        buttons.forEach(btn => {
            const isActive = btn.getAttribute('data-tester-id') === selectedTesterId;
            btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
        });
    }

    // Load last selected model (if any)
    const savedModelId = localStorage.getItem(STORAGE_KEYS.lastModelId);
    if (savedModelId && appData.models.some(m => m.id === savedModelId)) {
        modelSelect.value = savedModelId;
        modelSelect.dispatchEvent(new Event('change'));
    }

    // When model changes, reset tester/fails, and show search
    modelSelect.addEventListener('change', () => {
        const selectedModel = appData.models.find(
            model => model.id === modelSelect.value
        );
        if (!selectedModel) return;

        localStorage.setItem(STORAGE_KEYS.lastModelId, selectedModel.id);

        renderTesterButtons(selectedModel);
        testerSelect.value = '';
        failSelect.disabled = true;
        failSelect.innerHTML =
            '<option value="" disabled selected>Select a fail</option>';
        explanation.textContent = 'Pick a tester next or search.';

        if (searchArea) {
            searchArea.classList.remove('hidden');
        }
        if (searchInput) searchInput.value = '';
        if (searchResults) searchResults.innerHTML = '';

        vibrate(15);
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

        updateTesterButtonState(selectedTester.id);
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

        vibrate(20);
    });

    // ==============================
    // Fail Search (per-model)
    // ==============================
    if (searchInput && searchResults) {
        searchInput.addEventListener('input', () => {
            const query = searchInput.value.trim().toLowerCase();
            searchResults.innerHTML = '';

            if (!query) {
                return;
            }

            const selectedModel = appData.models.find(
                model => model.id === modelSelect.value
            );
            if (!selectedModel) {
                searchResults.innerHTML = `<div class="muted">Select a model first.</div>`;
                return;
            }

            const matches = [];

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

                    // After fail list populated, select the fail
                    setTimeout(() => {
                        failSelect.value = fail.id;
                        failSelect.dispatchEvent(new Event('change'));
                        explanation.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }, 50);

                    vibrate(20);
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

    // Button press animation
    miniTabs.forEach(attachPressAnimation);
    attachPressAnimation(calcButton);

    // Populate calculator models
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
        vibrate(15);
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

        vibrate(30);
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

        vibrate(30);
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

    // Tab switching
    miniTabs.forEach(button => {
        button.addEventListener('click', () => {
            setActiveCalc(button.dataset.calc);
        });
    });

    // Button click
    calcButton.addEventListener('click', () => {
        calculate();
    });

    // Model change
    modelSelect.addEventListener('change', () => {
        renderForm(getActiveCalcType());
        applyModelPreset();
        vibrate(15);
    });

    // Initialise
    setActiveCalc('pallet');
    modelSelect.value = (appData.calculatorModels[0]?.id) || 'CUSTOM';
    applyModelPreset();

    // Swipe gesture to switch calculator mode
    const gestureArea = content.querySelector('.view');
    if (gestureArea) {
        let touchStartX = 0;
        let touchStartY = 0;
        let tracking = false;

        gestureArea.addEventListener('touchstart', (e) => {
            if (e.touches.length !== 1) return;
            tracking = true;
            touchStartX = e.touches[0].clientX;
            touchStartY = e.touches[0].clientY;
        }, { passive: true });

        gestureArea.addEventListener('touchend', (e) => {
            if (!tracking) return;
            tracking = false;

            const touch = e.changedTouches[0];
            const dx = touch.clientX - touchStartX;
            const dy = touch.clientY - touchStartY;

            if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy)) {
                return;
            }

            const currentType = getActiveCalcType();

            if (dx < 0 && currentType !== 'eod') {
                setActiveCalc('eod');
            } else if (dx > 0 && currentType !== 'pallet') {
                setActiveCalc('pallet');
            }
        }, { passive: true });
    }
}

// =====================================
// Bottom Navigation & Simple Routing
// =====================================

document
    .querySelectorAll('nav.tabs .tabbtn')
    .forEach(button => {
        attachPressAnimation(button);

        button.addEventListener('click', () => {
            const target = button.dataset.target;
            location.hash = '#' + target;
            load(target);
            vibrate(15);
        });
    });

/**
 * Load a given screen ("fails" or "calculators") with a small animation.
 */
function load(name) {
    const tpl = document.getElementById('tpl-' + name);
    if (!tpl) return;

    const validScreens = ['fails', 'calculators'];
    if (!validScreens.includes(name)) return;

    // Save last screen preference
    localStorage.setItem(STORAGE_KEYS.lastScreen, name);

    let transitionClass = 'view--fade';
    if (currentScreen === 'fails' && name === 'calculators') {
        transitionClass = 'view--slide-up';
    } else if (currentScreen === 'calculators' && name === 'fails') {
        transitionClass = 'view--slide-down';
    }

    currentScreen = name;

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

// =====================================
// Service Worker Registration & Updates
// =====================================

let newWorkerPending = null;

function setupUpdateBanner(registration) {
    const updateBanner = document.getElementById('updateBanner');
    const updateBtn = document.getElementById('updateNowBtn');

    if (!updateBanner || !updateBtn) return;

    function showBanner(worker) {
        newWorkerPending = worker;
        updateBanner.classList.remove('hidden');
        updateBtn.addEventListener('click', () => {
            if (newWorkerPending) {
                newWorkerPending.postMessage({ type: 'SKIP_WAITING' });
                vibrate(20);
            }
        }, { once: true });
    }

    if (registration.waiting) {
        showBanner(registration.waiting);
    }

    registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (!newWorker) return;

        newWorker.addEventListener('statechange', () => {
            if (
                newWorker.state === 'installed' &&
                navigator.serviceWorker.controller
            ) {
                showBanner(newWorker);
            }
        });
    });
}

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker
            .register('./service-worker.js')
            .then(reg => {
                setupUpdateBanner(reg);
            })
            .catch(err => console.error('Service Worker registration failed:', err));
    });
}

// Handles page reload after SW update (single controlled reload)
let refreshing = false;
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (refreshing) return;
        refreshing = true;
        window.location.reload();
    });
}

// =====================================
// Add to Home Screen Banner
// =====================================

let deferredInstallPrompt = null;

function setupInstallBanner() {
    const installBanner = document.getElementById('installBanner');
    const installNowBtn = document.getElementById('installNowBtn');
    const installDismissBtn = document.getElementById('installDismissBtn');

    if (!installBanner || !installNowBtn || !installDismissBtn) return;

    window.addEventListener('beforeinstallprompt', (e) => {
        // Prevent default browser mini-infobar
        e.preventDefault();
        deferredInstallPrompt = e;

        const dismissed = localStorage.getItem(STORAGE_KEYS.a2hsDismissed) === '1';
        if (!dismissed) {
            installBanner.classList.remove('hidden');
            vibrate(20);
        }
    });

    installNowBtn.addEventListener('click', async () => {
        if (!deferredInstallPrompt) return;

        deferredInstallPrompt.prompt();
        const choice = await deferredInstallPrompt.userChoice;
        if (choice.outcome === 'accepted') {
            localStorage.setItem(STORAGE_KEYS.a2hsDismissed, '1');
        }
        installBanner.classList.add('hidden');
        vibrate(20);
    });

    installDismissBtn.addEventListener('click', () => {
        localStorage.setItem(STORAGE_KEYS.a2hsDismissed, '1');
        installBanner.classList.add('hidden');
        vibrate(15);
    });
}

// =====================================
// About Modal behaviour
// =====================================

function setupAboutModal() {
    const infoBtn = document.getElementById('infoBtn');
    const modal = document.getElementById('aboutModal');
    const closeBtn = document.getElementById('closeAbout');
    const appVersionEl = document.getElementById('aboutAppVersion');
    const failsVersionEl = document.getElementById('aboutFailsVersion');
    const calcVersionEl = document.getElementById('aboutCalcVersion');
    const iosHint = document.getElementById('iosInstallHint');

    if (!infoBtn || !modal || !closeBtn) return;

    // Show version info
    if (appVersionEl) appVersionEl.textContent = APP_VERSION;
    if (failsVersionEl) failsVersionEl.textContent = data().meta.failsVersion || 'unknown';
    if (calcVersionEl) calcVersionEl.textContent = data().meta.calcVersion || 'unknown';

    // iOS hint visibility (simple user agent check)
    const ua = navigator.userAgent || '';
    const isIOS = /iphone|ipad|ipod/i.test(ua);
    if (!isIOS && iosHint) {
        iosHint.classList.add('hidden');
    }

    infoBtn.addEventListener('click', () => {
        modal.classList.remove('hidden');
        vibrate(15);
    });

    closeBtn.addEventListener('click', () => {
        modal.classList.add('hidden');
        vibrate(10);
    });

    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.add('hidden');
            vibrate(10);
        }
    });
}

// =====================================
// Initialisation
// =====================================

async function init() {
    await tryLoadData();

    // Decide initial screen:
    const validScreens = ['fails', 'calculators'];

    let initialScreen = 'calculators'; // default per your request

    const rawHash = location.hash || '';
    const hashName = rawHash.replace('#', '');

    if (validScreens.includes(hashName)) {
        initialScreen = hashName;
    } else {
        const stored = localStorage.getItem(STORAGE_KEYS.lastScreen);
        if (stored && validScreens.includes(stored)) {
            initialScreen = stored;
        }
    }

    currentScreen = initialScreen;
    load(initialScreen);

    window.addEventListener('hashchange', () => {
        const currentHash = (location.hash || '').replace('#', '');
        const screen = validScreens.includes(currentHash) ? currentHash : 'calculators';
        load(screen);
    });

    setupInstallBanner();
    setupAboutModal();
}

document.addEventListener('DOMContentLoaded', () => {
    init();

    const homeLogo = document.getElementById('homeLogo');
    if (homeLogo) {
        homeLogo.addEventListener('click', () => {
            vibrate(10);
            window.location.reload();   // Full reload as you requested
        });
    }
});
