import { useEffect, type ReactNode } from 'react'
import { ArrowLeft } from 'lucide-react'
import { LEGAL, type LegalPage } from '../lib/legal'
import { PLANS, TRIAL_DAYS, dollars } from '../lib/plans'
import { BrandLogo } from './BrandLogo'
import { ContactButton } from './EmailContact'

/**
 * Terms of Service, Privacy Policy and Refund Policy (/terms, /privacy, /refunds). Open to everyone, signed in or not.
 * Paddle reviews these before approving payments: they must name Paddle as the merchant of record, offer refunds,
 * and say who runs Dizayr and how to reach them. Names and dates come from src/lib/legal.ts.
 */
export function Legal({ page }: { page: LegalPage }) {
  const { title, body } = PAGES[page]
  useEffect(() => {
    const before = document.title
    document.title = `${title} · Dizayr`
    window.scrollTo(0, 0)
    return () => {
      document.title = before
    }
  }, [title])

  return (
    <div className="about relative min-h-screen overflow-x-clip bg-[#07080c] text-zinc-100 antialiased">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[600px] bg-[radial-gradient(60%_50%_at_50%_0%,rgb(58_109_240/0.12),transparent_70%)]" />
      <header className="relative border-b border-white/[0.06]">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between gap-4 px-5 sm:px-8">
          <a href="/about" className="flex items-center gap-2.5" aria-label="Dizayr home">
            <BrandLogo className="h-8 w-8" />
            <span className="font-semibold text-white">Dizayr</span>
          </a>
          <a href="/about" className="inline-flex items-center gap-1.5 text-sm text-zinc-400 transition hover:text-white">
            <ArrowLeft className="h-4 w-4" /> Back to Dizayr
          </a>
        </div>
      </header>

      <main className="relative mx-auto max-w-3xl px-5 pb-20 pt-12 sm:px-8 sm:pt-16">
        <nav aria-label="Policies" className="mb-10 flex flex-wrap gap-2 text-sm">
          {(Object.keys(PAGES) as LegalPage[]).map((p) => (
            <a
              key={p}
              href={`/${p}`}
              aria-current={p === page ? 'page' : undefined}
              className={`rounded-full border px-3.5 py-1.5 transition ${
                p === page ? 'border-brand-300/40 bg-brand-500/10 text-white' : 'border-white/10 text-zinc-400 hover:border-white/20 hover:text-white'
              }`}
            >
              {PAGES[p].title}
            </a>
          ))}
        </nav>
        <h1 className="font-display text-4xl font-semibold tracking-[-0.03em] text-white sm:text-5xl">{title}</h1>
        <p className="mt-3 text-sm text-zinc-500">Last updated {LEGAL.updated}</p>
        <article className="mt-10 space-y-5 leading-relaxed text-zinc-300 [&_a]:text-brand-200 [&_a]:underline [&_a]:decoration-brand-300/40 [&_a]:underline-offset-4 hover:[&_a]:text-brand-100 [&_b]:font-semibold [&_b]:text-white [&_h2]:pt-6 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-white [&_li]:pl-1 [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5">
          {body}
        </article>
      </main>

      <LegalFooter />
    </div>
  )
}

/** The footer links: the three policies and the support email. Also used on the About page. */
export function LegalLinks({ className = '' }: { className?: string }) {
  return (
    <>
      <a href="/terms" className={className}>Terms</a>
      <a href="/privacy" className={className}>Privacy</a>
      <a href="/refunds" className={className}>Refunds</a>
      <ContactButton className={className}>Contact</ContactButton>
    </>
  )
}

function LegalFooter() {
  return (
    <footer className="relative border-t border-white/[0.06] px-5 py-8 text-sm text-zinc-400 sm:px-8">
      <div className="mx-auto flex max-w-3xl flex-col items-center justify-between gap-4 sm:flex-row">
        <span>
          © {new Date().getFullYear()} {LEGAL.operator}
        </span>
        <nav aria-label="Footer" className="flex flex-wrap justify-center gap-x-5 gap-y-2">
          <LegalLinks className="transition hover:text-white" />
        </nav>
      </div>
    </footer>
  )
}

/** The support address in the policy text: opens the contact panel (copy it, or write in Gmail / Outlook / the email app). */
const Mail = () => <ContactButton className="underline underline-offset-2">{LEGAL.email}</ContactButton>
const PADDLE_BUYER_TERMS = 'https://www.paddle.com/legal/checkout-buyer-terms'
const PADDLE_PRIVACY = 'https://www.paddle.com/legal/privacy'
const PADDLE_ORDERS = 'https://paddle.net'

