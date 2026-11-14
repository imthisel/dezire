# Dizayr payments: what you sell, and how to set it up (Paddle)

**Your live address is `https://dizayr.com`.** Use it everywhere below. Don't use `www.dizayr.com` or an old `.vercel.app` address.

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

These are the prices set in the app (`src/lib/plans.ts`). Paddle must charge exactly the same. Prices are in **US dollars** and **include tax**, so customers pay exactly $16 or $22 at checkout.

| | Free trial | 6 months | Yearly |
|---|---|---|---|
| **Price** | Free | **$16 every 6 months** | **$22 per year** |
| **Works out to** | | about $2.67 a month | about $1.83 a month |
| **Over a full year** | | $32 | $22 |
| **Length** | 7 days, once per Google account | Renews every 6 months | Renews every year |
| **Card needed** | No | Yes (card, PayPal, Apple Pay, Google Pay) | Yes |
| **Wants modes** | 1 | 2 | **Unlimited** |
| **Needs modes** | 1 | 2 | **Unlimited** |
| **Total modes** | 2 | 4 | **Unlimited** |

## What people get

**Modes are the only difference between the plans.** The free trial and both paid plans all include:

- Month-by-month planning from 2026 to 2040: money goals, budgets and items
- Net worth, assets and setups
- Yearly goals, the money plan, calendar and tasks, and expenses
- Sync across all their devices, offline use, and the installable app

Each mode has its own plan. The calendar, expenses and goals are shared across all modes.

## The rules the app follows

| Situation | What happens |
|---|---|
| First Google sign-in | The 7-day trial starts. It can't be restarted by the user. |
| Buys during the trial | The plan starts that day. Unused trial days are not added on. |
| Buys without trying first | They sign in, then go straight to checkout. |
| Trial ends with no plan | The app locks and shows "Your free trial has ended" with the plans. Nothing is deleted. |
| Renewal succeeds | Access moves to the next renewal date, plus 3 extra days. |
| Renewal payment is being retried (past due) | They keep access until the renewal date plus 3 days. |
| Cancels | They keep access until the end of the time they paid for (shown as "cancelled, ends on…"), then the app locks. |
| Subscription is paused or canceled | The app locks right away. Nothing is deleted. |
| Has more modes than the plan allows | The extra modes are locked and kept safe. They reopen with a bigger plan. |
| 6-month customer wants Yearly | They click **Go Yearly → Upgrade to Yearly** in the app. They see the price first (the yearly price minus credit for their unused 6-month time), and it's charged to the card on file. Paddle's billing page can't change plans, so this is done in the app. |
| Manage billing (card, invoices, cancel) | The **Manage billing** button opens Paddle's customer portal, already signed in. |
| Refund | **A refund alone does not lock the account.** Cancel the subscription too (Step 10). |

**Free access you can give from `/admin`:** lifetime access, free time for any number of days, or a new 7-day trial. Lifetime and free time have unlimited modes.

## What you actually receive

Paddle is the merchant of record: it is the seller to your customers, and it collects and pays sales tax and VAT for you. Its standard published fee is **5% + 50¢ per transaction**. Check **paddle.com/pricing** for the current fee, because it can change.

Rough estimates, **before tax**:

| Sale | After fees |
|---|---|
| $22 Yearly | about $20.40 |
| $16 for 6 months | about $14.70 |

The 50¢ part of the fee matters a lot at these prices. **Your prices include tax, so any tax comes out of these amounts.** How much depends on where the customer lives. For example, with 12% VAT (as in the Philippines), a $22 sale includes about $2.36 of tax.

**Payouts:** Paddle pays out monthly by bank transfer (or other methods it offers in your country), usually in USD. Set this up in Step 11.

---

# Part 2: Setup

Keep Notepad open. You'll collect these values (sandbox first, then live ones in Step 11):

