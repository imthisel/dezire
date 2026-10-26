# Setting up payments, the free trial and security (step by step)

Do these in order. It takes about 30–45 minutes. You need: your **Lemon Squeezy** account (new), your **Firebase** project (you already have it), your **Vercel** project (you already have it), and **Notepad**.

Keep a note open while you work. You'll collect these 7 values:

| Value | Where it comes from | Example |
|---|---|---|
| Yearly checkout link | Lemon Squeezy, Step 3 | `https://dizayr.lemonsqueezy.com/checkout/buy/8f2c…` |
| 6-month checkout link | Lemon Squeezy, Step 3 | `https://dizayr.lemonsqueezy.com/checkout/buy/1a9d…` |
| Store address | Lemon Squeezy, Step 1 | `https://dizayr.lemonsqueezy.com` |
| Yearly variant ID | Lemon Squeezy, Step 3 | `612345` |
| 6-month variant ID | Lemon Squeezy, Step 3 | `612346` |
| Webhook secret | You make it up, Step 5 | `k3J9xQ2mV8pL4tR7wZ1nB6yH0cF5sD2a` |
| Firebase service account | Firebase, Step 4 | a `.json` file |

---

## Step 1: Create your Lemon Squeezy store

1. Go to **https://app.lemonsqueezy.com/register** and sign up.
2. When it asks for a store name, type **Dizayr**. Your store address becomes something like `https://dizayr.lemonsqueezy.com`. Write it down as **Store address**.
3. Your new store starts in **Test mode** (a toggle in the dashboard says "Test mode"). Leave it on for now. Nothing real gets charged in test mode.

## Step 2: Create the two plans (as two products)

Do this twice: once for Yearly, once for 6 months.

**Product A: Yearly**
1. In the dashboard, click **+** (top right) → **New Product**.
2. **Name:** `Dizayr Yearly`
3. **Description:** `Full access to Dizayr for one year. Every feature, every device.`
4. Under **Pricing**, choose **Subscription**.
5. **Price:** `20` (USD).
6. Set how often it repeats to **every 1 year** (in the subscription settings, "repeat payment every 1 Year" or similar).
7. **Free trial:** leave it **off**. (The website already gives 7 days free without a card.)
8. **Tax category:** choose **SaaS / Software as a service**. If that isn't listed, pick the closest "software" or "digital service" option.
9. **Files:** leave empty; Dizayr is a website, so there's nothing to download. (If it refuses to publish without a file, upload a small PDF like a "Welcome to Dizayr" note.)
10. Click **Publish Product**.

**Product B: 6 months**
Repeat the same steps with:
- **Name:** `Dizayr 6 Months`
- **Description:** `Full access to Dizayr for six months. Every feature, every device.`
- **Price:** `15`
- **Repeats every 6 months** (6, Month)

## Step 3: Copy the checkout links and variant IDs

For **each** of the two products:

1. Go to **Store → Products**.
2. **Checkout link:** click **Share** on the product. Copy the checkout URL that looks like `https://dizayr.lemonsqueezy.com/checkout/buy/…`.
   - Copy it from the Share window. Don't open the link and copy it from your browser's address bar afterwards: once opened, it turns into a single-use `?cart=` link that won't work for others.
3. **Variant ID:** click the **⋯** (three dots) next to the product → **Copy Variant ID**. It's a number like `612345`.
   - If you don't see that option: open the product, find it under **Variants**, click **⋯** → **Copy ID**.

Write all four into your note: **Yearly checkout link**, **Yearly variant ID**, **6-month checkout link**, **6-month variant ID**.

## Step 4: Firebase (your security "firewall" and the server key)

### 4a. Publish the new security rules

These rules are what stop people from using the app without a trial or a plan, and from seeing anyone else's data. Until they're published, someone technical could get around the paywall.

1. Go to **https://console.firebase.google.com** → open your project (**dezire-ce767**).
2. Left menu: **Build → Firestore Database** → **Rules** tab (at the top).
3. Open the file `firestore.rules` from this project in VS Code, select everything (**Ctrl+A**) and copy (**Ctrl+C**).
4. In the Firebase Rules editor, select everything and **delete** it, then paste (**Ctrl+V**).
5. Click **Publish**. You should see "Rules published" with today's date.

