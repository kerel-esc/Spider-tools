const content = document.getElementById('content');

// ===== Default data (overridden by spiders-data.json if present) =====
const DEFAULT_DATA = {
    models: ['Alpha', 'Beta', 'Gamma'],
    testers: [
        { id: 'board', label: 'Board Tester' },
        { id: 'smoke', label: 'Smoke Box' },
        { id: 'function', label: 'Function Tester' }
    ],
    fails: {
        board: [
            { id: 'no-boot', label: 'No Boot', info: 'Check power rails, shorts to ground, and firmware programming.' },
            { id: 'usb-fail', label: 'USB Fail', info: 'Inspect connector solder joints and ESD diodes; verify 5V and data lines.' }
        ],
        smoke: [
            { id: 'flag-check', label: 'Flag Check', info: 'Flag sensor not detected or flag out of position. Verify flag is seated, check optical sensor alignment, and ensure wiring/connector is secure. Clean dust from sensor window.' },
            { id: 'leak', label: 'Leak Detected', info: 'Inspect gasket, hose connections, and enclosure screws; re-seat and retest.' }
        ],
        function: [
            { id: 'calibration', label: 'Calibration Out', info: 'Run calibration procedure. If still out, verify reference standard and replace suspect module.' },
            { id: 'button-dead', label: 'Button Not Responding', info: 'Check switch flex cable and connector; test continuity; replace switch if open.' }
        ]
    },
    calculatorModels: [
        { id: 'EI3016', label: 'EI3016', rows: 10, packs: 21, units: 4 },
        { id: 'EI3024', label: 'EI3024', rows: 12, packs: 20, units: 4 },
        { id: 'GENERIC', label: 'Generic', rows: 10, packs: 10, units: 1 }
    ]
};

let APP_DATA = DEFAULT_DATA;
async function tryLoadData() {
    try { const res = await fetch('spiders-data.json', { cache: 'no-store' }); if (res.ok) { const j = await res.json(); APP_DATA = { ...DEFAULT_DATA, ...j }; } } catch (_) { }
}
function data() { return APP_DATA || DEFAULT_DATA; }

// ====== Fails ======
function initFails() {
    const d = data();

    const modelSel = content.querySelector('#modelSelect');
    const testerSel = content.querySelector('#testerSelect');
    const failSel = content.querySelector('#failSelect');
    const expl = content.querySelector('#failExplanation');

    // Models come from d.models = [{ id, label, testers: [...] }, ...]
    modelSel.innerHTML =
        '<option value="" selected disabled>Select a model</option>' +
        d.models.map(m => `<option value="${m.id}">${m.label}</option>`).join('');

    // When a model is selected
    modelSel.addEventListener('change', () => {
        const model = d.models.find(m => m.id === modelSel.value);
        if (!model) return;

        // Populate testers for this model
        testerSel.innerHTML =
            '<option value="" selected disabled>Select a tester</option>' +
            model.testers.map(t => `<option value="${t.id}">${t.label}</option>`).join('');

        testerSel.disabled = false;
        failSel.disabled = true;
        failSel.innerHTML = '<option value="" disabled selected>Select a fail</option>';
        expl.textContent = 'Pick a tester next.';
    });

    // When a tester is selected
    testerSel.addEventListener('change', () => {
        const model = d.models.find(m => m.id === modelSel.value);
        if (!model) return;

        const tester = model.testers.find(t => t.id === testerSel.value);
        if (!tester) return;

        const fails = tester.fails || [];

        // Group fails by "group" field
        const grouped = {};
        for (const f of fails) {
            const groupName = f.group || 'Other';
            if (!grouped[groupName]) grouped[groupName] = [];
            grouped[groupName].push(f);
        }

        const groupNames = Object.keys(grouped);
        const hasGroups = groupNames.length > 1; // only bother showing headings if >1 group

        let html = '<option value="" disabled selected>Select a fail</option>';

        for (const groupName of groupNames) {
            if (hasGroups) {
                html += `<optgroup label="${groupName}">`;
            }
            html += grouped[groupName]
                .map(f => `<option value="${f.id}">${f.label}</option>`)
                .join('');
            if (hasGroups) {
                html += '</optgroup>';
            }
        }

        failSel.innerHTML = html;
        failSel.disabled = fails.length === 0;
        expl.textContent = fails.length
            ? 'Select a fail for details.'
            : 'No fails found for this tester.';
    });

    // When a fail is selected
    failSel.addEventListener('change', () => {
        const model = d.models.find(m => m.id === modelSel.value);
        if (!model) return;

        const tester = model.testers.find(t => t.id === testerSel.value);
        if (!tester) return;

        const fail = (tester.fails || []).find(f => f.id === failSel.value);
        expl.textContent = fail ? fail.info : '';
    });
}



