# Dizayr payments: what you sell, and how to set it up (Paddle)

**Your live address is `https://dizayr.com`.** Use it everywhere below. Don't use `www.dizayr.com` or a `.workers.dev` address.

- **Part 1** is what the app sells today.
- **Part 2** is the setup, in order. It takes about an hour, plus a few business days for Paddle to approve your account and website.
- **Part 3** is what to change later if you change a price or a limit.
- **Part 4** is troubleshooting.

**Where you are now:** the app is switched over to Paddle in the code. Nothing is set up in Paddle yet, so start at Step 1.

> **Why US dollars?** Paddle can't charge in Philippine pesos (it isn't one of Paddle's checkout currencies), so the
> plans are priced in USD. Customers with a peso card pay in dollars and their bank converts it.

---

# Part 1: What you sell

## Prices

These are the prices set in the app (`src/lib/plans.ts`). Paddle must charge exactly the same. Prices are in **US dollars** and **include tax**, so customers pay exactly $24.99 or $149 at checkout.

| | Free trial | Yearly | Lifetime |
|---|---|---|---|
| **Price** | Free | **$24.99 per year** | **$149 once** |
| **Works out to** | | about $2.08 a month | never charged again |
| **Length** | 14 days, once per Google account | Renews every year | Forever (a one-time payment, no renewals) |
| **Card needed** | No | Yes (card, PayPal, Apple Pay, Google Pay) | Yes |
| **Wants modes** | 1 | **Unlimited** | **Unlimited** |
| **Needs modes** | 1 | **Unlimited** | **Unlimited** |

## What people get

**Modes are the only difference between the trial and a plan.** The free trial and both paid plans all include:

- Month-by-month planning from 2026 to 2040: money goals, budgets and items
- Net worth, assets and setups
- Yearly goals, the money plan, calendar and tasks, and expenses
- Sync across all their devices, offline use, and the installable app

Each mode has its own plan. The calendar, expenses and goals are shared across all modes.

## The rules the app follows

| Situation | What happens |
|---|---|
| First Google sign-in | The 14-day trial starts. It can't be restarted by the user. |
| Buys during the trial | The plan starts that day. Unused trial days are not added on. |
| Buys without trying first | They sign in, then go straight to checkout. |
| Trial ends with no plan | The app locks and shows "Your free trial has ended" with the plans. Nothing is deleted. |
| Renewal succeeds | Access moves to the next renewal date, plus 3 extra days. |
| Renewal payment is being retried (past due) | They keep access until the renewal date plus 3 days. |
| Cancels | They keep access until the end of the time they paid for (shown as "cancelled, ends on…"), then the app locks. |
| Subscription is paused or canceled | The app locks right away. Nothing is deleted. |
| Has more modes than the trial allows | The extra modes are locked and kept safe. They reopen with a plan. |
| Buys Lifetime | `lifetime: true` is saved on their account for good. Nothing renews. |
| Yearly customer buys Lifetime | They click **Switch to Lifetime** in Plan & billing. After paying, their Yearly subscription is set to stop renewing automatically (no refund for the unused Yearly time). |
| Manage billing (card, invoices, cancel) | The **Manage billing** button opens Paddle's customer portal, already signed in. |
| Refund of a Yearly payment | **A refund alone does not lock the account.** Cancel the subscription too (Step 10). |
| Full refund (or chargeback) of a Lifetime payment | Lifetime access ends automatically. Nothing is deleted. |

**Free access you can give from `/admin`:** lifetime access, free time for any number of days, or a new 14-day trial. Lifetime and free time have unlimited modes. In `/admin`, bought Lifetime shows as **Lifetime (paid)** and counts as paying; given Lifetime shows as **Lifetime (given)**.

## What you actually receive

Paddle is the merchant of record: it is the seller to your customers, and it collects and pays sales tax and VAT for you. Its standard published fee is **5% + 50¢ per transaction**. Check **paddle.com/pricing** for the current fee, because it can change.

Rough estimates, **before tax**:

| Sale | After fees |
|---|---|
| $24.99 Yearly | about $23.24 |
| $149 Lifetime | about $141.05 |

**Your prices include tax, so any tax comes out of these amounts.** How much depends on where the customer lives. For example, with 12% VAT (as in the Philippines), a $24.99 sale includes about $2.68 of tax, so you'd keep roughly $20.50.

