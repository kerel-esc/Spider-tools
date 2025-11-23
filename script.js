// =====================================
// Spiders Tools – Application Logic
// =====================================
//
// This file controls:
//   • Loading data (local defaults + spiders-data.json override)
//   • "Fails" screen: model → tester → fail explanation
//   • "Calculators" screen: pallet-count and end-of-day helpers
//   • Simple hash-based navigation between tabs
//
// NOTE: Behaviour must stay identical. This is only a refactor with clearer
// names, structure, and comments – no functional changes.
//

// Main content container where templates are rendered
const content = document.getElementById('content');

// -------------------------------------
// Data: defaults + optional JSON override
// -------------------------------------

// Default data used if spiders-data.json is missing.
// spiders-data.json can override any of these values by merging on top.
const DEFAULT_DATA = {
    // NOTE: The shape of `models` is actually defined by spiders-data.json.
    // This default is only a fallback and kept as-is for compatibility.
    models: ['Alpha', 'Beta', 'Gamma'],

    // These are also fallback-only and may not be used if spiders-data.json
    // provides its own full structure (models with testers/fails attached).
    testers: [
        { id: 'board', label: 'Board Tester' },
        { id: 'smoke', label: 'Smoke Box' },
        { id: 'function', label: 'Function Tester' }
    ],

    fails: {
        board: [
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
        ],
        smoke: [
            {
                id: 'flag-check',
                label: 'Flag Check',
                info: 'Flag sensor not detected or flag out of position. Verify flag is seated, check optical sensor alignment, and ensure wiring/connector is secure. Clean dust from sensor window.'
            },
            {
                id: 'leak',
                label: 'Leak Detected',
                info: 'Inspect gasket, hose connections, and enclosure screws; re-seat and retest.'
            }
        ],
        function: [
            {
                id: 'calibration',
                label: 'Calibration Out',
                info: 'Run calibration procedure. If still out, verify reference standard and replace suspect module.'
            },
            {
                id: 'button-dead',
                label: 'Button Not Responding',
                info: 'Check switch flex cable and connector; test continuity; replace switch if open.'
            }
        ]
    },

    // Calculator presets for pallet configuration
    calculatorModels: [
        { id: 'EI3016', label: 'EI3016', rows: 10, packs: 21, units: 4 },
        { id: 'EI3024', label: 'EI3024', rows: 12, packs: 20, units: 4 },
        { id: 'GENERIC', label: 'Generic', rows: 10, packs: 10, units: 1 }
    ]
};

// This holds the merged data (defaults + any JSON override)
let APP_DATA = DEFAULT_DATA;

/**
 * Attempt to load spiders-data.json and merge it over DEFAULT_DATA.
 * If the file is missing or invalid we silently fall back to DEFAULT_DATA.
 */
async function tryLoadData() {
    try {
        const res = await fetch('spiders-data.json', { cache: 'no-store' });

        if (res.ok) {
            const json = await res.json();
            // Shallow merge – JSON overrides defaults where keys match.
            APP_DATA = { ...DEFAULT_DATA, ...json };
        }
    } catch (_) {
        // Intentionally ignore errors – app continues with default data.
    }
}

/**
 * Simple accessor so we always read from the resolved data.
 */
function data() {
    return APP_DATA || DEFAULT_DATA;
}

// =====================================
// "Fails" Screen
// =====================================
//
// Flow: Model → Tester → Fail
//   1. Choose a model (populates testers).
//   2. Choose a tester (populates fails).
//   3. Choose a fail (shows explanation).
//