// ====== Calculators (Model presets + CUSTOM) ======
function initCalculators() {
    const d = data();
    const mini = Array.from(content.querySelectorAll('.mini-tabs .tabbtn'));
    const form = content.querySelector('#calcForm');
    const btnGo = content.querySelector('#calcGo');
    const btnClear = content.querySelector('#calcClear');
    const out = content.querySelector('#calcResult');
    const modelSel = content.querySelector('#calcModel');
    const modelSummary = content.querySelector('#modelSummary');

    // Populate models + CUSTOM
    modelSel.innerHTML = d.calculatorModels.map(m => `<option value="${m.id}">${m.label}</option>`).join('') + '<option value="CUSTOM">CUSTOM</option>';

    function activeCalc() { return mini.find(b => b.getAttribute('aria-selected') === 'true').dataset.calc; }
    function setActive(calc) { mini.forEach(b => b.setAttribute('aria-selected', String(b.dataset.calc === calc))); renderForm(calc); applyModelPreset(); }

    // Integer-only enforcement for mobile/desktop
    function enforceIntegerInput(el) {
        el.addEventListener('input', () => { el.value = el.value.replace(/[^\d]/g, ''); });
        el.addEventListener('blur', () => { if (el.value !== '') { const min = Number(el.min || '0'); el.value = String(Math.max(min, Math.floor(Number(el.value)))); } });
    }
    function wireInputs() { form.querySelectorAll('input[type=number]').forEach(enforceIntegerInput); }

    // Helpers (BigInt)
    function readPos(id) { const el = content.querySelector('#' + id); const v = el.value === '' ? NaN : Number(el.value); if (!Number.isInteger(v) || v <= 0) throw new Error('Please enter a positive whole number.'); return BigInt(v); }
    function readNonNeg(id) { const el = content.querySelector('#' + id); const v = el.value === '' ? NaN : Number(el.value); if (!Number.isInteger(v) || v < 0) throw new Error('Please enter a non?negative whole number.'); return BigInt(v); }
    function divRem(a, b) { if (b === 0n) return [0n, a]; return [a / b, a % b]; }
    function safeRun(fn) { try { fn(); } catch (err) { out.innerHTML = `<p class="err">${err.message}</p>`; } }

    function renderForm(type) {
        if (type === 'pallet') {
            form.innerHTML = `
                <div id="cfg" class="row">
                  <div class="muted">Configuration</div>
                  <label>Rows per pallet<input id="rowsPerPallet" type="number" inputmode="numeric" min="1"></label>
                  <label>Packs per row<input id="packsPerRow" type="number" inputmode="numeric" min="1"></label>
                  <label>Units per pack<input id="unitsPerPack" type="number" inputmode="numeric" min="1"></label>
                </div>
                <div class="muted" style="margin-top:10px;">What you currently have</div>
                <div class="row">
                  <label>Full rows<input id="fullRows" type="number" inputmode="numeric" min="0"></label>
                  <label>Packs in row<input id="packsInRow" type="number" inputmode="numeric" min="0"></label>
                  <label>Loose units<input id="looseUnits" type="number" inputmode="numeric" min="0"></label>
                </div>`;
        } else { // eod
            form.innerHTML = `
                <div id="cfg" class="row">
                  <div class="muted">Configuration</div>
                  <label>Rows per pallet<input id="e_rows" type="number" inputmode="numeric" min="1"></label>
                  <label>Packs per row<input id="e_packs" type="number" inputmode="numeric" min="1"></label>
                  <label>Units per pack<input id="e_units" type="number" inputmode="numeric" min="1"></label>
                </div>
                <div class="row">
                  <label>Current units on open pallet<input id="e_current" type="number" inputmode="numeric" min="0"></label>
                  <label>Today's rate (units built)<input id="e_rate" type="number" inputmode="numeric" min="0"></label>
                </div>`;
        }
        wireInputs();
        out.textContent = 'Result will appear here.';
    }

    function applyModelPreset() {
        const calc = activeCalc();
        const selected = modelSel.value;
        const m = d.calculatorModels.find(x => x.id === selected);
        const cfg = content.querySelector('#cfg');
        const isCustom = (selected === 'CUSTOM' || !m);
        if (calc === 'pallet') {
            const rows = content.querySelector('#rowsPerPallet');
            const packs = content.querySelector('#packsPerRow');
            const units = content.querySelector('#unitsPerPack');
            if (isCustom) { rows.disabled = packs.disabled = units.disabled = false; cfg.classList.remove('hidden'); modelSummary.textContent = 'CUSTOM: enter your own numbers.'; }
            else { rows.value = m.rows; packs.value = m.packs; units.value = m.units; rows.disabled = packs.disabled = units.disabled = true; cfg.classList.add('hidden'); modelSummary.textContent = `${m.label}.  Rows: ${m.rows}, Packs: ${m.packs}, Units: ${m.units}`; }
        } else { // eod
            const rows = content.querySelector('#e_rows');
            const packs = content.querySelector('#e_packs');
            const units = content.querySelector('#e_units');
            if (isCustom) { rows.disabled = packs.disabled = units.disabled = false; cfg.classList.remove('hidden'); modelSummary.textContent = 'CUSTOM: enter your own numbers.'; }
            else { rows.value = m.rows; packs.value = m.packs; units.value = m.units; rows.disabled = packs.disabled = units.disabled = true; cfg.classList.add('hidden'); modelSummary.textContent = `${m.label}.  Rows: ${m.rows}, Packs: ${m.packs}, Units: ${m.units}`; }
        }
    }

    function calcPallet() {
        const rowsPerPallet = readPos('rowsPerPallet');
        const packsPerRow = readPos('packsPerRow');
        const unitsPerPack = readPos('unitsPerPack');
        const fullRows = readNonNeg('fullRows');
        const packsInRow = readNonNeg('packsInRow');
        const looseUnits = readNonNeg('looseUnits');

        const carryPacks = unitsPerPack > 0n ? (looseUnits / unitsPerPack) : 0n;
        const unitsRemainder = unitsPerPack > 0n ? (looseUnits % unitsPerPack) : looseUnits;
        const totalPacksInRow = packsInRow + carryPacks;
        const carryRows = packsPerRow > 0n ? (totalPacksInRow / packsPerRow) : 0n;
        const packsRemainder = packsPerRow > 0n ? (totalPacksInRow % packsPerRow) : totalPacksInRow;
        const totalFullRows = fullRows + carryRows;
        const unitsPerRow = packsPerRow * unitsPerPack;
        const totalUnits = totalFullRows * unitsPerRow + packsRemainder * unitsPerPack + unitsRemainder;

        const threshold = rowsPerPallet * unitsPerRow;
        let pallets = 0n, remainder = totalUnits;
        if (threshold > 0n) { [pallets, remainder] = divRem(totalUnits, threshold); }
        let tidyRows = 0n, afterRows = remainder, tidyPacks = 0n, tidyUnits = remainder;
        if (unitsPerRow > 0n) { [tidyRows, afterRows] = divRem(remainder, unitsPerRow); }
        if (unitsPerPack > 0n) { [tidyPacks, tidyUnits] = divRem(afterRows, unitsPerPack); }

        out.innerHTML = `<h3>Total units on pallet: <strong>${totalUnits}</strong></h3>
              <p>Breakdown: <strong>${pallets}</strong> full pallet(s), <strong>${tidyRows}</strong> row(s), <strong>${tidyPacks}</strong> pack(s), <strong>${tidyUnits}</strong> unit(s)</p>`;
    }

    function calcEod() {
        const rows = readPos('e_rows');
        const packs = readPos('e_packs');
        const units = readPos('e_units');
        const currentOnPallet = readNonNeg('e_current');
        const todaysRate = readNonNeg('e_rate');

        const unitsPerRow = packs * units;
        const unitsPerPallet = rows * unitsPerRow;
        if (unitsPerRow <= 0n || unitsPerPallet <= 0n) { out.innerHTML = '<p class="err">Invalid pallet configuration (all values must be > 0).</p>'; return; }

        const current = currentOnPallet % unitsPerPallet; // normalize
        const rate = todaysRate;
        let palletsDTW = 0n, usedToCompleteFirst = 0n, remainderAfter = 0n;
        if (current > 0n) {
            const needToFinish = unitsPerPallet - current;
            if (rate >= needToFinish) {
                palletsDTW = 1n; usedToCompleteFirst = needToFinish; const afterFirst = rate - needToFinish; let extra;[extra, remainderAfter] = divRem(afterFirst, unitsPerPallet); palletsDTW += extra;
            } else { palletsDTW = 0n; usedToCompleteFirst = 0n; remainderAfter = current + rate; }
        } else { [palletsDTW, remainderAfter] = divRem(rate, unitsPerPallet); usedToCompleteFirst = 0n; }
        const [rowsAfter, afterRows] = divRem(remainderAfter, unitsPerRow);
        const [packsAfter, unitsAfter] = divRem(afterRows, units);
        const palletWord = palletsDTW === 1n ? 'pallet' : 'pallets';
    out.innerHTML = `
        <p><strong>${palletsDTW}</strong> ${palletWord} went down to warehouse.</p>
        ${
        usedToCompleteFirst > 0n
            ? `<p>Units used to complete first pallet: <strong>${usedToCompleteFirst}</strong></p>`
            : ''
        }

    <p><strong>New pallet breakdown:</strong></p>
    <ul style="list-style:none;padding:0;margin:0;line-height:1.5;">
        <li>Rows: <strong>${rowsAfter}</strong></li>
        <li>Packs: <strong>${packsAfter}</strong></li>
        <li>Units: <strong>${unitsAfter}</strong></li>
        <li>Open Pallet Count: <strong>${remainderAfter}</strong></li>
    </ul>
`;

    }

    function calculate() { safeRun(() => { const t = activeCalc(); if (t === 'pallet') calcPallet(); else calcEod(); }); }
    function clearAll() { form.querySelectorAll('input[type=number]').forEach(i => i.value = ''); out.textContent = ''; applyModelPreset(); }

    mini.forEach(b => b.addEventListener('click', () => setActive(b.dataset.calc)));
    btnGo.addEventListener('click', calculate);
    btnClear.addEventListener('click', clearAll);
    modelSel.addEventListener('change', applyModelPreset);

    // Init
    setActive('pallet');
    // Select first model by default
    modelSel.value = (d.calculatorModels[0]?.id) || 'CUSTOM';
    applyModelPreset();
}

// ===== Bottom nav & routing =====
document.querySelectorAll('nav.tabs .tabbtn').forEach(btn => btn.addEventListener('click', () => { const target = btn.dataset.target; location.hash = '#' + target; load(target); }));
function load(name) {
    const tpl = document.getElementById('tpl-' + name);
    if (!tpl) return;
    content.innerHTML = '';
    content.appendChild(tpl.content.cloneNode(true));
    document.querySelectorAll('nav.tabs .tabbtn').forEach(btn => btn.setAttribute('aria-selected', String(btn.dataset.target === name)));
    if (name === 'fails') initFails();
    if (name === 'calculators') initCalculators();
}

async function init() {
    await tryLoadData();
    const hash = (location.hash || '#fails').replace('#', '');
    const valid = ['fails', 'calculators'];
    load(valid.includes(hash) ? hash : 'fails');
    window.addEventListener('hashchange', () => { const h = (location.hash || '#fails').replace('#', ''); load(valid.includes(h) ? h : 'fails'); });
}
init();