| Value | Looks like | From |
|---|---|---|
| Client-side token | `test_…` (sandbox) / `live_…` | Step 4 |
| Yearly price ID | `pri_…` | Step 3 |
| 6-month price ID | `pri_…` | Step 3 |
| API key | `pdl_sdbx_apikey_…` / `pdl_live_apikey_…` | Step 4 |
| Webhook secret key | `pdl_ntfset_…` | Step 8 |
| Firebase service account file | `.json` | Step 5 |

## Step 1: Make Google sign-in work on dizayr.com

Skip this if it's already done. The site already loads on `dizayr.com`, and `www.dizayr.com` already redirects to it. Don't change that in Vercel, because payment messages must reach `dizayr.com` directly.

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

**Leave `vercel.json`'s rewrites alone.** The `dezire-ce767.firebaseapp.com` entries in it are correct.

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

Use **one product with two prices**, so customers can move from 6 months to Yearly.

1. In the sandbox dashboard, go to **Catalog → Products → New product**.
2. **Name:** `Dizayr`. **Tax category:** **Standard digital goods** (or **SaaS**, whichever is offered). **Description:** `Plan the life you want, month by month. Every feature, on every device.` Save.
3. In the product, click **New price** and enter:
   - **Description / name:** `Yearly` (customers see this)
   - **Type:** Recurring. **Billing period:** every `1` `year`
   - **Price:** `22.00` **USD**
   - **Tax:** choose **Tax included in the price** (labelled "inclusive" in some places). This makes customers pay exactly $22.
   - **Trial period:** none. The website already gives the 7 free days without a card.
4. Click **New price** again:
   - **Name:** `6 months`
   - **Billing period:** every `6` `months`
   - **Price:** `16.00` **USD**, tax included, no trial.
5. Copy each price's **ID** (`pri_…`). Save them as **Yearly price ID** and **6-month price ID**. Don't mix them up: the app uses them to decide how many modes someone gets.

## Step 4: Get your client-side token and API key (sandbox)

1. Go to **Developer tools → Authentication**.
2. **Client-side tokens → New client-side token.** Name it `Dizayr website`. Copy it (`test_…`). This is your **Client-side token**. It's meant to be public, because the checkout uses it in the browser.
3. **API keys → New API key.** Name it `Dizayr server`. Give it these permissions if it asks: **Customers** (read), **Customer portal sessions** (write), **Subscriptions** (read and write). Copy it straight away, as it's only shown once. This is your **API key**. **Keep it secret**: it can change subscriptions.

## Step 5: Firebase rules and server key

**5a. Publish the security rules.** These enforce the trial and paywall on the server. Skip this if you already published them for Lemon Squeezy: they haven't changed.
1. In the Firebase console, go to **Build → Firestore Database → Rules**. **Don't use "Realtime Database"**: it's a different product, and these rules give `Line 1: Parse error` there.
2. In VS Code, open `firestore.rules`, press **Ctrl+A**, then **Ctrl+C**.
3. In the Firebase editor, press **Ctrl+A**, then **Ctrl+V**.
4. Click **Publish**.

**5b. Download the service account key.** Skip this if `FIREBASE_SERVICE_ACCOUNT` is already in Vercel.
1. Click the **gear icon ⚙ → Project settings → Service accounts**.
2. Click **Generate new private key → Generate key**. A `.json` file downloads.
3. **Keep it secret.** Don't put it in the project folder or on GitHub, and don't send it to anyone. It gives full control of your database.

## Step 6: Remove the old Lemon Squeezy settings from Vercel

In **Vercel → your project → Settings → Environment Variables**, delete these if they're there. The app no longer reads them:

`VITE_LS_CHECKOUT_ANNUAL`, `VITE_LS_CHECKOUT_SEMIANNUAL`, `VITE_LS_STORE_URL`, `LS_VARIANT_ANNUAL`, `LS_VARIANT_SEMIANNUAL`, `LEMONSQUEEZY_WEBHOOK_SECRET`, `LS_ALLOW_TEST_MODE`

