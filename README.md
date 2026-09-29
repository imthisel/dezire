# Dezire: Goal & Net Worth Planner (2026–2040)

Plan how much you want to make and spend every month from 2026 to 2040. Add property, vehicles and status items, and watch your total earned, total spent, money left and net worth update in real time.

## Run it

```bash
npm install     # first time only
npm run dev     # then open http://localhost:5173
```

Production build: `npm run build`, then `npm run preview`.

## How it works

- **Each month** has a *Goal to make*, a *Budget*, and an optional *Earned* amount. If Earned is left blank, the goal is used.
- **Running totals** (Total earned, Total spent, Money left) add up every month from January 2026 onward.
- **Items** can be Land/Property, Vehicle or Status, and each one is Appreciating (green), Depreciating (red) or Stable (blue). An item is blocked with an error if it would go over that month's budget.
- **Net worth** = money left + the current value of your items (using the yearly % you set).
- **Moving items:** drag an item to another month (hold **Ctrl** to copy, or drag onto a year tab to switch years). You can also use the Copy / Cut / Paste buttons, or the ⇄ "Move / copy to…" dialog, which can copy to several months at once.
- **Currency:** everything is entered and stored in Philippine Pesos (₱). A US dollar equivalent is shown under each amount, based on the rate in the header (default ₱62.70 = $1, so ₱100,000 ≈ $1,595). Change the rate any time.
- Money boxes accept `100k`, `1.5m` or `250,000`.
- Data is saved automatically in your browser. Use **Export** / **Import** to back it up or move it to another computer.

Built with Vite, React, TypeScript, Tailwind CSS v4 and Zustand.