### 4b. Download the service account key (lets your server unlock paid accounts)

1. Click the **gear icon ⚙** next to "Project Overview" (top left) → **Project settings**.
2. Open the **Service accounts** tab.
3. Under "Firebase Admin SDK", click **Generate new private key** → **Generate key**. A `.json` file downloads.
4. **Keep this file secret.** Don't put it in your project folder, don't send it to anyone, and never upload it to GitHub. Anyone with it has full control of your database.

### 4c. Check your website's domain is allowed to sign in

1. Left menu: **Build → Authentication** → **Settings** tab → **Authorized domains**.
2. Make sure your live address is listed (e.g. `dizayr.vercel.app` or your custom domain). If not: **Add domain**, type it, **Add**.

## Step 5: Make your webhook secret

This is a password only Lemon Squeezy and your server know. It proves payment messages really come from Lemon Squeezy.

Open **PowerShell** and run:

```powershell
-join ((48..57)+(65..90)+(97..122) | Get-Random -Count 32 | ForEach-Object {[char]$_})
```

It prints 32 random letters and numbers. Copy them into your note as **Webhook secret**.

## Step 6: Add the settings to Vercel

1. Go to **https://vercel.com** → open your project → **Settings** → **Environment Variables**.
2. Add each of these. For every one, tick **Production** and **Preview**, then click **Save**.

| Key (copy exactly) | Value |
|---|---|
| `VITE_LS_CHECKOUT_ANNUAL` | Yearly checkout link |
| `VITE_LS_CHECKOUT_SEMIANNUAL` | 6-month checkout link |
| `VITE_LS_STORE_URL` | Store address (no `/` at the end) |
| `LS_VARIANT_ANNUAL` | Yearly variant ID |
| `LS_VARIANT_SEMIANNUAL` | 6-month variant ID |
| `LEMONSQUEEZY_WEBHOOK_SECRET` | Webhook secret |
| `FIREBASE_SERVICE_ACCOUNT` | the whole service account file (see below) |

For **FIREBASE_SERVICE_ACCOUNT**: right-click the downloaded `.json` file → **Open with → Notepad** → **Ctrl+A**, **Ctrl+C** → paste into the Value box. It starts with `{"type": "service_account"` and ends with `}`. Paste it exactly as it is, line breaks included.

3. Also add the first three (`VITE_LS_…`) to your local **`.env.local`** file in the project, so checkout works when you run it on your computer:
   ```
   VITE_LS_CHECKOUT_ANNUAL=https://dizayr.lemonsqueezy.com/checkout/buy/...
   VITE_LS_CHECKOUT_SEMIANNUAL=https://dizayr.lemonsqueezy.com/checkout/buy/...
   VITE_LS_STORE_URL=https://dizayr.lemonsqueezy.com
   ```
   Never put the other four in `.env.local`; they're server-only secrets.

4. **Deploy the new code:** commit and push your changes to GitHub (Vercel redeploys automatically). If the code was already pushed before you added the variables, go to **Deployments** → **⋯** on the latest one → **Redeploy**, because settings only take effect on a new deployment.

## Step 7: Connect Lemon Squeezy to your site (webhook)

1. In Lemon Squeezy (still in **Test mode**): **Settings → Webhooks** → click **+**.
2. **Callback URL:** `https://YOUR-SITE/api/lemonsqueezy`, using your real live address, e.g. `https://dizayr.vercel.app/api/lemonsqueezy`. No `/` at the end.
3. **Signing secret:** paste your **Webhook secret**. It must be exactly the same as in Vercel.
4. **Events:** tick all of these:
   - `subscription_created`
   - `subscription_updated`
   - `subscription_cancelled`
   - `subscription_resumed`
   - `subscription_expired`
   - `subscription_paused`
   - `subscription_unpaused`
   - `subscription_payment_success`
   - `subscription_payment_failed`
   - `subscription_payment_recovered`
   - `subscription_payment_refunded`
5. Click **Save webhook**.