If you set up a webhook in Lemon Squeezy, delete it there too (**Settings → Webhooks**). Its address, `/api/lemonsqueezy`, no longer exists.

## Step 7: Add the Paddle settings to Vercel

1. In **Vercel → Settings → Environment Variables**, add each of these with **Production** and **Preview** ticked:

| Key (copy exactly) | Type | Value |
|---|---|---|
| `VITE_PADDLE_ENV` | **Config** | `sandbox` (while testing) |
| `VITE_PADDLE_CLIENT_TOKEN` | **Config** | Client-side token |
| `VITE_PADDLE_PRICE_ANNUAL` | **Config** | Yearly price ID |
| `VITE_PADDLE_PRICE_SEMIANNUAL` | **Config** | 6-month price ID |
| `PADDLE_API_KEY` | Secret | API key |
| `PADDLE_WEBHOOK_SECRET` | Secret | Webhook secret key (from Step 8; add it then) |
| `FIREBASE_SERVICE_ACCOUNT` | Secret | The whole service account file (if not there yet) |
| `ADMIN_PASSWORD` | Secret | A password of 8+ characters for `https://dizayr.com/admin` (if not there yet) |

   Vercel warns about the `VITE_` prefix on the first four. That's expected: they're meant to be public, because the checkout runs in the customer's browser. Click **Change to Config**. Don't rename them.

   `VITE_FIREBASE_API_KEY` must also be there (it already is if sign-in works). The server uses it to check who's asking for **Manage billing** and upgrades.

2. **Redeploy:** go to **Deployments**, click **⋯** on the latest one, then **Redeploy**. Settings only apply to a new deployment. Do this every time you change one.

**To try checkout on your own computer (optional):** add only these four lines to `.env.local`. The others are server secrets and must stay out of it. (Manage billing and upgrades need the server, so they only work on Vercel.)

```
VITE_PADDLE_ENV=sandbox
VITE_PADDLE_CLIENT_TOKEN=your test_ token
VITE_PADDLE_PRICE_ANNUAL=your yearly pri_ ID
VITE_PADDLE_PRICE_SEMIANNUAL=your 6-month pri_ ID
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
5. Save. Then open the destination (**⋯ → Edit destination**) and copy its **Secret key** (`pdl_ntfset_…`). Add it to Vercel as `PADDLE_WEBHOOK_SECRET` and **Redeploy**.

**Test vs real payments:** sandbox and live have **different** secret keys. Whichever one is in Vercel decides which payments count. With the sandbox key, only test payments unlock accounts. With the live key, test payments are refused. You swap it in Step 11.

**Your own account** (otherwise your trial runs out too). Skip this if you already have lifetime access.
1. Sign in at `https://dizayr.com` with your own Google account.
2. Open `https://dizayr.com/admin`, sign in with `ADMIN_PASSWORD`, open your user, and give **lifetime access**.
3. If `/admin` won't open, do it by hand. Copy your **User UID** from Firebase **Authentication → Users**. Then in **Firestore Database → Data → subscriptions →** your UID, click **+ Add field**: Field `lifetime`, Type **boolean**, Value **true**.
4. Reload the site. The trial bar should be gone.

## Step 9: Test everything (sandbox, nothing is charged)

Use a **spare Google account** in a private window. Do these in order, because one account goes through the whole journey.

**Trial**
1. Open `https://dizayr.com` and click **Start your 7-day free trial**. Sign in with the spare account.
2. The top bar should say **"Free trial · 7 of 7 days left"**.
3. **Settings → Your plan → Modes** should say **1 + 1**.
4. Try to add a second Wants mode. The app should offer plans instead of creating it.

**6-month plan**

