import {
  ArrowRight,
  Cctv,
  ClipboardCheck,
  DoorOpen,
  Fingerprint,
  ImageOff,
  LayoutDashboard,
  LogIn,
  Menu,
  Network,
  ScanFace,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  X,
} from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { BrandMark } from '@/components/brand/BrandMark'
import { Logo } from '@/components/brand/Logo'
import { Button, ButtonLink } from '@/components/ui/Button'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useSession } from '@/hooks/useSession'
import { cn } from '@/lib/cn'
import { LoginModal } from '@/features/auth/LoginModal'
import { HeroVisual } from './components/HeroVisual'

const NAV = [
  { href: '#features', label: 'Features' },
  { href: '#how-it-works', label: 'How it works' },
  { href: '#privacy', label: 'Privacy' },
]

/** The public front page: what Bantay is, how it works, and the way in. */
export function LandingPage() {
  useDocumentTitle('')
  const [params, setParams] = useSearchParams()
  const [loginOpen, setLoginOpen] = useState(params.get('login') === '1')
  const [menuOpen, setMenuOpen] = useState(false)
  const user = useSession()

  const openLogin = () => {
    setMenuOpen(false)
    setLoginOpen(true)
  }
  const closeLogin = () => {
    setLoginOpen(false)
    if (params.has('login') || params.has('next')) setParams({}, { replace: true })
  }

  const primaryAction = user ? (
    <ButtonLink to="/dashboard" variant="accent" icon={<LayoutDashboard />}>
      Open dashboard
    </ButtonLink>
  ) : (
    <Button variant="accent" onClick={openLogin} icon={<LogIn />}>
      Log in
    </Button>
  )

  return (
    <div className="min-h-screen bg-cream text-navy-900">
      {/* ------------------------------------------------------------ nav */}
      <header className="sticky top-0 z-30 border-b border-white/5 bg-navy-900/95 backdrop-blur-md">
        <div className="mx-auto flex h-18 max-w-7xl items-center gap-6 px-5 sm:px-8">
          <a href="#top" aria-label="Bantay — back to top">
            <Logo variant="lockup-on-dark" className="h-10 w-auto" />
          </a>
          <nav aria-label="Sections" className="ml-6 hidden items-center gap-1 md:flex">
            {NAV.map((n) => (
              <a key={n.href} href={n.href} className="rounded-lg px-3 py-2 text-sm font-medium text-navy-200 transition-colors hover:bg-white/5 hover:text-cream">
                {n.label}
              </a>
            ))}
          </nav>
          <div className="ml-auto hidden items-center gap-3 md:flex">
            {user && <span className="text-sm text-navy-200">Signed in as {user.displayName}</span>}
            {primaryAction}
          </div>
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className="ml-auto rounded-lg p-2 text-cream hover:bg-white/10 md:hidden"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
          >
            {menuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
        {menuOpen && (
          <div className="animate-fade-in border-t border-white/10 px-5 py-4 md:hidden">
            {NAV.map((n) => (
              <a key={n.href} href={n.href} onClick={() => setMenuOpen(false)} className="block rounded-lg px-3 py-2.5 text-sm font-medium text-navy-100 hover:bg-white/5">
                {n.label}
              </a>
            ))}
            <div className="mt-3 px-3">{primaryAction}</div>
          </div>
        )}
      </header>

      <main id="top">
        {/* ------------------------------------------------------------ hero */}
        <section className="relative overflow-hidden bg-navy-900 text-cream">
          <Grid />
          <div className="relative mx-auto grid max-w-7xl items-center gap-14 px-5 pt-16 pb-24 sm:px-8 lg:grid-cols-[1.1fr_1fr] lg:pt-24 lg:pb-32">
            <div className="animate-fade-in">
              <p className="inline-flex items-center gap-2 rounded-full bg-white/5 px-3 py-1 text-xs font-medium text-marigold-300 ring-1 ring-white/10">
                <span className="size-1.5 rounded-full bg-marigold-400" />
                Central Mindanao University · Computer laboratories
              </p>
              <h1 className="mt-6 font-display text-5xl leading-[1.05] font-semibold tracking-tight sm:text-6xl lg:text-7xl">
                Lab entry,
                <br />
                <span className="text-marigold-400">on watch.</span>
              </h1>
              <p className="mt-6 max-w-xl text-lg leading-relaxed text-navy-200">
                Bantay records everyone who walks into the computer labs — who, which lab and when — using the
                CCTV cameras already on the walls. No logbook, no ID swipe, no queue at the door.
              </p>
              <div className="mt-9 flex flex-wrap items-center gap-3">
                {user ? (
                  <ButtonLink to="/dashboard" variant="accent" icon={<LayoutDashboard />} className="h-12 px-6 text-base">
                    Open dashboard
                  </ButtonLink>
                ) : (
                  <Button variant="accent" onClick={openLogin} icon={<LogIn />} className="h-12 px-6 text-base">
                    Log in
                  </Button>
                )}
                <a
                  href="#how-it-works"
                  className="inline-flex h-12 items-center gap-2 rounded-lg px-5 text-base font-medium text-cream ring-1 ring-white/20 transition-colors hover:bg-white/5"
                >
                  See how it works
                  <ArrowRight className="size-4" />
                </a>
              </div>
              <p className="mt-6 text-sm text-navy-300">
                <span className="font-medium text-cream">Bantay</span> means “guard” or “watch” in Filipino.
              </p>
            </div>
            <HeroVisual />
          </div>
        </section>

        {/* ------------------------------------------------------------ facts */}
        <section aria-label="At a glance" className="relative z-10 mx-auto -mt-12 max-w-6xl px-5 sm:px-8">
          <dl className="grid grid-cols-2 overflow-hidden rounded-2xl bg-white shadow-raised ring-1 ring-gray-200/80 lg:grid-cols-4">
            <Fact value="0" label="logbooks to sign" />
            <Fact value="3–5" label="photos to enroll a face" />
            <Fact value="1" label="entry per visit, thanks to a cooldown" />
            <Fact value="Any hour" label="logged, in or out of class schedules" />
          </dl>
        </section>

        {/* ------------------------------------------------------------ problem → features */}
        <section id="features" className="mx-auto max-w-7xl scroll-mt-24 px-5 py-24 sm:px-8">
          <SectionHeading
            eyebrow="Why Bantay"
            title="The logbook at the door doesn’t work"
            text="People forget it, rush it, or sign for a friend. Finding who was in a lab means flipping pages or scrubbing hours of footage. Bantay replaces all of that."
          />
          <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <Feature icon={<DoorOpen />} title="Every entry, automatically">
              People just walk in. The entrance camera does the logging, so no one forgets, skips or rushes it.
            </Feature>
            <Feature icon={<Fingerprint />} title="Identity from the face">
              Entries come from face recognition, not handwriting — no one can sign in for someone else.
            </Feature>
            <Feature icon={<Search />} title="Answers in seconds">
              “Who was in Lab 2 on Tuesday afternoon?” Search by person, lab and time, and export to CSV.
            </Feature>
            <Feature icon={<Cctv />} title="Uses the cameras you have">
              Connects to the existing IP cameras over RTSP. No new hardware at the door, no buttons to press.
            </Feature>
            <Feature icon={<LayoutDashboard />} title="Every lab in one view">
              Today’s entries, live camera feeds and usage per lab, all on one dashboard.
            </Feature>
            <Feature icon={<SlidersHorizontal />} title="Made for our rooms">
              Each lab has its own match threshold, and the model is being fine-tuned on footage from our own labs.
            </Feature>
          </div>
        </section>

        {/* ------------------------------------------------------------ how it works */}
        <section id="how-it-works" className="scroll-mt-16 bg-white py-24">
          <div className="mx-auto max-w-7xl px-5 sm:px-8">
            <SectionHeading
              eyebrow="How it works"
              title="From the doorway to the log, on its own"
              text="What happens when a student walks into Lab 1."
            />
            <ol className="mt-14 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
              <Step n={1} icon={<Cctv />} title="The camera sees them">
                The entrance camera streams live video to the Bantay server on the department network.
              </Step>
              <Step n={2} icon={<ScanFace />} title="The face is read">
                Bantay finds the face and turns it into a numeric face signature using InsightFace (ArcFace).
              </Step>
              <Step n={3} icon={<Fingerprint />} title="It’s matched">
                The signature is compared with everyone enrolled, and the closest match is found.
              </Step>
              <Step n={4} icon={<ClipboardCheck />} title="The entry is logged">
                If it’s a confident match and they weren’t just logged, Bantay records who, which lab, which camera and when.
              </Step>
            </ol>
          </div>
        </section>

        {/* ------------------------------------------------------------ privacy */}
        <section id="privacy" className="scroll-mt-16 bg-navy-900 py-24 text-cream">
          <div className="mx-auto grid max-w-7xl gap-14 px-5 sm:px-8 lg:grid-cols-[1fr_1.3fr] lg:items-center">
            <div>
              <p className="text-sm font-semibold tracking-[0.18em] text-marigold-400 uppercase">Privacy</p>
              <h2 className="mt-3 font-display text-4xl font-semibold tracking-tight">Watching the door, not the people</h2>
              <p className="mt-5 text-lg leading-relaxed text-navy-200">
                Bantay is built around the Data Privacy Act of 2012 (RA 10173). It keeps only what it needs to answer
                one question: who entered which lab, and when.
              </p>
            </div>
            <ul className="grid gap-4 sm:grid-cols-2">
              <PrivacyPoint icon={<ShieldCheck />} title="Consent first">
                No one is enrolled without a signed consent form.
              </PrivacyPoint>
              <PrivacyPoint icon={<ImageOff />} title="Photos aren’t kept">
                Enrollment photos become face data and are discarded straight away.
              </PrivacyPoint>
              <PrivacyPoint icon={<DoorOpen />} title="Entries only">
                No exits, time spent inside, class attendance or behaviour tracking.
              </PrivacyPoint>
              <PrivacyPoint icon={<Network />} title="Stays on campus">
                Runs on the department’s own server and local network.
              </PrivacyPoint>
            </ul>
          </div>
        </section>

        {/* ------------------------------------------------------------ call to action */}
        <section className="mx-auto max-w-5xl px-5 py-24 text-center sm:px-8">
          <BrandMark className="mx-auto size-14" />
          <h2 className="mt-6 font-display text-4xl font-semibold tracking-tight text-navy-900">Ready to check the labs?</h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-gray-500">
            Lab administrators and department staff can log in to see today’s entries, the live feeds and the full history.
          </p>
          <div className="mt-8 flex justify-center">
            {user ? (
              <ButtonLink to="/dashboard" variant="primary" icon={<LayoutDashboard />} className="h-12 px-6 text-base">
                Open dashboard
              </ButtonLink>
            ) : (
              <Button variant="primary" onClick={openLogin} icon={<LogIn />} className="h-12 px-6 text-base">
                Log in to Bantay
              </Button>
            )}
          </div>
        </section>
      </main>

      {/* ------------------------------------------------------------ footer */}
      <footer className="border-t border-gray-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-5 py-10 sm:px-8 md:flex-row md:items-center md:justify-between">
          <Logo variant="lockup" className="h-9 w-auto self-start" />
          <div className="text-sm text-gray-500 md:text-right">
            <p>A project by the students of Central Mindanao University</p>
            <p className="mt-1 text-xs">For academic, non-commercial use, under the InsightFace model licence.</p>
          </div>
        </div>
      </footer>

      <LoginModal open={loginOpen} onClose={closeLogin} next={params.get('next')} />
    </div>
  )
}

/* ---------------------------------------------------------------- pieces */

/** A faint grid behind the hero, like a camera's framing guides. */
function Grid() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 opacity-[0.07] [background-image:linear-gradient(var(--color-cream)_1px,transparent_1px),linear-gradient(90deg,var(--color-cream)_1px,transparent_1px)] [background-size:56px_56px] [mask-image:radial-gradient(ellipse_at_70%_40%,black,transparent_70%)]"
    />
  )
}