function initFails() {
    const appData = data();

    // Grab all relevant elements from the freshly-rendered template
    const modelSelect = content.querySelector('#modelSelect');
    const testerSelect = content.querySelector('#testerSelect');
    const failSelect = content.querySelector('#failSelect');
    const explanation = content.querySelector('#failExplanation');

    // ---------------------------------
    // Step 1: Model dropdown
    // ---------------------------------
    // The expected shape is:
    // appData.models = [{ id, label, testers: [...] }, ...]
    modelSelect.innerHTML =
        '<option value="" selected disabled>Select a model</option>' +
        appData.models
            .map(model => `<option value="${model.id}">${model.label}</option>`)
            .join('');

    // When a model is selected, populate the "tester" dropdown
    modelSelect.addEventListener('change', () => {
        const selectedModel = appData.models.find(
            model => model.id === modelSelect.value
        );
        if (!selectedModel) return;

        // -----------------------------
        // Step 2: Tester dropdown
        // -----------------------------
        testerSelect.innerHTML =
            '<option value="" selected disabled>Select a tester</option>' +
            selectedModel.testers
                .map(tester => `<option value="${tester.id}">${tester.label}</option>`)
                .join('');

        testerSelect.disabled = false;

        // Reset fail dropdown when model changes
        failSelect.disabled = true;
        failSelect.innerHTML =
            '<option value="" disabled selected>Select a fail</option>';

        explanation.textContent = 'Pick a tester next.';
    });

    // When a tester is selected, populate the "fail" dropdown
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

        // Group fails by optional "group" field: e.g. "Power", "Mechanical"...
        const groupedFails = {};
        for (const fail of fails) {
            const groupName = fail.group || 'Other';
            if (!groupedFails[groupName]) {
                groupedFails[groupName] = [];
            }
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

    // When a fail is selected, show its explanation text
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
}

// =====================================
// Calculators Screen
// =====================================
//
// There are two calculators (mini-tabs):
//   • "Pallet Count" – How many full pallets + rows/packs/units from a partial pallet.
//   • "End of Day"  – How many pallets go DTW and what the new open pallet looks like.
//
// Both calculators share:
//   • Model presets (EI3016, EI3024, Generic, CUSTOM)
//   • The same configuration numbers: rows, packs, units
//

function initCalculators() {
    const appData = data();

    // Mini-tab buttons (Pallet Count / End of Day)
    const miniTabs = Array.from(
        content.querySelectorAll('.mini-tabs .tabbtn')
    );

    // Elements for building the dynamic form and showing results
    const formContainer = content.querySelector('#calcForm');
    const calcButton = content.querySelector('#calcGo');
    const resultOutput = content.querySelector('#calcResult');

    // Model selection
    const modelSelect = content.querySelector('#calcModel');
    const modelSummary = content.querySelector('#modelSummary');

    // -----------------------
    // Populate model dropdown
    // -----------------------
    modelSelect.innerHTML =
        appData.calculatorModels
            .map(model => `<option value="${model.id}">${model.label}</option>`)
            .join('') +
        '<option value="CUSTOM">CUSTOM</option>';

    // -----------------------
    // Helper: which mini-tab is active?
    // -----------------------
    function getActiveCalcType() {
        return miniTabs.find(
            button => button.getAttribute('aria-selected') === 'true'
        ).dataset.calc;
    }

    // -----------------------
    // Helper: set active mini-tab and render its form
    // -----------------------
    function setActiveCalc(calcType) {
        miniTabs.forEach(button => {
            const isActive = button.dataset.calc === calcType;
            button.setAttribute('aria-selected', String(isActive));
        });

        renderForm(calcType);
        applyModelPreset();
    }

    // -----------------------
    // Input helpers
    // -----------------------

    /**
     * Ensure a number input only accepts whole digits.
     * We keep it forgiving (you can paste) but clean it on input/blur.
     */
    function enforceIntegerInput(element) {
        // Strip non-digits as the user types
        element.addEventListener('input', () => {
            element.value = element.value.replace(/[^\d]/g, '');
        });

        // On blur, clamp to minimum and floor the value
        element.addEventListener('blur', () => {
            if (element.value !== '') {
                const min = Number(element.min || '0');
                element.value = String(
                    Math.max(min, Math.floor(Number(element.value)))
                );
            }
        });
    }

    /**
     * Attach integer-only behaviour to all number inputs in the form.
     */
    function wireInputs() {
        formContainer
            .querySelectorAll('input[type=number]')
            .forEach(enforceIntegerInput);
    }

    // BigInt helpers – used so very large counts don't overflow.
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

    /**
     * Wrapper that catches errors and shows them in the result area,
     * instead of throwing and killing the whole app.
     */
    function safeRun(fn) {
        try {
            fn();
        } catch (err) {
            resultOutput.innerHTML = `<p class="err">${err.message}</p>`;
        }
    }

    // -----------------------
    // Dynamic form rendering
    // -----------------------

    /**
     * Render the form for the given calculator type:
     *   • "pallet": Pallet Count
     *   • "eod":    End of Day
     */
    function renderForm(type) {
        if (type === 'pallet') {
            // Pallet Count UI
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
            // End-of-Day UI
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

    /**
     * Apply the selected model preset to the active calculator.
     * For presets, configuration fields are filled and disabled.
     * For CUSTOM, fields are enabled for manual input.
     */
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
            // End-of-Day uses the same model data fields
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

    // -----------------------
    // Calculator logic: Pallet Count
    // -----------------------
    function calcPallet() {
        const rowsPerPallet = readPositive('rowsPerPallet');
        const packsPerRow = readPositive('packsPerRow');
        const unitsPerPack = readPositive('unitsPerPack');

        const fullRows = readNonNegative('fullRows');
        const packsInRow = readNonNegative('packsInRow');
        const looseUnits = readNonNegative('looseUnits');

        // Turn loose units into packs where possible
        const carryPacks = unitsPerPack > 0n ? looseUnits / unitsPerPack : 0n;
        const unitsRemainder = unitsPerPack > 0n ? looseUnits % unitsPerPack : looseUnits;

        // Combine packs in row + packs converted from loose units
        const totalPacksInRow = packsInRow + carryPacks;

        // Turn overflow packs into full rows where possible
        const carryRows = packsPerRow > 0n ? totalPacksInRow / packsPerRow : 0n;
        const packsRemainder = packsPerRow > 0n ? totalPacksInRow % packsPerRow : totalPacksInRow;

        // Total full rows on the pallet
        const totalFullRows = fullRows + carryRows;

        // Derive total units and break it down into pallets/rows/packs/units
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

    // -----------------------
    // Calculator logic: End of Day (DTW)
    // -----------------------
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

        // Reduce current units to a single pallet's worth
        const current = currentOnPallet % unitsPerPallet;
        const rate = todaysRate;

        let palletsDTW = 0n;            // Pallets that went "Down To Warehouse"
        let usedToCompleteFirst = 0n;   // Units used to complete the first pallet
        let remainderAfter = 0n;        // Units left on the new open pallet

        if (current > 0n) {
            // We already have a partially filled pallet
            const needToFinish = unitsPerPallet - current;

            if (rate >= needToFinish) {
                // We can finish the current pallet
                palletsDTW = 1n;
                usedToCompleteFirst = needToFinish;

                const afterFirst = rate - needToFinish;
                let extraPallets;
                [extraPallets, remainderAfter] = divRem(afterFirst, unitsPerPallet);

                palletsDTW += extraPallets;
            } else {
                // Not enough to finish the pallet: no pallet goes DTW
                palletsDTW = 0n;
                usedToCompleteFirst = 0n;
                remainderAfter = current + rate;
            }
        } else {
            // No open pallet – just build from zero
            [palletsDTW, remainderAfter] = divRem(rate, unitsPerPallet);
            usedToCompleteFirst = 0n;
        }

        // Break remainderAfter back into rows/packs/units
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

    // -----------------------
    // Dispatcher: run the correct calculator
    // -----------------------
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

    // -----------------------
    // Wire up events
    // -----------------------

    // Mini-tabs (Pallet Count vs End of Day)
    miniTabs.forEach(button => {
        button.addEventListener('click', () => {
            setActiveCalc(button.dataset.calc);
        });
    });

    // Calculate button
    calcButton.addEventListener('click', calculate);

    // When the model changes:
    // Re-render the current calculator form and then apply
    // the new preset so rows/packs/units update immediately.
    modelSelect.addEventListener('change', () => {
        renderForm(getActiveCalcType());
        applyModelPreset();
    });

    // -----------------------
    // Initial setup for calculators screen
    // -----------------------

    // Start with Pallet Count tab active
    setActiveCalc('pallet');

    // Select the first model preset by default (if any), otherwise CUSTOM
    modelSelect.value = (appData.calculatorModels[0]?.id) || 'CUSTOM';
    applyModelPreset();
}

// =====================================
// Bottom Navigation & Simple Routing
// =====================================
//
// We use the URL hash to track which tab is active:
//   #fails         → Fails screen
//   #calculators   → Calculators screen
//
// Changing the hash (by clicking a tab or manually editing the URL)
// will re-render the main <section id="content"> with the chosen template.
//

// Wire click handlers for bottom nav tabs
document
    .querySelectorAll('nav.tabs .tabbtn')
    .forEach(button => {
        button.addEventListener('click', () => {
            const target = button.dataset.target;
            location.hash = '#' + target;
            load(target);
        });
    });

/**
 * Load a given screen ("fails" or "calculators") by:
 *   1. Cloning the matching template.
 *   2. Inserting it into the content area.
 *   3. Marking the correct nav tab as active.
 *   4. Initialising that screen's JS.
 */
function load(name) {
    const tpl = document.getElementById('tpl-' + name);
    if (!tpl) return;

    // Replace content with fresh copy of template
    content.innerHTML = '';
    content.appendChild(tpl.content.cloneNode(true));

    // Update tab aria-selected state
    document
        .querySelectorAll('nav.tabs .tabbtn')
        .forEach(button => {
            const isActive = button.dataset.target === name;
            button.setAttribute('aria-selected', String(isActive));
        });

    // Initialise whichever screen we loaded
    if (name === 'fails') initFails();
    if (name === 'calculators') initCalculators();
}

/**
 * Global app initialisation:
 *   • Load/merge data.
 *   • Decide which tab to show from the current hash.
 *   • Listen for hash changes so back/forward works as expected.
 */
async function init() {
    await tryLoadData();

    const rawHash = location.hash || '#fails';
    const hashName = rawHash.replace('#', '');

    const validScreens = ['fails', 'calculators'];
    const initialScreen = validScreens.includes(hashName) ? hashName : 'fails';

    load(initialScreen);

    window.addEventListener('hashchange', () => {
        const currentHash = (location.hash || '#fails').replace('#', '');
        const screen = validScreens.includes(currentHash) ? currentHash : 'fails';
        load(screen);
    });
}

// Kick everything off
init();