5. Click **Choose a plan → Buy 6 months now**. The Paddle checkout should open over the page with the email filled in and show **$16.00**.
6. Pay with test card **4242 4242 4242 4242**, any future date such as `12/30`, CVC `100`, and any name and country.
7. You should see **"Payment received! Activating your plan…"**, then **"You're all set"** within a few seconds. The trial bar disappears.
8. In Firestore, open **subscriptions →** that account's UID. It should show `status: active`, `plan: semiannual`, `customerId: ctm_…`, `subscriptionId: sub_…`, and an `accessUntil` about 6 months away.
   - **It must say `semiannual`.** If it doesn't, the price IDs in Vercel are wrong or swapped.
9. **Settings → Your plan → Modes** should say **2 + 2**. The header button should say **Go Yearly**.
10. In Paddle, go to **Developer tools → Notifications → your destination → Logs** (or **Events**). The deliveries should show **200**.

**Manage billing**

11. **Settings → Your plan → Manage billing** should open Paddle's customer portal in a new tab, already signed in, showing the subscription.

**Moving up to Yearly**

12. In the app, click **Go Yearly**, then **Upgrade to Yearly** on the Yearly card. It should ask you to confirm, showing an amount less than $22 (the yearly price minus credit for unused 6-month time).
13. Confirm. Within a few seconds Firestore should show `plan: annual`, and the mode count should say **unlimited**.

**Cancelling**

14. **Manage billing** → cancel the subscription in the portal.
15. Firestore should show `status: cancelled`. The app should still open, and the plan window should say **"Your plan is cancelled and ends on…"**.

**Locking**

16. In Firestore, on the test account's document, delete `accessUntil` and set `trialStartedAt` to a date 8+ days ago.
17. Reload the site. You should see **"Your free trial has ended"** with the plans.

**Don't go live until all 17 pass.**

## Step 10: Refunds and cancellations (how to do them)

