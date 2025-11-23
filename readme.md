# 🕷️ Spider Tools

Spider Tools is a lightweight, mobile-friendly web app built to support **Spiders** on the production line when manufacturing smoke sensors, CO₂ sensors, and other safety devices.

It is designed for **fast, reliable use on the factory floor**:

- Quick lookup of tester fails and troubleshooting steps  
- Simple palletisation and end-of-day calculations  
- Works offline as a PWA (installable app)  
- No backend server required – just static files

👉 Live version: https://kerel-esc.github.io/Spider-tools/

---

## 🔧 1. Fail Lookup Tool

The Fail Lookup tool is built for **rapid troubleshooting** during production testing.

### What it does

1. Select a **model**  
2. Select a **tester**  
3. Select a **fail**  

The app then:

- Displays clear troubleshooting actions and diagnostic notes  
- Helps line leaders and Spiders quickly guide operators  
- Keeps information consistent across shifts

### Data source

Fail info is loaded from:

1. **`fails-data.json`** (if present)  
2. Otherwise, an internal **default model** in `script.js`  

This means:

- Teams can update fails, testers, and models **without touching the JavaScript**  
- If `fails-data.json` is missing, the app still works using built-in defaults

### Tester grouping

Testers are shown as **large buttons**, grouped visually for quick tapping on the line.  
The underlying `<select>` still exists for accessibility and internal logic.

### Model-local search

Once a model is selected, you can:

- Type into the **Search fails** box  
- The app searches across fails for that model:
  - Fail labels  
  - Groups (e.g. “Resistors”)  
  - Description text  

Clicking a search result:

- Selects the correct tester  
- Selects the fail  
- Scrolls down to the explanation

---

## 📦 2. Production Calculators

Spider Tools includes two calculators to help manage **daily output** and **pallet accuracy**.

### 2.1 Pallet Count Calculator

Given:

- Rows per pallet  
- Packs per row  
- Units per pack  
- Current pallet state:
  - Full rows  
  - Packs in current row  
  - Loose units  

It calculates:

- **Total units** on the pallet  
- **Full pallets** (when used with totals)  
- Remaining rows, packs, and units  
- Correctly handles overflow:
  - Units → Packs → Rows

### 2.2 End-of-Day (EOD) Calculator

Given:

- Rows per pallet  
- Packs per row  
- Units per pack  
- Units currently on the open pallet  
- Today’s production (units built)  

It determines:

- How many pallets went **DTW** (Down To Warehouse)  
- How many units were used to complete the first pallet (if there was an open one)  
- The **new open pallet breakdown**:
  - Rows / packs / units  
  - Open pallet unit count  

### Calculator data

Calculator presets are loaded from:

1. **`calculator-data.json`** (if present)  
2. Otherwise, default calculator models inside `script.js`  

If `calculator-data.json` is missing, operators can always use **CUSTOM** mode.

### Calculator features

Both calculators support:

- Preset configurations for common products  
- A **CUSTOM** mode for any configuration  
- **BigInt** arithmetic (safe for very large counts)  
- Automatic UI updates when:
  - Switching models  
  - Switching between Pallet and EOD modes  
- Swipe gesture (left/right) to switch between calculators on touch devices  
- Haptic feedback where supported (`navigator.vibrate`)

---

## 💡 How It Works

Spider Tools is a **purely static** web app:

- No backend, databases, or authentication  
- Everything runs in the browser  
- Data and logic live in these core files:

| File                  | Purpose                                               |
| --------------------- | ----------------------------------------------------- |
| `index.html`          | Structure + templates for Fails & Calculators screens |
| `script.js`           | App logic, routing, fail engine, calculators, PWA glue |
| `style.css`           | UI styling, layout, responsiveness, light/dark theme  |
| `fails-data.json`     | Custom fails, testers, and models (optional)          |
| `calculator-data.json`| Custom calculator model presets (optional)            |
| `manifest.json`       | PWA metadata (name, icons, colours)                   |
| `service-worker.js`   | Offline caching, version updates, install support     |

> Note: `spiders-data.json` from earlier versions has been split into  
> `fails-data.json` and `calculator-data.json`.

### Routing

The app uses **hash-based routing**:

- `#fails` → Fail Lookup  
- `#calculators` → Production Calculators  

Additionally:

- The **first-ever load** defaults to the Calculators screen  
- After that, the app remembers the **last screen used** (Fails or Calculators) and opens there next time

### Data loading

On startup:

1. The app loads built-in default data from `script.js`.  
2. It then tries to fetch:
   - `fails-data.json`
   - `calculator-data.json`  
3. For each file:
   - If the file exists and is valid → it overrides the corresponding defaults  
   - If not → defaults remain in place  

The About modal shows which data source is in use:

- App version  
- Fails data version  
- Calculator data version  

---

## 🎨 UI & Usability

Designed for **busy production environments**:

- Mobile-first layout  
- Large, tap-friendly controls  
- Tester selection via **button groups**  
- Model-local fail search  
- Clear separation between Fails and Calculators  
- Automatic enforcement of whole-number inputs  
- Auto **light/dark theme** based on system settings  
- Smooth button-press animation and **optional vibration** feedback  
- Swipe gesture to switch calculator modes  
- Scrollable fail search results on small screens

---

## 📲 PWA, Install & Versioning

### Add to Home Screen

- The app listens for `beforeinstallprompt` and shows a small **install banner** when appropriate.  
- The user can:
  - Tap **Install** → triggers the native install prompt  
  - Tap **Not now** → hides the banner and remembers the choice  

On iOS:

- iOS does not support `beforeinstallprompt`, so the About modal shows a brief hint:
  > Use the Share button → “Add to Home Screen”.

### Offline support

The service worker:

- Caches:
  - Core files (`index.html`, `style.css`, `script.js`, `manifest.json`, `logo.png`)  
- Attempts to cache:
  - `fails-data.json` (if present)  
  - `calculator-data.json` (if present)  
- Serves cached content when offline

If the data files are missing, the app quietly falls back to built-in defaults.

### Version checker

- `script.js` includes `APP_VERSION` (e.g. `1.1.0`).  
- The service worker cache name includes the version: `spiders-tools-v3-1.1.0`.  
- When a new version is deployed:
  - A **“New version available”** banner appears.  
  - Tapping **Update** triggers a soft reload via `skipWaiting()`.

The current app + data versions are shown inside the **About (“?”)** modal.

---

## 🚀 Deployment

Because it’s static, you can deploy Spider Tools almost anywhere:

- GitHub Pages  
- Intranet / local web server  
- Any static hosting (Netlify, Vercel, S3, on-prem, etc.)

### Recommended structure

```text
/ (root)
├─ index.html
├─ script.js
├─ style.css
├─ service-worker.js
├─ manifest.json
├─ logo.png
├─ fails-data.json           (optional, recommended)
├─ calculator-data.json      (optional, recommended)
└─ icons/
   ├─ icon-192.png
   └─ icon-512.png