const yearly = PLANS.annual
const lifetime = PLANS.lifetime
const prices = `${dollars(yearly.price)} per year (Yearly), or ${dollars(lifetime.price)} once (Lifetime)`

const MerchantOfRecord = () => (
  <p>
    Our order process is conducted by our online reseller <b>Paddle.com</b>. Paddle.com is the <b>Merchant of Record</b> for all our orders. Paddle
    provides all customer service inquiries about payments and handles returns. When you buy a plan, you buy it from Paddle, and{' '}
    <a href={PADDLE_BUYER_TERMS} target="_blank" rel="noreferrer">Paddle’s Buyer Terms</a> also apply to your purchase.
  </p>
)

const PAGES: Record<LegalPage, { title: string; body: ReactNode }> = {
  terms: {
    title: 'Terms of Service',
    body: (
      <>
        <p>
          These terms apply when you use Dizayr at <b>dizayr.com</b> (the website, the web app and the installable app). Dizayr is run by{' '}
          <b>{LEGAL.operator}</b>, based in {LEGAL.country} (“we”, “us”). By signing in or buying a plan, you agree to these terms. If you
          don’t agree, please don’t use Dizayr.
        </p>

        <h2>1. What Dizayr is</h2>
        <p>
          Dizayr is a personal planning app. You can plan monthly budgets and the things you want to buy, track expenses and net worth, set
          yearly goals, and keep a calendar and tasks. Your plan syncs across your devices and works offline.
        </p>
        <p>
          <b>Dizayr is a planning tool, not financial advice.</b> We don’t manage, hold or move your money, and nothing in the app is a
          recommendation to spend, save, borrow or invest. Decisions about your money are yours.
        </p>

        <h2>2. Your account</h2>
        <ul>
          <li>You sign in with a Google account. Keep it secure: anyone who can sign in to it can open your plan.</li>
          <li>You must be at least 13 years old to use Dizayr. If you’re under 18, a parent or guardian must agree to these terms and make any purchase.</li>
          <li>One person per account. Don’t share your account or use someone else’s.</li>
        </ul>

        <h2>3. Free trial</h2>
        <p>
          Every new account gets a {TRIAL_DAYS}-day free trial with every feature, and one Wants mode and one Needs mode. No payment card is
          needed and nothing is charged. The trial is given once per Google account. When it ends, Dizayr locks until you buy a plan.
          Nothing you entered is deleted.
        </p>

        <h2>4. Plans and payment</h2>
        <ul>
          <li>
            Dizayr is sold as two plans: <b>{prices}</b>, in US dollars. Prices include any sales tax or VAT, so you pay the amount shown at
            checkout. Your bank may charge a currency conversion fee if your card isn’t in US dollars.
          </li>
          <li>Both plans include every feature, with unlimited Wants and Needs modes.</li>
          <li>
            <b>Yearly renews automatically</b> at the end of each year, at the same price, until you cancel. You can see your renewal date in the app
            under Settings → Plan &amp; billing.
          </li>
          <li>
            <b>Lifetime is a single payment.</b> It never renews and is never charged again. It gives you access to Dizayr for as long as we offer
            it, including the features we add later. It belongs to your account and can’t be transferred.
          </li>
          <li>
            If you’re on Yearly, you can buy Lifetime at any time. Your Yearly plan then stops renewing; the time you already paid for isn’t refunded,
            except as described in our <a href="/refunds">Refund Policy</a>.
          </li>
          <li>
            If we change the Yearly price, we’ll tell you by email at least 30 days before it applies to your next renewal. You can cancel before then.
          </li>
        </ul>
        <MerchantOfRecord />

        <h2>5. Cancelling</h2>
        <p>
          You can cancel Yearly any time from <b>Settings → Plan &amp; billing → Manage billing</b>, or by emailing <Mail />. When you cancel, your plan doesn’t
          renew, and you keep access until the end of the time you’ve already paid for. After that, Dizayr locks and your plan stays saved.
          Lifetime has nothing to cancel, because it never renews.
        </p>

        <h2>6. Refunds</h2>
        <p>
          We give a full refund for any payment within {LEGAL.refundDays} days, no questions asked. The details are in our{' '}
          <a href="/refunds">Refund Policy</a>.
        </p>

        <h2>7. Your content</h2>
        <p>
          Everything you write in Dizayr is yours. You give us permission only to store it, sync it between your devices and show it back to
          you, which is what’s needed to run the app. We don’t sell it, share it with advertisers or use it for anything else. See our{' '}
          <a href="/privacy">Privacy Policy</a>. You can download a backup or spreadsheets of your data at any time from Settings → Data &amp; backup.
        </p>

        <h2>8. Using Dizayr fairly</h2>
        <p>Please don’t:</p>
        <ul>
          <li>break the law with Dizayr, or use it to harm anyone;</li>
          <li>try to get around the trial, plan limits or payments, or get into anyone else’s account or data;</li>
          <li>attack, overload, copy or resell the service, or use bots to access it.</li>
        </ul>
        <p>If you do, we may suspend or close your account. Where we can, we’ll warn you first and let you download your data.</p>

        <h2>9. Availability and changes</h2>
        <p>
          We work to keep Dizayr running and your data safe, but we can’t promise it will always be available or free of errors. We improve the
          app over time, which can mean changing or removing features. If we ever shut Dizayr down, we’ll tell you at least 30 days before, give you
          time to download your data, and refund the unused part of any Yearly plan you’ve paid for.
        </p>

        <h2>10. Liability</h2>
        <p>
          Dizayr is provided “as is”. As far as the law allows, we aren’t liable for indirect or consequential losses, or for decisions you make
          based on your plan. Our total liability to you is limited to the amount you paid us in the 12 months before the claim. Nothing in these
          terms limits rights you have under consumer law that can’t be limited.
        </p>

        <h2>11. Ending your account</h2>
        <p>
          You can stop using Dizayr at any time and ask us to delete your account and data by emailing <Mail />. Cancel any subscription first so
          it doesn’t renew.
        </p>

        <h2>12. Changes to these terms</h2>
        <p>
          We may update these terms. The date at the top shows when they last changed. If a change matters, we’ll tell you in the app or by email
          before it applies. Continuing to use Dizayr after that means you accept the new terms.
        </p>

        <h2>13. Law and contact</h2>
        <p>
          These terms are governed by the laws of {LEGAL.country}, without taking away any protection your own country’s consumer law gives you.
          Questions? Email <Mail />.
        </p>
      </>
    ),
  },

  privacy: {
    title: 'Privacy Policy',
    body: (
      <>
        <p>
          This policy explains what information Dizayr collects, why, and what you can do about it. Dizayr is run by <b>{LEGAL.operator}</b>, based
          in {LEGAL.country}, who is responsible for your information. The short version: <b>we collect only what’s needed to run the app, we never
          sell it, and there are no ads or trackers.</b>
        </p>

        <h2>What we collect</h2>
        <ul>
          <li>
            <b>Your Google account details</b> when you sign in: your name, email address, profile picture and a Google account ID. We never see
            your Google password.
          </li>
          <li>
            <b>What you put in Dizayr</b>: your plans, budgets, items, goals, net worth, expenses, calendar, tasks, notes and settings.
          </li>
          <li>
            <b>Your plan and billing status</b>: your trial dates, which plan you’re on, its status and renewal date, and the customer and
            subscription IDs Paddle gives us. <b>We never see or store your card or bank details.</b> Paddle handles those.
          </li>
          <li>
            <b>Messages you send us</b> through Help &amp; support, including any details you choose to attach.
          </li>
          <li>
            <b>Basic technical data</b>: our hosting provider keeps short-lived server logs (such as IP address, browser and time of request) to
            keep the service working and secure.
          </li>
        </ul>

        <h2>How we use it</h2>
        <ul>
          <li>to sign you in, save your plan and sync it across your devices;</li>
          <li>to run your free trial and subscription, and unlock the plan you paid for;</li>
          <li>to answer your messages and give support;</li>
          <li>to keep Dizayr secure and fix problems.</li>
        </ul>
        <p>
          We don’t sell your information, show ads, or use advertising or analytics trackers. We don’t use your plan for anything other than
          showing it to you.
        </p>

        <h2>Who helps us run Dizayr</h2>
        <p>We use a few trusted services. Each gets only what it needs:</p>
        <ul>
          <li><b>Google Firebase</b>: sign-in and the database that stores and syncs your plan.</li>
          <li><b>Vercel</b>: hosts the website and the small server that talks to Paddle.</li>
          <li>
            <b>Paddle</b>: our reseller and Merchant of Record, which processes payments, handles tax and invoices, and runs the billing portal.
            Paddle collects your payment details directly, under{' '}
            <a href={PADDLE_PRIVACY} target="_blank" rel="noreferrer">its own privacy policy</a>.
          </li>
          <li><b>Google Fonts</b>: loads the fonts the site uses.</li>
          <li><b>ExchangeRate-API</b>: currency exchange rates, if you choose to show a second currency. Only currency codes are sent, nothing about you.</li>
        </ul>
        <p>
          These services may store information on servers outside your country, including in the United States. They are bound to protect it
          and use it only to provide their service.
        </p>

        <h2>On your device</h2>
        <p>
          Dizayr saves a copy of your plan and your settings in your browser’s storage, so it opens quickly and works offline. Google sign-in uses
          the cookies and storage it needs to keep you signed in. We don’t use cookies for advertising or tracking.
        </p>

        <h2>How long we keep it</h2>
        <p>
          We keep your information while your account exists. If your trial or plan ends, your plan stays saved so it’s there if you come back. Ask
          us to delete your account and we’ll delete your plan and account details within 30 days. Paddle keeps records of payments for as long
          as tax and accounting law requires.
        </p>

        <h2>Your rights</h2>
        <p>You can:</p>
        <ul>
          <li><b>see and download</b> your data at any time (Settings → Data &amp; backup: a full backup, or spreadsheets of expenses, items and goals);</li>
          <li><b>correct or delete</b> anything you’ve entered, right in the app;</li>
          <li><b>ask us</b> for a copy of everything we hold about you, or to delete your account and all its data, by emailing <Mail />.</li>
        </ul>
        <p>
          You have these rights under the Philippine Data Privacy Act of 2012, and under the GDPR and similar laws where they apply to you. We
          answer requests within 30 days. If you’re not happy with our answer, you can complain to your local data protection authority (in the
          Philippines, the National Privacy Commission).
        </p>

        <h2>Security</h2>
        <p>
          Your data travels over encrypted connections and is stored with Google’s security. Database rules make sure only you can open your
          own plan. No system is perfectly secure, but if something ever goes wrong, we’ll tell you and the authorities as the law requires.
        </p>

        <h2>Children</h2>
        <p>
          Dizayr isn’t meant for children under 13, and we don’t knowingly collect their information. If you think a child under 13 has an
          account, email us and we’ll delete it.
        </p>

        <h2>Changes</h2>
        <p>
          If we change this policy, we’ll update the date at the top. If a change matters, we’ll tell you in the app or by email first.
        </p>

        <h2>Contact</h2>
        <p>
          Questions about your privacy or your data? Email <Mail />.
        </p>
      </>
    ),
  },

  refunds: {
    title: 'Refund Policy',
    body: (
      <>
        <p>
          We want you to be happy with Dizayr. You can try every feature free for {TRIAL_DAYS} days before you pay, and if a plan isn’t right for
          you after all, you can get your money back.
        </p>

        <h2>{LEGAL.refundDays}-day money-back guarantee</h2>
        <p>
          <b>Ask within {LEGAL.refundDays} days of any payment and you get a full refund</b>, no questions asked. This applies to your first payment,
          to every Yearly renewal, and to a Lifetime purchase ({prices}).
        </p>

        <h2>How to ask for a refund</h2>
        <p>Either:</p>
        <ul>
          <li>
            email <Mail /> from the email address you signed in with, and say which payment you want refunded; or
          </li>
          <li>
            find your order at <a href={PADDLE_ORDERS} target="_blank" rel="noreferrer">paddle.net</a> (using the email on your receipt) and ask
            for a refund there.
          </li>
        </ul>

        <h2>What happens next</h2>
        <ul>
          <li>
            Refunds are paid by <b>Paddle</b>, our reseller and Merchant of Record, to the payment method you used. They usually arrive within
            5–10 business days, depending on your bank.
          </li>
          <li>
            When a payment is refunded, the plan it paid for ends: a refunded Yearly payment cancels the subscription, and a refunded Lifetime
            payment ends lifetime access. <b>Your plan stays saved</b>, and it’s all there if you buy a plan again later.
          </li>
          <li>The refund is for the full amount you paid, including tax.</li>
        </ul>

        <h2>After {LEGAL.refundDays} days</h2>
        <p>
          After {LEGAL.refundDays} days, payments aren’t refunded, including for the unused part of a Yearly period. You can still cancel Yearly at any time,
          which stops the next renewal, and you keep access until the end of the time you paid for. If something went wrong on our side, such as a double charge
          or Dizayr not working for you, email us and we’ll make it right, whenever it happened. This doesn’t affect any refund rights you have
          under the law where you live.
        </p>

        <h2>Who sells Dizayr</h2>
        <MerchantOfRecord />

        <h2>Contact</h2>
        <p>
          Questions about a payment or refund? Email <Mail />.
        </p>
      </>
    ),
  },
}
