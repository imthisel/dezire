# Dizayr: Goal & Net Worth Planner (2026–2040)

Plan how much you want to make and spend every month from 2026 to 2040. Add property, vehicles, investments and status items, and watch your total earned, total spent, money left and net worth update in real time.

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
- **Items** have a kind: Land/Property, Vehicle, Investments, Status & Other and Travel to start with. Add, rename, recolour, reorder or delete kinds with **Edit kinds** (Assets, the sidebar, or the Add item window); there is always at least one. Each item is Appreciating (green), Depreciating (red) or Stable (blue). An item is blocked with an error if it would go over that month's budget.
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
5. **Project settings (gear icon) → General → Your apps → Web (`</>`).** Register an app called "Dizayr" (no Hosting needed). Copy `apiKey`, `authDomain`, `projectId` and `appId` into `.env.local`:
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
5. Back in Firebase: **Authentication → Settings → Authorized domains → Add domain**, and add your Vercel domain (e.g. `dizayr.vercel.app`) plus any custom domain. Google sign-in is blocked on domains that aren't listed.

## The app (install, offline, updates)

Dizayr installs as an app straight from the website (it's a Progressive Web App): **Download the app** on the About page, in the side menu, or in the account menu. Chrome, Edge and Android install in one tap; on iPhone/iPad it shows the two taps (Share → Add to Home Screen). The installed app is the same site, so it uses the same account and data, works offline (edits sync when back online), and needs nothing from an app store.

**Updating the app = pushing to GitHub.** Every deploy gets a version (the commit), written to `/version.json`. The app checks it when it opens, when it comes back to the screen, and every 15 minutes; if there's a newer one it shows **"A new version of Dizayr is ready · Update now"**, and after updating says **"Dizayr was updated"**. Users can also press **Check for updates** in the account menu. Nothing else to do.

## Payments: 7-day free trial and plans (Lemon Squeezy)

How it works: anyone who signs in with Google gets **7 days free** (no card). The trial start is saved once in Firestore (`subscriptions/{uid}`) and can't be restarted. After that, they pick **Yearly ($20)** or **6 months ($15)** in a Lemon Squeezy checkout. Lemon Squeezy tells the site about every subscription change through a webhook (`api/lemonsqueezy.ts`), which unlocks or locks the account. The Firestore rules enforce the same thing, so nobody can use the app past their trial without paying, even by editing the page.

**Full step-by-step setup (Lemon Squeezy, Firebase rules and keys, Vercel settings, testing, going live): see [SETUP-PAYMENTS.md](SETUP-PAYMENTS.md).**

**Reviews** on the About page: add them in [`src/content/reviews.ts`](src/content/reviews.ts). The section only shows on the live site once there's at least one.

**Prices** shown on the page are in [`src/lib/plans.ts`](src/lib/plans.ts). Keep them the same as in Lemon Squeezy. The crossed-out "$40" next to the yearly price should be a real regular price; change or remove `compareAt` if it isn't.

The About page is what signed-out visitors see, and it's always at `/about`.

Built with Vite, React, TypeScript, Tailwind CSS v4, Zustand and Firebase (Auth + Firestore).