## Step 8: Give yourself free access forever

Otherwise your own 7-day trial runs out too.

1. Open your live site and **sign in** with your Google account once (this creates your record).
2. Firebase console → **Build → Authentication** → **Users** tab → find your email → copy the **User UID** (long code).
3. **Build → Firestore Database** → **Data** tab → click the **subscriptions** collection → click the document whose name is your UID.
4. Click **+ Add field**:
   - Field: `lifetime`
   - Type: **boolean**
   - Value: **true**
5. **Add**. Reload the site; the trial bar disappears and the account menu → **Plan & billing** says "lifetime access".

## Step 9: Test everything (in test mode, nothing is charged)

Use a **different** Google account (a friend's or a spare one), in a private/incognito window.

1. Open your site → the About page shows. Click **Start your 7-day free trial** → sign in with the spare account.
2. You should see the app with the **"Free trial · 7 of 7 days left"** bar at the top.
3. Click **Choose a plan** → **Get Yearly**. The Lemon Squeezy checkout opens on top of the page with the email filled in.
4. Pay with the test card: **4242 4242 4242 4242**, any future date (e.g. `12/30`), any CVC (e.g. `123`), any name and address.
5. You should see **"Payment received! Activating your plan…"**, then **"You're all set"** within a few seconds. The trial bar disappears.
6. Check it worked:
   - Firestore → **subscriptions** → that account's UID: it now has `status: active`, `plan: annual`, and an `accessUntil` about a year away.
   - Lemon Squeezy → **Settings → Webhooks** → click your webhook: the recent deliveries show **200**.
7. **Test the lock:** in Firestore, on that test account's document, delete the `accessUntil` field and change `trialStartedAt` to a date 8+ days ago. Reload the site with that account: you should see **"Your free trial has ended"** with the plans.
8. **Test cancelling:** open `https://dizayr.lemonsqueezy.com/billing` (your store address + `/billing`), sign in with the test email via the magic link, and cancel. The account keeps access until the paid period ends.

Test-mode receipt emails are sent to you, not to the customer.

## Step 10: Go live (real money)

1. In Lemon Squeezy, **activate your store**: follow the dashboard prompt (identity verification and your payout bank/PayPal details). Wait for approval.
2. Switch **Test mode off**.
3. Your two products don't move to live automatically. In test mode, on each product use **Copy to Live Mode** (or create them again in live mode the same way as Step 2).
4. In live mode, **repeat Step 3**. The live checkout links and variant IDs are **different** from the test ones.
5. In Vercel, **update** `VITE_LS_CHECKOUT_ANNUAL`, `VITE_LS_CHECKOUT_SEMIANNUAL`, `LS_VARIANT_ANNUAL` and `LS_VARIANT_SEMIANNUAL` with the live values → **Redeploy**.
6. In live mode, **repeat Step 7** (create the webhook again, same URL and same secret). Test and live keep separate webhooks.
7. Optional: buy one plan yourself with a real card to confirm, then refund it from **Orders** in Lemon Squeezy.

## Troubleshooting

| What you see | Cause | Fix |
|---|---|---|
| "Payments aren't set up yet" when clicking a plan | Checkout links missing | Check `VITE_LS_CHECKOUT_…` in Vercel (Step 6), then **Redeploy** |
| Paid, but the account stays locked | The webhook isn't reaching your site | Lemon Squeezy → Settings → Webhooks → your webhook → recent deliveries. **401**: the secret doesn't match Vercel's. **500**: `FIREBASE_SERVICE_ACCOUNT` is wrong or incomplete. **404**: wrong Callback URL. After fixing, click **Resend** on the failed delivery. |
| Webhook error details | | Vercel → your project → **Logs**, filter by `/api/lemonsqueezy` |
| Someone can use the app after their trial | Rules not published | Step 4a |
| "Could not load your data" for a new user | Rules published, but that user's trial record wasn't created | Ask them to reload; check they appear under `subscriptions` in Firestore |
| You got locked out of your own account | `lifetime` missing | Step 8 |
| Google sign-in popup closes with an error on the live site | Domain not authorized | Step 4c |
