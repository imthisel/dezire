# Dizayr payments: what you sell, and how to set it up

**Your live address is `https://dizayr.com`.** Use it everywhere below. Don't use `www.dizayr.com` or an old `.vercel.app` address.

- **Part 1** is what the app sells today.
- **Part 2** is the setup, in order. It takes about an hour, plus 2–3 business days for Lemon Squeezy to approve your store.
- **Part 3** is what to change later if you change a price or a limit.
- **Part 4** is troubleshooting.

**Where you are now:** the Lemon Squeezy account and store name are done. Everything else is still to do, so start at Step 1.

---

# Part 1: What you sell

## Prices

These are the prices set in the app (`src/lib/plans.ts`). Lemon Squeezy must charge exactly the same. Your Lemon Squeezy store charges in **Philippine pesos**, and **both prices include tax**, so customers pay exactly ₱950 or ₱1,260 at checkout.

| | Free trial | 6 months | Yearly |
|---|---|---|---|
| **Price** | Free | **₱950 every 6 months** | **₱1,260 per year** |
| **Works out to** | | about ₱158 a month | ₱105 a month |
| **Over a full year** | | ₱1,900 | ₱1,260 |
| **Length** | 7 days, once per Google account | Renews every 6 months | Renews every year |
| **Card needed** | No | Yes (card or PayPal) | Yes (card or PayPal) |
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
| Renewal payment is being retried | They keep access until the renewal date plus 3 days. |
| Cancels | They keep access until the end of the time they paid for, then the app locks. |
| Subscription is paused, unpaid or expired | The app locks right away. Nothing is deleted. |
| Has more modes than the plan allows | The extra modes are locked and kept safe. They reopen with a bigger plan. |
| 6-month customer wants Yearly | They use **Manage billing** in the app. The buy buttons are disabled while on a plan. |
| Refund | **A refund alone does not lock the account.** Cancel the subscription too (Step 9). |

**Free access you can give from `/admin`:** lifetime access, free time for any number of days, or a new 7-day trial. Lifetime and free time have unlimited modes.

## What you actually receive

Lemon Squeezy is the merchant of record, so it handles sales tax and VAT for you. Its published fee is 5% + 50¢, plus 1.5% for sales outside the US, 1.5% for PayPal and 0.5% for subscriptions.

The docs don't say outright that these add together, and the 50¢ is converted at about ₱63 to $1, so treat these as estimates. They're **before tax**:

| Sale | After fees on ₱1,260 Yearly | After fees on ₱950 for 6 months |
|---|---|---|
| US customer, card | about ₱1,159 | about ₱866 |
| Non-US customer, card (includes the Philippines) | about ₱1,140 | about ₱852 |
| Non-US customer, PayPal | about ₱1,121 | about ₱838 |

**Your prices include tax, so any tax comes out of these amounts.** How much depends on where the customer lives. For example, with 20% VAT, a ₱1,260 sale includes ₱210 of tax, leaving you about ₱930. A ₱950 sale includes about ₱158, leaving you about ₱694. Where no tax applies, you keep the full amount in the table.

**Payouts:** Lemon Squeezy pays out to a Philippine bank account or PayPal. Its payouts are in US dollars and converted to your currency for a peso account.

| | Philippine bank | PayPal |
|---|---|---|
| Fee per payout | 1% | 3%, capped at $30 |

The bank is cheaper. Sales are held for 13 days, the minimum payout is $50 (about ₱3,150), and money arrives 1–5 days after a payout is made.

---

# Part 2: Setup

Keep Notepad open. You'll collect these values:

| Value | From |
|---|---|
| Store address | Step 2 |
| Yearly checkout link | Step 4 |
| 6-month checkout link | Step 4 |
| Yearly variant ID | Step 4 |
| 6-month variant ID | Step 4 |
| Webhook secret | Step 6 |
| Firebase service account file | Step 5 |

## Step 1: Make Google sign-in work on dizayr.com

The site already loads on `dizayr.com`, and `www.dizayr.com` already redirects to it. Don't change that in Vercel, because payment messages must reach `dizayr.com` directly. These sign-in settings can't be checked from outside, so go through both.

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

**Leave `vercel.json` alone.** The `dezire-ce767.firebaseapp.com` entries in it are correct.

**If people used an older address:** their accounts and synced data carry over, but they need to sign in again on `dizayr.com`. Anyone who installed the app from the old address should reinstall it from the new one.

## Step 2: Set up your Lemon Squeezy store

Your account and store name are already done.