In Paddle, go to **Customers → Subscriptions** (or search for the `sub_…` ID shown on the user's page in `/admin`).
- **Cancel:** open the subscription → **Cancel**. Pick **at the end of the billing period** (they keep what they paid for) or **immediately** (locks the app now).
- **Refund:** open the transaction → **Refund**. **A refund alone doesn't lock the account**, so cancel the subscription immediately too.

## Step 11: Go live (real money)

1. Wait for Paddle to approve your live account and website (Step 2).
2. Add your payout details in the live dashboard (**Business account → Payouts**).
3. **Repeat Steps 2.5, 3, 4 and 8 in the live account.** Live prices, tokens, keys and the webhook secret are all **different** from sandbox ones. In live, the default payment link must be `https://dizayr.com`.
4. In Vercel, replace these with the live values, then **Redeploy**:
   - `VITE_PADDLE_ENV`: delete it, or set it to `production`
   - `VITE_PADDLE_CLIENT_TOKEN` (`live_…`)
   - `VITE_PADDLE_PRICE_ANNUAL`
   - `VITE_PADDLE_PRICE_SEMIANNUAL`
   - `PADDLE_API_KEY` (live key)
   - `PADDLE_WEBHOOK_SECRET` (live destination's secret key)
5. **Real purchase test:** with a spare account, buy the 6-month plan with your real card.
   - Check Firestore shows `plan: semiannual` and `testMode: false`, and that the webhook shows **200**.
   - Refund it and cancel it immediately (Step 10).

**Tip:** to keep testing safely after going live, use a Vercel **Preview** deployment with the sandbox values (set them for **Preview** only), and point a sandbox notification destination at that preview's address.

---

# Part 3: If you change something later

**Change a price**
1. Paddle (live): add a new price on the product (Paddle prices can't be edited once used). Archive the old one.
2. Vercel: put the new price's `pri_…` ID in `VITE_PADDLE_PRICE_ANNUAL` or `VITE_PADDLE_PRICE_SEMIANNUAL`, and redeploy. Existing subscribers stay on the old price unless you move them in Paddle.
3. `src/lib/plans.ts`: change `price`.
4. `src/admin/data.ts`: change `PLAN_PRICE`, which the admin revenue figure uses.
5. Push to GitHub.

**Change how many modes a plan includes**
1. `src/billing.ts`: change the numbers in `modeLimit`.
2. `src/lib/plans.ts`: change `perks`.
3. `src/components/About.tsx`: change the "What are modes?" and free trial answers in the FAQ.
4. Paddle: change the price descriptions.
5. Push to GitHub.

**Change the trial length**
1. `src/lib/plans.ts`: change `TRIAL_DAYS`.
2. `firestore.rules`: change `duration.value(7, 'd')`, then publish it again (Step 5a). If the two don't match, people get locked out or kept in at the wrong time.
3. Search the project for `7-day` and `7 days`, and update the wording, including `index.html` and the admin page.
4. Push to GitHub.

---

# Part 4: Troubleshooting

| What you see | Cause | Fix |
|---|---|---|
| `redirect_uri_mismatch` at Google sign-in | Google doesn't allow `dizayr.com` yet | Step 1b |
| Sign-in popup closes with an error | Domain not authorized in Firebase | Step 1a |
| "Payments aren't set up yet" | Token or price IDs missing from the build | Check the four `VITE_PADDLE_…` settings (Step 7), then **Redeploy** |
| "Couldn't open the checkout" | Paddle.js didn't load (ad blocker, offline), or a sandbox token with `VITE_PADDLE_ENV` not set to `sandbox` (or the other way round) | Try without the ad blocker; check `VITE_PADDLE_ENV` matches the token (`test_` = sandbox) |
| Checkout opens then shows an error | Default payment link not set, or the website isn't approved yet (live) | Step 2.4 and 2.5 |
| Checkout blocked, browser console mentions "Content Security Policy" | Paddle loaded something from a new address | Add that address to the CSP in `vercel.json` and push |
| Paid, but the account stays locked | The webhook isn't getting through | See the webhook codes below |
| 6-month customer has unlimited modes | `plan` is wrong in Firestore | Fix the price IDs in Vercel and redeploy. Then replay that customer's latest event from Paddle's notification logs. |
| **Manage billing** says it couldn't open | `PADDLE_API_KEY` missing or from the other environment (sandbox vs live) | Step 4 / Step 11, then redeploy. Details in Vercel **Logs**, filter `/api/billing` |
| **Manage billing** says there's no payment | The account has no Paddle customer saved yet (the webhook never reached it) | Check the webhook |
| Upgrade says Paddle couldn't make the change | Card declined, or a renewal is less than 30 minutes away | Nothing was charged; try again later or update the card in Manage billing |
| Refunded customer still has access | A refund alone doesn't lock | Cancel the subscription immediately (Step 10) |
| Someone uses the app after their trial | Rules not published | Step 5a |
| "Could not load your data" for a new user | Their trial record wasn't created | Ask them to reload, then check they appear under `subscriptions` |
| You're locked out of your own account | `lifetime` missing | Step 8 |

**Webhook codes** (Paddle → Developer tools → Notifications → your destination → logs):

| Code | Meaning | Fix |
|---|---|---|
| **401** | The secret key doesn't match Vercel, or it's the other environment's key, or the server's clock is far off | Copy the destination's secret key into `PADDLE_WEBHOOK_SECRET` again, then redeploy |
| **404** | Wrong URL, or the code isn't deployed | It must be exactly `https://dizayr.com/api/paddle` |
| **307 or 308** | The URL is redirecting | Remove `www` and any `/` at the end |
| **500** | `FIREBASE_SERVICE_ACCOUNT` is wrong or incomplete | Paste the whole file again, then redeploy |
| **503** | `PADDLE_WEBHOOK_SECRET` isn't set | Step 8, then redeploy |

Paddle retries failed deliveries for a while. After you fix the problem, **replay the failed event** from the destination's logs, or the customer stays locked. For error details, go to Vercel → your project → **Logs** and filter by `/api/paddle`.

**Quick check:** open `https://dizayr.com/api/paddle` in a browser. "Method not allowed" (405) is correct, because that address only accepts messages from Paddle. A 404 means the code isn't deployed.