**Payouts:** Paddle pays out monthly by bank transfer (or other methods it offers in your country), usually in USD. Set this up in Step 11.

---

# Part 2: Setup

Keep Notepad open. You'll collect these values (sandbox first, then live ones in Step 11):

| Value | Looks like | From |
|---|---|---|
| Client-side token | `test_…` (sandbox) / `live_…` | Step 4 |
| Yearly price ID | `pri_…` | Step 3 |
| Lifetime price ID | `pri_…` | Step 3 |
| API key | `pdl_sdbx_apikey_…` / `pdl_live_apikey_…` | Step 4 |
| Webhook secret key | `pdl_ntfset_…` | Step 8 |
| Firebase service account file | `.json` | Step 5 |

## Step 1: Make Google sign-in work on dizayr.com

Skip this if it's already done. The site already loads on `dizayr.com`, and `www.dizayr.com` already redirects to it. Don't change that in Cloudflare (it's a Redirect Rule there), because payment messages must reach `dizayr.com` directly.

**1a. Firebase**
1. Go to **https://console.firebase.google.com** and open project **dezire-ce767**. The old name in the project ID is normal and can't be changed.
2. Go to **Build → Authentication → Settings → Authorized domains**.
3. Click **Add domain**, type `dizayr.com`, and click **Add**. Do the same for `www.dizayr.com`.

**1b. Google Cloud**

Dizayr signs people in through its own address, so Google has to allow that address too.
1. Go to **https://console.cloud.google.com** and select project **dezire-ce767** at the top.
2. Go to **APIs & Services → Credentials**.
3. Under **OAuth 2.0 Client IDs**, click **Web client (auto created by Google Service)**.
4. Under **Authorized JavaScript origins**, click **Add URI** and paste `https://dizayr.com`
5. Under **Authorized redirect URIs**, click **Add URI** and paste `https://dizayr.com/__/auth/handler`
6. Click **Save**. Keep the existing entries. The change can take a few minutes.
7. Find the app's branding page: **Google Auth Platform → Branding**, or **APIs & Services → OAuth consent screen**. Set the home page to `https://dizayr.com` and add `dizayr.com` under **Authorized domains**. Save.

**Check it:** open `https://dizayr.com` in a private window and sign in with Google. You should reach the app. If you see `redirect_uri_mismatch`, redo 1b.

**Leave `FIREBASE_HOSTING` in `worker/index.ts` alone.** It passes `/__/auth` and `/__/firebase` through to `dezire-ce767.firebaseapp.com`, which is correct.

## Step 2: Create your Paddle accounts, and get your website ready for review

Paddle has two separate accounts: **sandbox** (for testing, fake cards, nothing charged) and **live** (real money). Everything you make in sandbox has to be made again in live (Step 11).

1. Sign up for a **sandbox** account at **https://sandbox-login.paddle.com/signup**.
2. Sign up for a **live** account at **https://login.paddle.com/signup**. When it asks, make sure Paddle accepts sellers from the Philippines. Use `https://dizayr.com` as your website.
3. **Before Paddle reviews your live account, your website needs these pages.** Paddle checks your site and won't approve it without them:
   - **Pricing**: already on the About page.
   - **Terms of service**, which must name Paddle as the seller (merchant of record) of your subscriptions.
   - **Privacy policy**.
   - **Refund policy**. Paddle expects one that lets customers ask for a refund. Check Paddle's current requirement for the number of days.

   The app doesn't have these pages yet. Add them (for example `/terms`, `/privacy`, `/refunds`) and link them in the footer of the About page before you submit for review.
4. In the **live** account, go to **Checkout → Website approval** (or **Business account → Website approval**), add `https://dizayr.com`, and submit it. Review takes a few business days.
5. In **sandbox**, go to **Checkout → Checkout settings** and set the **Default payment link** to `https://dizayr.com`. In sandbox you can also add `http://localhost:5173` while testing on your computer.

## Step 3: Create the product and two prices (sandbox)

Use **one product with two prices**: Yearly (recurring) and Lifetime (one-time).

1. In the sandbox dashboard, go to **Catalog → Products → New product**.
2. **Name:** `Dizayr`. **Tax category:** **Standard digital goods** (or **SaaS**, whichever is offered). **Description:** `Budget each month, track your net worth and expenses, and set yearly goals in one place. Syncs across all your devices and works offline.` Save.
3. In the product, click **New price** and enter:
   - **Description / name:** `Yearly` (customers see this)
   - **Type:** Recurring. **Billing period:** every `1` `year`
   - **Price:** `24.99` **USD**
   - **Tax:** choose **Tax included in the price** (labelled "inclusive" in some places). This makes customers pay exactly $24.99.
   - **Trial period:** none. The website already gives the 14 free days without a card.
4. Click **New price** again:
   - **Name:** `Lifetime`
   - **Type:** **One-time** (not recurring). No billing period.
   - **Price:** `149.00` **USD**, tax included.
5. Copy each price's **ID** (`pri_…`). Save them as **Yearly price ID** and **Lifetime price ID**. Don't mix them up: the webhook uses the Lifetime ID to recognise a Lifetime purchase.

## Step 4: Get your client-side token and API key (sandbox)

1. Go to **Developer tools → Authentication**.
2. **Client-side tokens → New client-side token.** Name it `Dizayr website`. Copy it (`test_…`). This is your **Client-side token**. It's meant to be public, because the checkout uses it in the browser.
3. **API keys → New API key.** Name it `Dizayr server`. Give it these permissions if it asks: **Customers** (read), **Customer portal sessions** (write), **Subscriptions** (read and write). Subscriptions write is what lets the webhook stop a Yearly plan from renewing when that customer buys Lifetime. Copy it straight away, as it's only shown once. This is your **API key**. **Keep it secret**: it can change subscriptions.

## Step 5: Firebase rules and server key

**5a. Publish the security rules.** These enforce the trial and paywall on the server. **Publish them again now even if you did before: the trial changed from 7 to 14 days.**
1. In the Firebase console, go to **Build → Firestore Database → Rules**. **Don't use "Realtime Database"**: it's a different product, and these rules give `Line 1: Parse error` there.
2. In VS Code, open `firestore.rules`, press **Ctrl+A**, then **Ctrl+C**.
3. In the Firebase editor, press **Ctrl+A**, then **Ctrl+V**.
4. Click **Publish**.

**5b. Download the service account key.** Skip this if `FIREBASE_SERVICE_ACCOUNT` is already in Cloudflare.
1. Click the **gear icon ⚙ → Project settings → Service accounts**.
2. Click **Generate new private key → Generate key**. A `.json` file downloads.
3. **Keep it secret.** Don't put it in the project folder or on GitHub, and don't send it to anyone. It gives full control of your database.

## Step 6: Remove the old Lemon Squeezy webhook

If you set up a webhook in Lemon Squeezy, delete it there (**Settings → Webhooks**). Its address, `/api/lemonsqueezy`, no longer exists. Don't add any `LS_…` or `LEMONSQUEEZY_…` settings to Cloudflare: the app no longer reads them.

## Step 7: Add the settings to Cloudflare

Open **https://dash.cloudflare.com → Workers & Pages → dizayr → Settings**. Cloudflare keeps settings in **two different places**, and some must go in both:

- **Build → Variables and secrets** (under Settings → Build): values baked into the app when it's built. The browser needs these.
- **Variables and Secrets** (under Settings, near the top): values the server (`/api/…`) reads while it runs.

| Key (copy exactly) | Build variables | Variables and Secrets (server) | Value |
|---|---|---|---|
| `VITE_FIREBASE_API_KEY` | ✅ | ✅ type **Text** | From `.env.local` |
| `VITE_FIREBASE_AUTH_DOMAIN` | ✅ | | From `.env.local` |
| `VITE_FIREBASE_PROJECT_ID` | ✅ | | From `.env.local` |
| `VITE_FIREBASE_APP_ID` | ✅ | | From `.env.local` |
| `VITE_PADDLE_ENV` | ✅ | ✅ type **Text** | `sandbox` (while testing) |
| `VITE_PADDLE_CLIENT_TOKEN` | ✅ | | Client-side token |
| `VITE_PADDLE_PRICE_ANNUAL` | ✅ | ✅ type **Text** | Yearly price ID |
| `VITE_PADDLE_PRICE_LIFETIME` | ✅ | ✅ type **Text** | Lifetime price ID |
| `PADDLE_API_KEY` | | ✅ type **Secret** | API key |
| `PADDLE_WEBHOOK_SECRET` | | ✅ type **Secret** | Webhook secret key (from Step 8; add it then) |
| `FIREBASE_SERVICE_ACCOUNT` | | ✅ type **Secret** | The whole service account file, from the first `{` to the last `}` |
| `ADMIN_PASSWORD` | | ✅ type **Secret** | A password of 8+ characters for `https://dizayr.com/admin` |

The `VITE_` values are meant to be public (the checkout runs in the customer's browser), so type **Text** is right for them. Don't rename them. The four marked in both columns must have **the same value in both places**: the server uses them to check who's asking for **Manage billing**, which payments are test ones, and which price is Yearly or Lifetime.

**After a change:**
- **Variables and Secrets** (server): click **Deploy** when Cloudflare asks. It takes effect within seconds; no rebuild needed.
- **Build variables**: they only apply to a new build. Go to **Deployments**, open the latest build, and click **Retry build** (or push any commit).

**To try checkout on your own computer (optional):** add only these four lines to `.env.local`. The others are server secrets and must stay out of it. (Manage billing needs the server: it works on the deployed site, or with `npm run cf:dev` and a `.dev.vars` file, see `.dev.vars.example`.)

```
VITE_PADDLE_ENV=sandbox
VITE_PADDLE_CLIENT_TOKEN=your test_ token
VITE_PADDLE_PRICE_ANNUAL=your yearly pri_ ID
VITE_PADDLE_PRICE_LIFETIME=your lifetime pri_ ID
```

## Step 8: Connect the webhook, and give yourself free access

**Webhook** (in sandbox):
1. Go to **Developer tools → Notifications → New destination**.
2. **Description:** `Dizayr`. **Type:** Webhook.
3. **URL:** `https://dizayr.com/api/paddle`, with no `www` and no `/` at the end.
4. **Events:** tick all of the **subscription** ones:
   - `subscription.created`
   - `subscription.updated`
   - `subscription.activated`
   - `subscription.canceled`
   - `subscription.past_due`
   - `subscription.paused`
   - `subscription.resumed`
   - `subscription.trialing`
   - `subscription.imported`
   - `transaction.completed` (Lifetime purchases)
   - `adjustment.created` and `adjustment.updated` (refunds and chargebacks, so a refunded Lifetime is taken back)
5. Save. Then open the destination (**⋯ → Edit destination**) and copy its **Secret key** (`pdl_ntfset_…`). Add it in Cloudflare as `PADDLE_WEBHOOK_SECRET` (**Variables and Secrets**, type Secret) and click **Deploy**.

**Test vs real payments:** sandbox and live have **different** secret keys. Whichever one is in Cloudflare decides which payments count. With the sandbox key, only test payments unlock accounts. With the live key, test payments are refused. You swap it in Step 11.

**Your own account** (otherwise your trial runs out too). Skip this if you already have lifetime access.
1. Sign in at `https://dizayr.com` with your own Google account.
2. Open `https://dizayr.com/admin`, sign in with `ADMIN_PASSWORD`, open your user, and give **lifetime access**.
3. If `/admin` won't open, do it by hand. Copy your **User UID** from Firebase **Authentication → Users**. Then in **Firestore Database → Data → subscriptions →** your UID, click **+ Add field**: Field `lifetime`, Type **boolean**, Value **true**.
4. Reload the site. The trial bar should be gone.

## Step 9: Test everything (sandbox, nothing is charged)

Use a **spare Google account** in a private window. Do these in order, because one account goes through the whole journey.

**Trial**
1. Open `https://dizayr.com` and click **Start your plan free**. Sign in with the spare account.
2. The top bar should say **"Free trial · 14 of 14 days left"**.
3. **Settings → Your plan → Modes** should say **1 + 1**.
4. Try to add a second Wants mode. The app should offer plans instead of creating it.

**Yearly plan**

5. Click **Choose a plan → Buy Yearly now**. The Paddle checkout should open over the page with the email filled in and show **$24.99**.
6. Pay with test card **4242 4242 4242 4242**, any future date such as `12/30`, CVC `100`, and any name and country.
7. You should see **"Payment received! Activating your plan…"**, then **"You're all set"** within a few seconds. The trial bar disappears.
8. In Firestore, open **subscriptions →** that account's UID. It should show `status: active`, `plan: annual`, `customerId: ctm_…`, `subscriptionId: sub_…`, and an `accessUntil` about a year away.
9. **Settings → Your plan → Modes** should say **unlimited**. The header button should say **Premium**.
10. In Paddle, go to **Developer tools → Notifications → your destination → Logs** (or **Events**). The deliveries should show **200**.

**Manage billing**

11. **Settings → Your plan → Manage billing** should open Paddle's customer portal in a new tab, already signed in, showing the subscription.

**Switching to Lifetime**

12. In the app, open **Plan & billing**. The Yearly card should say **Your plan**, and the Lifetime card **Switch to Lifetime**. Click it: the checkout should show **$149.00**. Pay with the test card.
13. Within a few seconds you should see **"Lifetime unlocked"**. Firestore should show `lifetime: true` and a `lifetimeTransactionId: txn_…`. In Paddle, the Yearly subscription should now be **scheduled to cancel** at the end of its period. In `/admin`, the user shows as **Lifetime (paid)**.
    - If the subscription isn't scheduled to cancel: the API key is missing **Subscriptions (write)** (Step 4). Cancel it by hand for now.

**Refunding Lifetime**

14. In Paddle, find that $149 transaction and refund it in full (sandbox refunds are approved quickly). Firestore should then show `lifetime: false` and a `lifetimeRefundedAt`.

**Cancelling** (use a second spare account that buys Yearly, since the first one's Yearly is already set to end)

15. **Manage billing** → cancel the subscription in the portal.
16. Firestore should show `status: cancelled`. The app should still open, and the plan window should say **"Your plan is cancelled and ends on…"**.

**Locking**

17. In Firestore, on a test account's document, delete `accessUntil`, set `lifetime` to false, and set `trialStartedAt` to a date 15+ days ago.
18. Reload the site. You should see **"Your free trial has ended"** with the plans.

**Don't go live until all 18 pass.**

## Step 10: Refunds and cancellations (how to do them)

In Paddle, go to **Customers → Subscriptions** (or search for the `sub_…` ID shown on the user's page in `/admin`).
- **Cancel:** open the subscription → **Cancel**. Pick **at the end of the billing period** (they keep what they paid for) or **immediately** (locks the app now).
- **Refund a Yearly payment:** open the transaction → **Refund**. **A refund alone doesn't lock the account**, so cancel the subscription immediately too.
- **Refund a Lifetime payment:** open the transaction → **Refund** (full). Once Paddle approves it, lifetime access ends by itself. A partial refund keeps Lifetime.

## Step 11: Go live (real money)

1. Wait for Paddle to approve your live account and website (Step 2).
2. Add your payout details in the live dashboard (**Business account → Payouts**).
3. **Repeat Steps 2.5, 3, 4 and 8 in the live account.** Live prices, tokens, keys and the webhook secret are all **different** from sandbox ones. In live, the default payment link must be `https://dizayr.com`.
4. In Cloudflare, replace these with the live values (in **every** place Step 7 lists them), then **Retry build**:
   - `VITE_PADDLE_ENV`: set it to `production` (build variables **and** server)
   - `VITE_PADDLE_CLIENT_TOKEN` (`live_…`, build variables)
   - `VITE_PADDLE_PRICE_ANNUAL` (build variables **and** server)
   - `VITE_PADDLE_PRICE_LIFETIME` (build variables **and** server)
   - `PADDLE_API_KEY` (live key, server)
   - `PADDLE_WEBHOOK_SECRET` (live destination's secret key, server)
5. **Real purchase test:** with a spare account, buy Yearly with your real card.
   - Check Firestore shows `plan: annual` and `testMode: false`, and that the webhook shows **200**.
   - Refund it and cancel it immediately (Step 10).

**Tip:** to keep testing safely after going live, test with sandbox values on your own computer (`npm run cf:dev` with a `.dev.vars` file), never by switching the live site back to sandbox.

---

# Part 3: If you change something later

**Change a price**
1. Paddle (live): add a new price on the product (Paddle prices can't be edited once used). Archive the old one.
2. Cloudflare: put the new price's `pri_…` ID in `VITE_PADDLE_PRICE_ANNUAL` or `VITE_PADDLE_PRICE_LIFETIME` (in **both** build variables and server, Step 7), and retry the build. Existing subscribers stay on the old price unless you move them in Paddle.
3. `src/lib/plans.ts`: change `price` (the admin revenue figure reads it from there too).
4. Change the prices in the `<noscript>` text in `index.html`.
5. Push to GitHub.

**Change how many modes a plan includes**
1. `src/billing.ts`: change the numbers in `modeLimit`.
2. `src/lib/plans.ts`: change `perks`.
3. `src/components/About.tsx`: change the "What are modes?" and free trial answers in the FAQ.
4. Paddle: change the price descriptions.
5. Push to GitHub.

**Change the trial length**
1. `src/lib/plans.ts`: change `TRIAL_DAYS`.
2. `firestore.rules`: change `duration.value(14, 'd')`, then publish it again (Step 5a). If the two don't match, people get locked out or kept in at the wrong time.
3. Update the `<noscript>` text in `index.html`. Everything else in the app reads `TRIAL_DAYS`.
4. Push to GitHub.

---

# Part 4: Troubleshooting

| What you see | Cause | Fix |
|---|---|---|
| `redirect_uri_mismatch` at Google sign-in | Google doesn't allow `dizayr.com` yet | Step 1b |
| Sign-in popup closes with an error | Domain not authorized in Firebase | Step 1a |
| "Payments aren't set up yet" | Token or price IDs missing from the build | Check the four `VITE_PADDLE_…` **build variables** (Step 7), then **Retry build** |
| "Couldn't open the checkout" | Paddle.js didn't load (ad blocker, offline), or a sandbox token with `VITE_PADDLE_ENV` not set to `sandbox` (or the other way round) | Try without the ad blocker; check `VITE_PADDLE_ENV` matches the token (`test_` = sandbox) |
| Checkout opens then shows an error | Default payment link not set, or the website isn't approved yet (live) | Step 2.4 and 2.5 |
| Checkout blocked, browser console mentions "Content Security Policy" | Paddle loaded something from a new address | Add that address to the `Content-Security-Policy` in `public/_headers` and push |
| Paid, but the account stays locked | The webhook isn't getting through | See the webhook codes below |
| Paid $149 but the account isn't Lifetime | `transaction.completed` isn't ticked on the webhook, or `VITE_PADDLE_PRICE_LIFETIME` is wrong | Fix it (Step 8 / Step 7), redeploy, then replay the `transaction.completed` event from the notification logs |
| Bought Lifetime but Yearly still renews | The API key can't write subscriptions | Give it **Subscriptions (write)** (Step 4), and cancel that subscription by hand in Paddle |
| **Manage billing** says it couldn't open | `PADDLE_API_KEY` missing or from the other environment (sandbox vs live) | Step 4 / Step 11. Details in Cloudflare → dizayr → **Logs**, search `billing` |
| **Manage billing** says there's no payment | The account has no Paddle customer saved yet (the webhook never reached it) | Check the webhook |
| Refunded customer still has access | A refund alone doesn't lock | Cancel the subscription immediately (Step 10) |
| Someone uses the app after their trial | Rules not published | Step 5a |
| "Could not load your data" for a new user | Their trial record wasn't created | Ask them to reload, then check they appear under `subscriptions` |
| You're locked out of your own account | `lifetime` missing | Step 8 |

**Webhook codes** (Paddle → Developer tools → Notifications → your destination → logs):

| Code | Meaning | Fix |
|---|---|---|
| **401** | The secret key doesn't match Cloudflare's, or it's the other environment's key, or the server's clock is far off | Copy the destination's secret key into `PADDLE_WEBHOOK_SECRET` again, then click **Deploy** |
| **404** | Wrong URL, or the code isn't deployed | It must be exactly `https://dizayr.com/api/paddle` |
| **307 or 308** | The URL is redirecting | Remove `www` and any `/` at the end |
| **500** | `FIREBASE_SERVICE_ACCOUNT` is wrong or incomplete | Paste the whole file again, then redeploy |
| **503** | `PADDLE_WEBHOOK_SECRET` isn't set | Step 8, then redeploy |

Paddle retries failed deliveries for a while. After you fix the problem, **replay the failed event** from the destination's logs, or the customer stays locked. For error details, go to Cloudflare → Workers & Pages → dizayr → **Logs** and search `paddle`.

**Quick check:** open `https://dizayr.com/api/paddle` in a browser. "Method not allowed" (405) is correct, because that address only accepts messages from Paddle. A 404 means the code isn't deployed.
