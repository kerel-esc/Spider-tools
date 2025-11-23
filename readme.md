🕷️ Spiders Tools

A lightweight, mobile-friendly web application built to support Spiders, when manufacturing smoke sensors, CO₂ sensors, and other safety devices.
This tool streamlines daily tasks, provides quick access to failure information, and simplifies palletization calculations during production.

Access this website application on: https://kerel-esc.github.io/Spider-tools/

🔧 1. Fail Lookup Tool

Designed for rapid troubleshooting during production testing.

What it does

Select a model, then a tester, then a specific fail condition.

instantly displays clear troubleshooting steps and diagnostic info.

Helps line leaders quickly guide operators and resolve issues.

Reads from an optional spiders-data.json so teams can update fail info without modifying the code.

📦 2. Production Calculators

Two tools that assist Spiders in managing daily output and pallet accuracy.

Pallet Count Calculator

Given your rows, packs, units, and current pallet state, it calculates:

Total units

Full pallets

Remaining rows, packs, units

Overflow conversion (units → packs → rows)

End-of-Day (EOD) Calculator

Helps Spiders close out the shift accurately.
With the current open pallet & production numbers, it determines:

How many pallets went DTW

Amount used to complete the first pallet

Breakdown of the new open pallet

Total remaining units

Both calculators support:

Built-in preset configurations for typical products

A fully CUSTOM mode for new or special builds

Large-number safe calculations using BigInt

Automatic updates when switching models or calculator modes

💡 How It Works

This app is completely static—no backend server required.

Files
File	Purpose
index.html	Structure + templates for each screen
script.js	App logic, calculators, routing, fail engine
style.css	UI styling, layout, light/dark theme
spiders-data.json (optional)	Custom data for fails, testers, and models
Routing

Uses simple hash-based URLs:

#fails → Fail Lookup

#calculators → Production Calculators

Data Loading

Attempts to load spiders-data.json.
If not present, the app uses built-in defaults.

🎨 UI & Usability

Mobile-first design (built for production floor use)

Large, tap-friendly controls

Clear separation between tasks

Automatically enforces correct numeric input

Clean layout that works in noisy or fast-paced environments

Auto light/dark theme support

🚀 Deployment

Because it’s 100% static, you can deploy it anywhere:

🤝 Contributing

Feel free to submit improvements, add fail logic, or propose new model/tester presets.
This project is meant to grow with the production line and adapt to new sensor types.