1. Find your store's address in the Lemon Squeezy dashboard. It should look like `https://dizayr.lemonsqueezy.com`. Write it down as **Store address**. If yours is different, use it everywhere this guide says `dizayr.lemonsqueezy.com`.
2. Make sure **Test mode** is **on** in the dashboard. Nothing real is charged while it's on.
3. Go to **https://app.lemonsqueezy.com/settings/general** and find the tax-inclusive pricing setting. **Turn it on** and save. This is required, because your ₱950 and ₱1,260 prices include tax. If it's off, some customers will see tax added at checkout.

## Step 3: Create one product with two variants

Use **one product with two variants**, not two products. Lemon Squeezy doesn't let PayPal customers switch to a different product, only a different variant. With one product, every 6-month customer can move up to Yearly.

1. Go to **Products** and click **+ New Product**.
2. **Name:** `Dizayr`
3. **Description:** `Plan the life you want, month by month. Every feature, on every device.`
4. Set the pricing to **Subscription**.
5. Click **Add variant** and enter:
   - **Name:** `Yearly` (spell it exactly like this)
   - **Description:** `Unlimited Wants and Needs modes. Billed once a year.`
   - **Price:** `1260` (PHP)
   - **Repeat payment every:** `1` `year`
   - **Free trial:** off. The website already gives the 7 free days without a card.
6. Click **Save and add another** and enter:
   - **Name:** `6 Months` (spell it exactly like this)
   - **Description:** `2 Wants modes and 2 Needs modes. Billed every 6 months.`
   - **Price:** `950` (PHP)
   - **Repeat payment every:** `6` `month`
   - **Free trial:** off
7. Click **Save and go back**.
8. **Tax category:** choose **SaaS / Software as a service**, or the closest software or digital service option.
9. **Files:** leave empty, since there's nothing to download. If it won't publish without a file, upload a small "Welcome to Dizayr" PDF.
10. In the **Confirmation modal** section, set:
    - **Button text:** `Open Dizayr`
    - **Button link:** `https://dizayr.com`
11. Click **Publish product**.

**Set up the billing page so customers can change plans:**
1. Go to **https://app.lemonsqueezy.com/design/customer-portal**.
2. Turn on the option that lets customers change their plan and cancel. If it asks which plans are allowed, tick both `Yearly` and `6 Months`.
3. Save.

## Step 4: Copy the checkout links and variant IDs

**Checkout links (one per variant):**
1. Go to **Products** and click **Share** on `Dizayr`.
2. Pick the **Yearly** variant and copy the link. It looks like `https://dizayr.lemonsqueezy.com/checkout/buy/…`. This is your **Yearly checkout link**.
3. Pick the **6 Months** variant and copy the link. This is your **6-month checkout link**.
4. Copy them from the Share window only. An opened checkout turns into a single-use `?cart=` link in the address bar, and that won't work for others.
5. **Check:** paste each link into a private window. The Yearly link must show **₱1,260** per year and the other must show **₱950** every 6 months. Close the window without paying.

**Variant IDs (a number like `612345`):**
1. In **Products**, click the **⋯** next to the product, or open it and find **Variants**.
2. Click **⋯** next to each variant and choose **Copy ID** / **Copy Variant ID**.
3. Save them as **Yearly variant ID** and **6-month variant ID**.

If you can't find them, leave those two values for now. Step 9 shows another way to get them.

## Step 5: Firebase rules and server key

**5a. Publish the security rules.** These enforce the trial and paywall on the server, and they include the free time you give from `/admin`.
1. In the Firebase console, go to **Build → Firestore Database → Rules**. **Don't use "Realtime Database"**: it's a different product, and these rules give `Line 1: Parse error` there.
2. In VS Code, open `firestore.rules`, press **Ctrl+A**, then **Ctrl+C**.
3. In the Firebase editor, press **Ctrl+A**, then **Ctrl+V**.
4. Click **Publish**.

**5b. Download the service account key.** Skip this if `FIREBASE_SERVICE_ACCOUNT` is already in Vercel.
1. Click the **gear icon ⚙ → Project settings → Service accounts**.
2. Click **Generate new private key → Generate key**. A `.json` file downloads.
3. **Keep it secret.** Don't put it in the project folder or on GitHub, and don't send it to anyone. It gives full control of your database.

## Step 6: Make your webhook secret

This is a password shared by Lemon Squeezy and your server. It proves payment messages are real. In **PowerShell**, run:

```powershell
-join ((48..57)+(65..90)+(97..122) | Get-Random -Count 32 | ForEach-Object {[char]$_})
```

Save the 32 characters as **Webhook secret**.

## Step 7: Add the settings to Vercel

1. Go to **https://vercel.com**, open your project, then **Settings → Environment Variables**.
2. Add each of these with **Production** and **Preview** ticked:

| Key (copy exactly) | Type | Value |
|---|---|---|
| `VITE_LS_CHECKOUT_ANNUAL` | **Config** | Yearly checkout link |
| `VITE_LS_CHECKOUT_SEMIANNUAL` | **Config** | 6-month checkout link |
| `VITE_LS_STORE_URL` | **Config** | Store address, with no `/` at the end |
| `LS_VARIANT_ANNUAL` | Secret | Yearly variant ID |
| `LS_VARIANT_SEMIANNUAL` | Secret | 6-month variant ID |
| `LEMONSQUEEZY_WEBHOOK_SECRET` | Secret | Webhook secret |
| `FIREBASE_SERVICE_ACCOUNT` | Secret | The whole service account file |
| `ADMIN_PASSWORD` | Secret | A password of 8+ characters for `https://dizayr.com/admin` |

   Vercel warns about the `VITE_` prefix on the first three. That's expected: these links are meant to be public, because customers open them to pay. Click **Change to Config**. Don't rename them, or checkout stops working.

   For `FIREBASE_SERVICE_ACCOUNT`: open the `.json` file in Notepad, press **Ctrl+A**, **Ctrl+C**, and paste it into the Value box. It starts with `{` and ends with `}`.

3. **Redeploy:** go to **Deployments**, click **⋯** on the latest one, then **Redeploy**. Settings only apply to a new deployment. Do this every time you change one.

**To try checkout on your own computer (optional):** add only these three lines to `.env.local`. The others are server secrets and must stay out of it.

```
VITE_LS_CHECKOUT_ANNUAL=your yearly checkout link
VITE_LS_CHECKOUT_SEMIANNUAL=your 6-month checkout link
VITE_LS_STORE_URL=https://dizayr.lemonsqueezy.com
```

## Step 8: Connect the webhook, and give yourself free access

**Webhook** (with Test mode still on):
1. Go to **https://app.lemonsqueezy.com/settings/webhooks** and click **+**.
2. **Callback URL:** `https://dizayr.com/api/lemonsqueezy`, with no `www` and no `/` at the end.
3. **Signing secret:** paste your **Webhook secret**. It must match Vercel exactly.
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

**Your own account** (otherwise your trial runs out too):
1. Sign in at `https://dizayr.com` with your own Google account.
2. Open `https://dizayr.com/admin`, sign in with `ADMIN_PASSWORD`, open your user, and give **lifetime access**.
3. If `/admin` won't open, do it by hand. Copy your **User UID** from Firebase **Authentication → Users**. Then in **Firestore Database → Data → subscriptions →** your UID, click **+ Add field**: Field `lifetime`, Type **boolean**, Value **true**.
4. Reload the site. The trial bar should be gone.

## Step 9: Test everything (nothing is charged in Test mode)

Use a **spare Google account** in a private window. Do these in order, because one account goes through the whole journey.

**Trial**
1. Open `https://dizayr.com` and click **Start your 7-day free trial**. Sign in with the spare account.
2. The top bar should say **"Free trial · 7 of 7 days left"**.
3. **Settings → Your plan → Modes** should say **1 + 1**.
4. Try to add a second Wants mode. The app should offer plans instead of creating it.

**6-month plan**

5. Click **Choose a plan → Buy 6 months now**. Checkout should open with the email filled in and show **₱950**.
6. Pay with test card **4242 4242 4242 4242**, any future date such as `12/30`, any CVC such as `123`, and any name and address.
7. You should see **"Payment received! Activating your plan…"**, then **"You're all set"** within a few seconds. The trial bar disappears.
8. In Firestore, open **subscriptions →** that account's UID. It should show `status: active`, `plan: semiannual`, and an `accessUntil` about 6 months away.
   - **It must say `semiannual`.** If the variant IDs are wrong, this can come out wrong or empty, and a 6-month customer would get unlimited modes.
   - **Still missing a variant ID from Step 4?** The `variantId` field here is the 6-month one. Add it to Vercel as `LS_VARIANT_SEMIANNUAL` and redeploy.
9. **Settings → Your plan → Modes** should say **2 + 2**. The header button should say **Go Yearly**.
10. In Lemon Squeezy, go to **Settings → Webhooks** and open your webhook. The recent deliveries should show **200**.

**Moving up to Yearly**

11. In the app, click **Go Yearly**, then **Manage billing: card, plan or cancel**. Sign in with the magic link. Test-mode emails go to you and your team, not the customer, so look in your own inbox.
12. Switch the plan to **Yearly**. If the page doesn't offer it, go back to Step 3 and fix the billing page settings. In the meantime, you can do it yourself from **Store » Subscriptions → Modify subscription**.
13. Firestore should now show `plan: annual`, and the mode count should say **unlimited**. If the `variantId` changed and you still needed the Yearly ID, this is it. Add it as `LS_VARIANT_ANNUAL` and redeploy.