function Fact({ value, label }: { value: string; label: string }) {
  return (
    <div className="border-gray-100 px-6 py-6 not-last:border-r max-lg:nth-2:border-r-0 max-lg:nth-[-n+2]:border-b">
      <dt className="sr-only">{label}</dt>
      <dd>
        <span className="block font-display text-3xl font-semibold text-navy-900">{value}</span>
        <span className="mt-1 block text-sm text-gray-500">{label}</span>
      </dd>
    </div>
  )
}

function SectionHeading({ eyebrow, title, text }: { eyebrow: string; title: string; text: string }) {
  return (
    <div className="max-w-2xl">
      <p className="text-sm font-semibold tracking-[0.18em] text-marigold-600 uppercase">{eyebrow}</p>
      <h2 className="mt-3 font-display text-4xl font-semibold tracking-tight text-navy-900">{title}</h2>
      <p className="mt-4 text-lg leading-relaxed text-gray-500">{text}</p>
    </div>
  )
}

function Feature({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <div className="group rounded-2xl border border-gray-200/80 bg-white p-6 shadow-card transition-shadow hover:shadow-raised">
      <span className="flex size-11 items-center justify-center rounded-xl bg-navy-900 text-marigold-400 transition-transform group-hover:-translate-y-0.5 [&_svg]:size-5">
        {icon}
      </span>
      <h3 className="mt-5 text-lg font-semibold text-navy-900">{title}</h3>
      <p className="mt-2 leading-relaxed text-gray-500">{children}</p>
    </div>
  )
}

function Step({ n, icon, title, children }: { n: number; icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <li className="relative rounded-2xl bg-cream p-6 ring-1 ring-gray-200/70">
      <div className="flex items-center justify-between">
        <span className="flex size-11 items-center justify-center rounded-xl bg-white text-navy-800 shadow-card ring-1 ring-gray-200 [&_svg]:size-5">
          {icon}
        </span>
        <span className="font-display text-4xl font-semibold text-gray-200">0{n}</span>
      </div>
      <h3 className="mt-5 text-lg font-semibold text-navy-900">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-gray-500">{children}</p>
    </li>
  )
}

function PrivacyPoint({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <li className={cn('rounded-2xl bg-white/5 p-5 ring-1 ring-white/10')}>
      <span className="flex size-10 items-center justify-center rounded-xl bg-marigold-400 text-navy-950 [&_svg]:size-5">{icon}</span>
      <h3 className="mt-4 font-semibold text-cream">{title}</h3>
      <p className="mt-1 text-sm leading-relaxed text-navy-200">{children}</p>
    </li>
  )
}
