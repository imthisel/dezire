# Dezire: Goal & Net Worth Planner (2026–2040)

Plan how much you want to make and spend every month from 2026 to 2040. Add property, vehicles and status items, and watch your total earned, total spent, money left and net worth update in real time.

## Run it

```bash
npm install     # first time only
cp .env.example .env.local   # then fill in your Firebase values (see below)
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
- **Accounts:** everyone signs in with Google. Data is saved automatically to their own account (Firestore document `users/{uid}`) and syncs across their devices. **Export** / **Import** still work for offline backups.

## Setup: Google login and cloud saving (Firebase)

1. Go to https://console.firebase.google.com and click **Create a project**. Google Analytics is optional.
2. **Build → Authentication → Get started → Sign-in method → Google → Enable.** Pick a support email, then **Save**.
3. **Build → Firestore Database → Create database.** Choose a location near your users (e.g. `asia-southeast1`) and start in **production mode**.
4. In Firestore, open the **Rules** tab, paste the contents of [`firestore.rules`](firestore.rules), and click **Publish**. These rules let each user read and write only their own data.
5. **Project settings (gear icon) → General → Your apps → Web (`</>`).** Register an app called "Dezire" (no Hosting needed). Copy `apiKey`, `authDomain`, `projectId` and `appId` into `.env.local`:
   ```
   VITE_FIREBASE_API_KEY=...
   VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=your-project
   VITE_FIREBASE_APP_ID=1:...:web:...
   ```
   These values identify your project but are not secrets. The Firestore rules are what keep data private.

## Deploy (Vercel)

1. Push this repo to GitHub.
2. Go to https://vercel.com, sign in with GitHub, click **Add New → Project**, and import the repo. Vercel detects Vite automatically (build `npm run build`, output `dist`).
3. Before clicking **Deploy**, open **Environment Variables** and add the same four `VITE_FIREBASE_*` values.
4. Click **Deploy**. Every later `git push` to `main` redeploys automatically.
5. Back in Firebase: **Authentication → Settings → Authorized domains → Add domain**, and add your Vercel domain (e.g. `dezire.vercel.app`) plus any custom domain. Google sign-in is blocked on domains that aren't listed.

Built with Vite, React, TypeScript, Tailwind CSS v4, Zustand and Firebase (Auth + Firestore).