**Cancelling**

14. On the billing page, cancel the subscription.
15. Firestore should show `status: cancelled`. The app should still open, and the plan window should say **"Your plan is cancelled and ends on…"**.

**Locking**

16. In Firestore, on the test account's document, delete `accessUntil` and set `trialStartedAt` to a date 8+ days ago.
17. Reload the site. You should see **"Your free trial has ended"** with the plans.

**Don't go live until all 17 pass.**

## Step 10: Go live (real money)

1. Click **Activate your store** in the Lemon Squeezy sidebar. Fill in the short questionnaire and verify your identity. Use `https://dizayr.com` as your website. Review usually takes 2–3 business days.
2. Go to **https://app.lemonsqueezy.com/settings/payouts** and add your Philippine bank account. It's cheaper than PayPal.
3. Once approved, on the `Dizayr` product menu choose **Copy to Live Mode**, then turn **Test mode off**.
4. In live mode, open the product and check both prices, both repeat periods and the Confirmation modal link. Also recheck the tax setting and the billing page settings from Step 2 and Step 3.
5. **Repeat Step 4.** Live checkout links and variant IDs are **different** from the test ones.
6. In Vercel, replace these four with the live values, then **Redeploy**:
   - `VITE_LS_CHECKOUT_ANNUAL`
   - `VITE_LS_CHECKOUT_SEMIANNUAL`
   - `LS_VARIANT_ANNUAL`
   - `LS_VARIANT_SEMIANNUAL`
7. With Test mode off, open **Settings → Webhooks**. If your webhook isn't listed, **repeat Step 8's webhook part** with the same URL and secret.
8. **Real purchase test:** with a spare account, buy the 6-month plan with your real card.
   - Check Firestore shows `plan: semiannual` and `testMode: false`, and that the webhook shows **200**.
   - In Lemon Squeezy, refund it from **Orders**.
   - Then cancel it in **Store » Subscriptions**, because a refund alone doesn't lock the account.

---

# Part 3: If you change something later

**Change a price**
1. Lemon Squeezy: change the variant's price, in live mode.
2. `src/lib/plans.ts`: change `price`.
3. `src/admin/data.ts`: change `PLAN_PRICE`, which the admin revenue figure uses.
4. Push to GitHub.

**Change how many modes a plan includes**
1. `src/billing.ts`: change the numbers in `modeLimit`.
2. `src/lib/plans.ts`: change `perks`.
3. `src/components/About.tsx`: change the "What are modes?" and free trial answers in the FAQ.
4. Lemon Squeezy: change the variant descriptions.
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
| "Payments aren't set up yet" | Checkout links missing | Check `VITE_LS_CHECKOUT_…` in Vercel (Step 7), then **Redeploy** |
| Paid, but the account stays locked | The webhook isn't getting through | See the webhook codes below |
| 6-month customer has unlimited modes | `plan` is wrong or empty in Firestore | Fix `LS_VARIANT_SEMIANNUAL` with the **live** ID and redeploy. Then resend that customer's latest `subscription_updated` delivery. |
| Checkout shows the wrong price | Links swapped in Vercel, or wrong price on the variant | Redo the check in Step 4 |
| Refunded customer still has access | A refund alone doesn't lock | Cancel in **Store » Subscriptions** |
| Customer can't switch to Yearly | Billing page setting is off | Step 3, or use **Store » Subscriptions → Modify subscription** |
| Someone uses the app after their trial | Rules not published | Step 5a |
| "Could not load your data" for a new user | Their trial record wasn't created | Ask them to reload, then check they appear under `subscriptions` |
| You're locked out of your own account | `lifetime` missing | Step 8 |

**Webhook codes** (Lemon Squeezy → Settings → Webhooks → your webhook → recent deliveries):

| Code | Meaning | Fix |
|---|---|---|
| **401** | The secret doesn't match Vercel | Make them identical, then redeploy |
| **404** | Wrong Callback URL | It must be exactly `https://dizayr.com/api/lemonsqueezy` |
| **307 or 308** | The URL is redirecting | Remove `www` and any `/` at the end |
| **500** | `FIREBASE_SERVICE_ACCOUNT` is wrong or incomplete | Paste the whole file again, then redeploy |

Lemon Squeezy only retries a failed message three more times, within a few minutes. After you fix the problem, **resend the failed delivery** from the same page or the customer stays locked. For error details, go to Vercel → your project → **Logs** and filter by `/api/lemonsqueezy`.

**Quick check:** open `https://dizayr.com/api/lemonsqueezy` in a browser. A "405" or blank page is correct, because that address only accepts messages from Lemon Squeezy. A 404 means the code isn't deployed.
