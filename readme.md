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
- Keeps the information consistent across shifts

### Data source

Fail info is loaded from:

1. **`spiders-data.json`** (if present)  
2. Otherwise, an internal **default model** in `script.js`

This means:

- Teams can update fails, testers, and models **without touching the JavaScript**
- If `spiders-data.json` is missing, the app still works using built-in defaults

### Fail Search

Once a model is selected, you can:

- Type into the **Search fails** box  
- The app searches across:
  - Fail labels  
  - Groups (e.g. “Resistors”)  
  - Description text  

Clicking a search result automatically:

- Selects the right tester  
- Selects the matching fail  
- Scrolls to the explanation

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
- **Full pallets** (if you use it with totals)  
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

### Calculator features

Both calculators support:

- Preset configurations for common products  
- A **CUSTOM** mode to enter any configuration  
- **BigInt** arithmetic, so large counts stay accurate  
- Automatic UI updates when:
  - Switching models  
  - Switching between Pallet and EOD modes

---

## 💡 How It Works

Spider Tools is a **purely static** web app:

- No backend, databases, or authentication
- Everything runs in the browser
- Data and logic live in these core files:

| File              | Purpose                                               |
| ----------------- | ----------------------------------------------------- |
| `index.html`      | Structure + templates for Fails & Calculators screens |
| `script.js`       | App logic, routing, fail engine, and calculators      |
| `style.css`       | UI styling, layout, responsiveness, light/dark theme  |
| `spiders-data.json` (optional) | Custom fails, testers, and models             |
| `manifest.json`   | PWA metadata (name, icons, colours)                   |
| `service-worker.js` | Offline caching and app shell behaviour            |

### Routing

The app uses **hash-based routing**:

- `#fails` → Fail Lookup  
- `#calculators` → Production Calculators  

Changing the hash updates the main view with a short slide/fade animation.

### Data loading

On startup:

1. The app loads built-in default data from `script.js`.
2. It then tries to fetch `spiders-data.json`.
3. If the file exists and is valid:
   - `models` and `calculatorModels` from the JSON override the defaults.
4. If it doesn’t exist:
   - The app silently keeps using the defaults.

---

## 🎨 UI & Usability

The interface is designed for **busy, noisy production environments**:

- Mobile-first layout  
- Large, tap-friendly buttons  
- Simple two-tab navigation (Fails / Calculators)  
- Clear separation between tasks  
- Automatic enforcement of **whole-number** inputs  
- Auto **light/dark theme** depending on system settings  
- Smooth button-press animation for tactile feedback  
- Fail search list is scrollable on small screens

---

## 🚀 Deployment

Because it’s static, you can deploy Spider Tools almost anywhere:

- GitHub Pages  
- Local intranet / file share  
- Any static hosting (Netlify, Vercel, S3, on-prem web server, etc.)

Basic steps:

1. Build the following structure:

   ```text
   / (root)
   ├─ index.html
   ├─ script.js
   ├─ style.css
   ├─ service-worker.js
   ├─ manifest.json
   ├─ logo.png
   ├─ spiders-data.json      (optional, recommended)
   └─ icons/
      ├─ icon-192.png
      └─ icon-512.png
