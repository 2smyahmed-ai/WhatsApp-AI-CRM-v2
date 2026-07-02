'use client'

import Link from 'next/link'
import { useEffect, useState, type ComponentType } from 'react'
import {
  MessageSquare, Users, BotMessageSquare, Megaphone, Workflow, Contact,
  BarChart3, Sparkles, Reply, Filter, FileText, Activity, Languages,
  User, Bot, Database, UtensilsCrossed, Stethoscope, Building2, Store,
  ShoppingBag, GraduationCap, Car, Check, ArrowRight, ChevronDown,
  Star, ShieldCheck, Menu, X, Globe, Zap, Send, type LucideProps,
} from 'lucide-react'
import { useLanguage } from '@/components/providers/I18nProvider'
import { LANDING, type LandingLang } from './content'
import Reveal from './Reveal'
import { InstallButton } from './InstallButton'
import { UpdateButton } from './UpdateButton'
import CountUp from '@/components/reactbits/CountUp'
import SpotlightCard from '@/components/reactbits/SpotlightCard'

type Icon = ComponentType<LucideProps>

const FEATURE_ICONS: Record<string, Icon> = {
  inbox: Users, ai: BotMessageSquare, broadcast: Megaphone,
  automation: Workflow, crm: Contact, analytics: BarChart3,
}
const AI_ICONS: Record<string, Icon> = {
  replies: Reply, qualify: Filter, summary: FileText,
  sentiment: Activity, suggest: Sparkles, translate: Languages,
}
const WORKFLOW_ICONS: Record<string, Icon> = {
  customer: User, ai: Bot, team: Users, crm: Database, reports: BarChart3,
}
const INDUSTRY_ICONS: Record<string, Icon> = {
  restaurants: UtensilsCrossed, clinics: Stethoscope, realestate: Building2,
  retail: Store, ecommerce: ShoppingBag, education: GraduationCap,
  automotive: Car, agencies: Megaphone,
}

// ─── Logo / brand mark ─────────────────────────────────────────────────────────
function BrandMark({ size = 'md' }: { size?: 'sm' | 'md' }) {
  const box = size === 'sm' ? 'w-7 h-7' : 'w-9 h-9'
  const icon = size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4'
  const text = size === 'sm' ? 'text-base' : 'text-lg'
  return (
    <div className="flex items-center gap-2.5">
      <div className={`${box} rounded-xl bg-gradient-to-br from-[#2ee676] to-[#0f9b6c] flex items-center justify-center shadow-lg shadow-emerald-500/30 ring-1 ring-white/10`}>
        <MessageSquare className={`${icon} text-white`} strokeWidth={2.5} />
      </div>
      <span className={`font-extrabold ${text} tracking-tight text-white`}>
        Nexus<span className="text-gold-gradient">CRM</span>
      </span>
    </div>
  )
}

// ─── Language toggle (dark, on-brand) ──────────────────────────────────────────
function LangToggle({ className = '' }: { className?: string }) {
  const { language, setLanguage } = useLanguage()
  const next: LandingLang = language === 'ar' ? 'en' : 'ar'
  return (
    <button
      type="button"
      onClick={() => setLanguage(next)}
      title={next === 'ar' ? 'التبديل إلى العربية' : 'Switch to English'}
      className={`group inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white/70 transition-colors hover:border-[#d4af37]/40 hover:text-[#f3d98b] ${className}`}
    >
      <Globe className="h-3.5 w-3.5" />
      <span>{language === 'ar' ? 'EN' : 'عربي'}</span>
    </button>
  )
}

// ─── Sticky navbar ─────────────────────────────────────────────────────────────
function LandingNav() {
  const { language } = useLanguage()
  const t = LANDING[language]
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'border-b border-white/10 bg-[#050b14]/80 backdrop-blur-xl supports-[backdrop-filter]:bg-[#050b14]/70'
          : 'border-b border-transparent bg-transparent'
      }`}
    >
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" aria-label="NexusCRM home"><BrandMark /></Link>

        <div className="hidden items-center gap-8 text-sm text-white/65 lg:flex">
          {t.nav.links.map((l) => (
            <a key={l.id} href={`#${l.id}`} className="relative transition-colors hover:text-white">
              {l.label}
            </a>
          ))}
        </div>

        <div className="hidden items-center gap-3 lg:flex">
          <LangToggle />
          <Link href="/login" className="text-sm font-medium text-white/70 transition-colors hover:text-white">
            {t.nav.signIn}
          </Link>
          <Link
            href="/login"
            className="lux-btn-primary inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold text-white transition-transform duration-200 hover:scale-[1.03] active:scale-95"
          >
            {t.nav.getStarted}
          </Link>
        </div>

        {/* Mobile */}
        <div className="flex items-center gap-2 lg:hidden">
          <LangToggle />
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label={t.nav.menu}
            aria-expanded={open}
            className="rounded-lg border border-white/10 bg-white/5 p-2 text-white/80"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </nav>

      {/* Mobile drawer */}
      {open && (
        <div className="border-t border-white/10 bg-[#050b14]/95 backdrop-blur-xl lg:hidden">
          <div className="mx-auto max-w-7xl space-y-1 px-4 py-4 sm:px-6">
            {t.nav.links.map((l) => (
              <a
                key={l.id}
                href={`#${l.id}`}
                onClick={() => setOpen(false)}
                className="block rounded-lg px-3 py-2.5 text-sm font-medium text-white/75 transition-colors hover:bg-white/5 hover:text-white"
              >
                {l.label}
              </a>
            ))}
            <div className="flex flex-col gap-2 pt-3">
              <Link href="/login" className="rounded-lg border border-white/12 px-4 py-2.5 text-center text-sm font-semibold text-white/80">
                {t.nav.signIn}
              </Link>
              <Link href="/login" className="lux-btn-primary rounded-lg px-4 py-2.5 text-center text-sm font-bold text-white">
                {t.nav.getStarted}
              </Link>
            </div>
          </div>
        </div>
      )}
    </header>
  )
}

// ─── Section heading ───────────────────────────────────────────────────────────
function SectionHeading({
  eyebrow, children, sub, headFont,
}: { eyebrow: string; children: React.ReactNode; sub?: string; headFont?: React.CSSProperties }) {
  return (
    <div className="mx-auto mb-14 max-w-2xl text-center">
      <Reveal>
        <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-[#d4af37]/25 bg-[#d4af37]/8 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[#f3d98b]">
          {eyebrow}
        </p>
      </Reveal>
      <Reveal delay={80}>
        <h2 style={headFont} className="text-balance text-3xl font-extrabold tracking-tight text-white sm:text-4xl lg:text-[2.75rem] lg:leading-[1.1]">
          {children}
        </h2>
      </Reveal>
      {sub && (
        <Reveal delay={140}>
          <p className="mt-4 text-pretty leading-relaxed text-white/55">{sub}</p>
        </Reveal>
      )}
    </div>
  )
}

// ─── FAQ accordion item ────────────────────────────────────────────────────────
function FaqItem({ q, a, headFont }: { q: string; a: string; headFont?: React.CSSProperties }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="lux-card overflow-hidden rounded-2xl">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-start sm:px-6 sm:py-5"
      >
        <span style={headFont} className="text-sm font-semibold text-white sm:text-base">{q}</span>
        <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border border-white/10 bg-white/5 text-white/70 transition-transform duration-300 ${open ? 'rotate-180 border-[#25D366]/40 text-[#25D366]' : ''}`}>
          <ChevronDown className="h-4 w-4" />
        </span>
      </button>
      <div className={`grid transition-all duration-300 ease-out ${open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
        <div className="overflow-hidden">
          <p className="px-5 pb-5 text-sm leading-relaxed text-white/55 sm:px-6">{a}</p>
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
export default function LandingPage() {
  const { language, isRTL } = useLanguage()
  const t = LANDING[language]
  const isAr = language === 'ar'
  const headFont: React.CSSProperties | undefined = isAr ? { fontFamily: "'Tajawal', sans-serif" } : undefined
  const arrowFlip = isRTL ? 'rotate-180' : ''

  return (
    <div className="lux-root relative min-h-screen overflow-x-hidden bg-[#050b14] text-white">
      {/* Ambient background */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="lux-aurora absolute inset-0 opacity-90" />
        <div className="absolute left-1/2 top-0 h-[520px] w-[820px] -translate-x-1/2 rounded-full bg-[#25D366]/10 blur-[140px]" />
        <div className="absolute right-0 top-1/3 h-[420px] w-[420px] rounded-full bg-[#d4af37]/6 blur-[130px]" />
      </div>

      <LandingNav />

      <main className="relative z-10">
        {/* ─── HERO ─────────────────────────────────────────────── */}
        <section className="relative px-4 pb-20 pt-28 sm:px-6 sm:pt-32 lg:px-8 lg:pb-28">
          <div className="lux-grid pointer-events-none absolute inset-0 -z-10" />
          <div className="mx-auto grid max-w-7xl items-center gap-14 lg:grid-cols-[1.05fr_0.95fr]">
            {/* Copy */}
            <div className="text-center lg:text-start">
              <Reveal>
                <span className="inline-flex items-center gap-2 rounded-full border border-[#25D366]/30 bg-[#25D366]/10 px-3.5 py-1.5 text-xs font-semibold text-[#5cf0a0]">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#25D366]" />
                  {t.hero.badge}
                </span>
              </Reveal>

              <h1 style={headFont} className="mt-6 text-balance text-4xl font-black leading-[1.08] tracking-tight sm:text-5xl lg:text-6xl xl:text-[4.1rem]">
                {t.hero.titlePre}
                <span className="text-gold-gradient">{t.hero.titleGold}</span>
                {t.hero.titlePost}
              </h1>

              <Reveal delay={120}>
                <p className="mx-auto mt-6 max-w-xl text-pretty text-base leading-relaxed text-white/60 sm:text-lg lg:mx-0">
                  {t.hero.subtitle}
                </p>
              </Reveal>

              <Reveal delay={200}>
                <div className="mt-9 flex flex-col items-center gap-3 sm:flex-row lg:items-start lg:justify-start justify-center">
                  <Link
                    href="/login"
                    className="lux-btn-primary group inline-flex w-full items-center justify-center gap-2.5 rounded-xl px-7 py-3.5 text-base font-bold text-white transition-transform duration-200 hover:scale-[1.03] active:scale-95 sm:w-auto"
                  >
                    {t.hero.ctaPrimary}
                    <ArrowRight className={`h-4 w-4 transition-transform group-hover:translate-x-1 ${arrowFlip}`} />
                  </Link>
                  <InstallButton
                    variant="hero"
                    className="lux-pulse-ring w-full sm:w-auto"
                    label={isAr ? 'حمّل التطبيق' : 'Download the App'}
                    installedLabel={isAr ? 'التطبيق مثبّت' : 'App Installed'}
                  />
                  <UpdateButton />
                </div>
                <Reveal delay={260}>
                  <div className="mt-4 flex justify-center lg:justify-start">
                    <Link
                      href="/login"
                      className="group inline-flex items-center gap-1.5 text-sm font-semibold text-white/55 transition-colors hover:text-[#f3d98b]"
                    >
                      {t.hero.ctaSecondary}
                      <ArrowRight className={`h-3.5 w-3.5 transition-transform group-hover:translate-x-1 ${arrowFlip}`} />
                    </Link>
                  </div>
                </Reveal>
              </Reveal>

              <Reveal delay={280}>
                <div className="mt-8 flex flex-wrap items-center justify-center gap-x-5 gap-y-3 text-sm text-white/45 lg:justify-start">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="flex">
                      {[...Array(5)].map((_, i) => (
                        <Star key={i} className="h-4 w-4 fill-[#f3d98b] text-[#f3d98b]" />
                      ))}
                    </span>
                    <span className="font-medium text-white/70">{t.hero.ratingLabel}</span>
                  </span>
                </div>
              </Reveal>
            </div>

            {/* Visual: dashboard mockup + floating cards */}
            <Reveal delay={160} className="relative">
              <div className="relative mx-auto w-full max-w-[270px] sm:max-w-[320px] lg:max-w-[400px]">
                {/* Ambient glow behind the device */}
                <div className="absolute -inset-10 rounded-full bg-gradient-to-br from-[#25D366]/25 via-[#d4af37]/10 to-transparent blur-3xl" />

                {/* Phone app screenshot — image already includes the device frame */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/hero-app.png"
                  alt={isAr ? 'تطبيق Nexus CRM على الجوال' : 'Nexus CRM dashboard on a phone'}
                  loading="eager"
                  draggable={false}
                  className="lux-float-slow relative z-10 h-auto w-full select-none drop-shadow-[0_36px_70px_rgba(0,0,0,0.65)]"
                />

                {/* Floating stat: AI handled */}
                <div className="lux-float-delay lux-glass absolute -top-3 -end-3 z-20 hidden rounded-2xl border border-white/12 p-3.5 shadow-xl shadow-black/40 sm:block lg:-end-10">
                  <div className="flex items-center gap-2.5">
                    <div className="grid h-9 w-9 place-items-center rounded-xl bg-[#25D366]/15">
                      <Bot className="h-5 w-5 text-[#25D366]" />
                    </div>
                    <div>
                      <p className="text-base font-extrabold leading-none text-white">
                        <CountUp to={70} suffix="%" duration={2.2} />
                      </p>
                      <p className="mt-0.5 text-[11px] text-white/50">{t.hero.floating.aiHandled}</p>
                    </div>
                  </div>
                </div>

                {/* Floating stat: reply time */}
                <div className="lux-float lux-glass absolute bottom-16 -start-3 z-20 hidden rounded-2xl border border-white/12 p-3.5 shadow-xl shadow-black/40 sm:block lg:-start-10">
                  <div className="flex items-center gap-2.5">
                    <div className="grid h-9 w-9 place-items-center rounded-xl bg-[#d4af37]/15">
                      <Zap className="h-5 w-5 text-[#f3d98b]" />
                    </div>
                    <div>
                      <p className="text-base font-extrabold leading-none text-white">2s</p>
                      <p className="mt-0.5 text-[11px] text-white/50">{t.hero.floating.replies}</p>
                    </div>
                  </div>
                </div>
              </div>
            </Reveal>
          </div>

          {/* Trust marquee */}
          <div className="mx-auto mt-20 max-w-7xl">
            <p className="mb-6 text-center text-xs font-semibold uppercase tracking-[0.2em] text-white/35">
              {t.trust.label}
            </p>
            <div className="lux-marquee relative overflow-hidden [mask-image:linear-gradient(to_right,transparent,#000_12%,#000_88%,transparent)]">
              <div className="lux-marquee-track gap-12 pe-12">
                {[...t.industries.items, ...t.industries.items].map((it, i) => {
                  const Ic = INDUSTRY_ICONS[it.key]
                  return (
                    <span key={i} className="inline-flex shrink-0 items-center gap-2 text-sm font-semibold text-white/40">
                      <Ic className="h-4 w-4" /> {it.label}
                    </span>
                  )
                })}
              </div>
            </div>
          </div>
        </section>

        {/* ─── STATS BAND ───────────────────────────────────────── */}
        <section className="px-4 py-8 sm:px-6 lg:px-8">
          <Reveal>
            <div className="lux-card mx-auto grid max-w-6xl grid-cols-2 gap-px overflow-hidden rounded-3xl md:grid-cols-4">
              {t.stats.map((s, i) => (
                <div key={i} className="flex flex-col items-center justify-center gap-1 px-4 py-8 text-center">
                  <span className="text-3xl font-black tracking-tight text-white sm:text-4xl">
                    <CountUp to={s.value} suffix={s.suffix} duration={2.4} delay={0.15 * i} />
                  </span>
                  <span className="text-xs text-white/45 sm:text-sm">{s.label}</span>
                </div>
              ))}
            </div>
          </Reveal>
        </section>

        {/* ─── FEATURES ─────────────────────────────────────────── */}
        <section id="features" className="scroll-mt-20 px-4 py-24 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <SectionHeading eyebrow={t.features.eyebrow} sub={t.features.subtitle} headFont={headFont}>
              {t.features.title} <span className="text-emerald-gradient">{t.features.titleMuted}</span>
            </SectionHeading>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {t.features.items.map((f, i) => {
                const Ic = FEATURE_ICONS[f.key]
                return (
                  <Reveal key={f.key} delay={(i % 3) * 80}>
                    <SpotlightCard
                      spotlightColor="rgba(37, 211, 102, 0.14)"
                      className="lux-card h-full rounded-2xl p-6"
                    >
                      <div className="mb-4 grid h-12 w-12 place-items-center rounded-xl bg-gradient-to-br from-[#25D366]/18 to-[#0f9b6c]/8 ring-1 ring-inset ring-[#25D366]/15">
                        <Ic className="h-6 w-6 text-[#5cf0a0]" />
                      </div>
                      <h3 style={headFont} className="mb-2 text-base font-bold text-white">{f.title}</h3>
                      <p className="text-sm leading-relaxed text-white/55">{f.desc}</p>
                    </SpotlightCard>
                  </Reveal>
                )
              })}
            </div>
          </div>
        </section>

        {/* ─── AI SECTION ───────────────────────────────────────── */}
        <section id="ai" className="relative scroll-mt-20 overflow-hidden px-4 py-24 sm:px-6 lg:px-8">
          <div className="absolute inset-0 -z-10 bg-gradient-to-b from-transparent via-[#25D366]/[0.04] to-transparent" />
          <div className="mx-auto grid max-w-7xl items-center gap-14 lg:grid-cols-2">
            <div>
              <Reveal>
                <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-[#d4af37]/25 bg-[#d4af37]/8 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[#f3d98b]">
                  <Sparkles className="h-3.5 w-3.5" /> {t.ai.eyebrow}
                </p>
              </Reveal>
              <Reveal delay={80}>
                <h2 style={headFont} className="text-balance text-3xl font-extrabold leading-[1.12] tracking-tight text-white sm:text-4xl">
                  {t.ai.title} <span className="text-gold-gradient">{t.ai.titleGold}</span>
                </h2>
              </Reveal>
              <Reveal delay={140}>
                <p className="mt-4 leading-relaxed text-white/55">{t.ai.subtitle}</p>
              </Reveal>

              <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {t.ai.capabilities.map((c, i) => {
                  const Ic = AI_ICONS[c.key]
                  return (
                    <Reveal key={c.key} delay={i * 60}>
                      <div className="lux-card flex items-start gap-3 rounded-xl p-3.5">
                        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#25D366]/12">
                          <Ic className="h-5 w-5 text-[#5cf0a0]" />
                        </div>
                        <div>
                          <p style={headFont} className="text-sm font-semibold text-white">{c.title}</p>
                          <p className="mt-0.5 text-xs leading-relaxed text-white/50">{c.desc}</p>
                        </div>
                      </div>
                    </Reveal>
                  )
                })}
              </div>
            </div>

            {/* AI copilot panel */}
            <Reveal delay={120}>
              <div className="relative">
                <div className="absolute -inset-5 rounded-[2rem] bg-gradient-to-br from-[#d4af37]/12 via-[#25D366]/10 to-transparent blur-2xl" />
                <div className="lux-hairline relative overflow-hidden rounded-[1.4rem] border border-white/10 bg-[#0b1622] shadow-2xl shadow-black/60">
                  {/* Chat header */}
                  <div className="flex items-center gap-3 border-b border-white/8 bg-[#0c1726] px-4 py-3">
                    <div className="relative">
                      <div className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-[#25D366]/40 to-emerald-700/30 text-sm font-bold text-white">
                        {t.hero.chat.contactName.charAt(0)}
                      </div>
                      <span className="absolute -bottom-0.5 -end-0.5 h-3 w-3 rounded-full border-2 border-[#0c1726] bg-[#25D366]" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-white">{t.hero.chat.contactName}</p>
                      <p className="text-[11px] text-[#5cf0a0]">{t.hero.chat.status}</p>
                    </div>
                    <span className="ms-auto inline-flex items-center gap-1.5 rounded-full border border-[#d4af37]/25 bg-[#d4af37]/10 px-2.5 py-1 text-[10px] font-bold text-[#f3d98b]">
                      <Bot className="h-3.5 w-3.5" /> {t.ai.panelTitle}
                    </span>
                  </div>

                  {/* Chat thread */}
                  <div className="space-y-3 bg-[radial-gradient(circle_at_top,rgba(37,211,102,0.05),transparent_55%)] px-4 py-5">
                    {/* Customer message */}
                    <div className="flex justify-start">
                      <div className="max-w-[82%] rounded-2xl rounded-ss-md bg-white/8 px-3.5 py-2">
                        <p className="text-[13px] text-white/85">{t.ai.customerMsg}</p>
                        <p className="mt-1 text-end text-[10px] text-white/35">10:38</p>
                      </div>
                    </div>

                    {/* AI read the sentiment */}
                    <div className="flex items-center gap-2 ps-1">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-[#25D366]/12 px-2.5 py-1 text-[11px] font-semibold text-[#5cf0a0]">
                        <Activity className="h-3 w-3" /> {t.ai.sentiment}
                      </span>
                      <span className="text-[10px] text-white/30">{t.ai.sentimentLabel}</span>
                    </div>

                    {/* Assistant typing */}
                    <div className="flex justify-start">
                      <div className="inline-flex items-center gap-1.5 rounded-2xl rounded-ss-md bg-white/8 px-3 py-3">
                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#5cf0a0] [animation-duration:1s]" />
                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#5cf0a0] [animation-delay:0.15s] [animation-duration:1s]" />
                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#5cf0a0] [animation-delay:0.3s] [animation-duration:1s]" />
                      </div>
                    </div>

                    {/* AI suggested reply */}
                    <div className="relative overflow-hidden rounded-2xl rounded-se-md border border-[#d4af37]/25 bg-gradient-to-br from-[#d4af37]/12 to-[#25D366]/5 p-3.5">
                      <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#f3d98b]">
                        <Sparkles className="h-3.5 w-3.5" /> {t.ai.suggestionLabel}
                      </div>
                      <p className="text-[13px] leading-relaxed text-white/85">{t.ai.suggestion}</p>
                      <button type="button" className="lux-btn-gold mt-3 inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-bold">
                        <Check className="h-3.5 w-3.5" /> {t.ai.insertCta}
                      </button>
                    </div>
                  </div>

                  {/* Composer */}
                  <div className="flex items-center gap-2 border-t border-white/8 bg-[#0c1726] px-3 py-3">
                    <div className="flex-1 truncate rounded-full bg-white/5 px-4 py-2.5 text-[12px] text-white/35">
                      {t.ai.composerPlaceholder}
                    </div>
                    <button
                      type="button"
                      aria-label={t.ai.insertCta}
                      className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#2ee676] to-[#0f9b6c] text-white shadow-lg shadow-emerald-900/40"
                    >
                      <Send className={`h-4 w-4 ${isRTL ? '-scale-x-100' : ''}`} />
                    </button>
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        {/* ─── WORKFLOW ─────────────────────────────────────────── */}
        <section className="px-4 py-24 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <SectionHeading eyebrow={t.workflow.eyebrow} sub={t.workflow.subtitle} headFont={headFont}>
              {t.workflow.title}
            </SectionHeading>

            <div className="relative grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-5">
              <div className="pointer-events-none absolute inset-x-12 top-9 hidden h-px bg-gradient-to-r from-[#25D366]/0 via-[#d4af37]/40 to-[#25D366]/0 lg:block" />
              {t.workflow.steps.map((s, i) => {
                const Ic = WORKFLOW_ICONS[s.key]
                return (
                  <Reveal key={s.key} delay={i * 90}>
                    <div className="relative flex flex-col items-center text-center">
                      <div className="relative mb-5">
                        <div className="grid h-16 w-16 place-items-center rounded-2xl border border-white/10 bg-gradient-to-br from-[#0c1726] to-[#091321] shadow-lg shadow-black/40">
                          <Ic className="h-7 w-7 text-[#5cf0a0]" />
                        </div>
                        <span className="absolute -end-1.5 -top-1.5 grid h-6 w-6 place-items-center rounded-full bg-gradient-to-br from-[#f3d98b] to-[#d4af37] text-[11px] font-black text-[#1a1407]">
                          {i + 1}
                        </span>
                      </div>
                      <h3 style={headFont} className="mb-1.5 text-base font-bold text-white">{s.title}</h3>
                      <p className="max-w-[15rem] text-sm leading-relaxed text-white/50">{s.desc}</p>
                    </div>
                  </Reveal>
                )
              })}
            </div>
          </div>
        </section>

        {/* ─── INDUSTRIES ───────────────────────────────────────── */}
        <section id="industries" className="scroll-mt-20 px-4 py-24 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <SectionHeading eyebrow={t.industries.eyebrow} sub={t.industries.subtitle} headFont={headFont}>
              {t.industries.title}
            </SectionHeading>

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {t.industries.items.map((it, i) => {
                const Ic = INDUSTRY_ICONS[it.key]
                return (
                  <Reveal key={it.key} delay={(i % 4) * 70}>
                    <div className="group lux-card flex h-full flex-col items-start gap-4 rounded-2xl p-5 hover:-translate-y-1">
                      <div className="grid h-12 w-12 place-items-center rounded-xl bg-[#25D366]/12 ring-1 ring-inset ring-[#25D366]/15 transition-colors group-hover:bg-[#25D366]/20">
                        <Ic className="h-6 w-6 text-[#5cf0a0]" />
                      </div>
                      <p style={headFont} className="text-sm font-bold text-white sm:text-base">{it.label}</p>
                    </div>
                  </Reveal>
                )
              })}
            </div>
          </div>
        </section>

        {/* ─── SHOWCASE ─────────────────────────────────────────── */}
        <section className="px-4 py-24 sm:px-6 lg:px-8">
          <div className="mx-auto grid max-w-7xl items-center gap-14 lg:grid-cols-2">
            <div>
              <Reveal>
                <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-[#d4af37]/25 bg-[#d4af37]/8 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[#f3d98b]">
                  {t.showcase.eyebrow}
                </p>
              </Reveal>
              <Reveal delay={80}>
                <h2 style={headFont} className="text-balance text-3xl font-extrabold leading-[1.12] tracking-tight text-white sm:text-4xl">
                  {t.showcase.title} <span className="text-gold-gradient">{t.showcase.titleGold}</span>
                </h2>
              </Reveal>
              <Reveal delay={140}>
                <p className="mt-4 leading-relaxed text-white/55">{t.showcase.subtitle}</p>
              </Reveal>
              <ul className="mt-7 space-y-3">
                {t.showcase.bullets.map((b, i) => (
                  <li key={i}>
                    <Reveal delay={i * 70}>
                      <span className="flex items-start gap-3 text-sm text-white/75">
                        <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[#25D366]/15">
                          <Check className="h-3.5 w-3.5 text-[#25D366]" />
                        </span>
                        {b}
                      </span>
                    </Reveal>
                  </li>
                ))}
              </ul>
            </div>

            {/* Browser mockup */}
            <Reveal delay={120}>
              <div className="relative">
                <div className="absolute -inset-6 rounded-[2rem] bg-gradient-to-br from-[#25D366]/15 to-[#d4af37]/8 blur-2xl" />
                <div className="lux-hairline relative overflow-hidden rounded-2xl border border-white/10 bg-[#091321] shadow-2xl shadow-black/60">
                  <div className="flex items-center gap-2 border-b border-white/8 bg-[#0c1726] px-4 py-3">
                    <div className="flex gap-1.5">
                      <span className="h-3 w-3 rounded-full bg-red-500/60" />
                      <span className="h-3 w-3 rounded-full bg-amber-500/60" />
                      <span className="h-3 w-3 rounded-full bg-emerald-500/60" />
                    </div>
                    <div className="mx-4 flex h-6 flex-1 items-center rounded-md bg-white/5 px-3">
                      <span className="text-[11px] text-white/35" dir="ltr">{t.showcase.url}</span>
                    </div>
                  </div>
                  <div className="flex h-80 sm:h-96">
                    {/* Sidebar */}
                    <div className="hidden w-56 flex-col border-e border-white/8 sm:flex">
                      <div className="border-b border-white/8 px-3 py-3">
                        <div className="h-7 w-full rounded-md bg-white/5" />
                      </div>
                      {t.testimonials.items.concat(t.testimonials.items.slice(0, 1)).map((c, i) => (
                        <div key={i} className={`flex items-center gap-2.5 border-b border-white/5 px-3 py-3 ${i === 0 ? 'bg-[#25D366]/8' : ''}`}>
                          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-white/12 to-white/4 text-[11px] font-bold text-white/70">
                            {c.author.charAt(0)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="h-2.5 w-20 rounded bg-white/12" />
                            <div className="mt-1.5 h-2 w-28 rounded bg-white/6" />
                          </div>
                          {i === 0 && <span className="grid h-4 w-4 place-items-center rounded-full bg-[#25D366] text-[9px] font-bold text-white">3</span>}
                        </div>
                      ))}
                    </div>
                    {/* Pane */}
                    <div className="flex flex-1 flex-col">
                      <div className="flex items-center gap-2.5 border-b border-white/8 px-4 py-3">
                        <div className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-[#25D366]/40 to-emerald-700/30 text-xs font-bold text-white">
                          {t.hero.chat.contactName.charAt(0)}
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-white">{t.hero.chat.contactName}</p>
                          <p className="text-[10px] text-[#25D366]">{t.hero.chat.status}</p>
                        </div>
                      </div>
                      <div className="flex-1 space-y-3 px-4 py-4">
                        <div className="flex justify-start">
                          <div className="max-w-[75%] rounded-2xl rounded-ss-md bg-white/8 px-3 py-2 text-xs text-white/85">{t.hero.chat.inbound1}</div>
                        </div>
                        <div className="flex justify-end">
                          <div className="max-w-[78%] rounded-2xl rounded-se-md bg-gradient-to-br from-[#0c8a5a] to-[#0a6e48] px-3 py-2 text-xs text-white">{t.hero.chat.outbound1}</div>
                        </div>
                        {/* interactive buttons preview */}
                        <div className="flex justify-end">
                          <div className="w-[78%] space-y-1.5">
                            <button type="button" className="w-full rounded-lg border border-[#25D366]/30 bg-[#25D366]/10 py-2 text-[11px] font-semibold text-[#5cf0a0]">{t.showcase.bullets[0]}</button>
                            <button type="button" className="w-full rounded-lg border border-white/10 bg-white/5 py-2 text-[11px] font-semibold text-white/70">{t.ai.insertCta}</button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        {/* ─── TESTIMONIALS ─────────────────────────────────────── */}
        <section className="px-4 py-24 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <SectionHeading eyebrow={t.testimonials.eyebrow} headFont={headFont}>
              {t.testimonials.title}
            </SectionHeading>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              {t.testimonials.items.map((tm, i) => (
                <Reveal key={tm.author} delay={i * 90}>
                  <SpotlightCard
                    spotlightColor="rgba(212, 175, 55, 0.12)"
                    className="lux-card flex h-full flex-col gap-4 rounded-2xl p-6"
                  >
                    <div className="flex gap-0.5">
                      {[...Array(5)].map((_, s) => (
                        <Star key={s} className="h-4 w-4 fill-[#f3d98b] text-[#f3d98b]" />
                      ))}
                    </div>
                    <p className="flex-1 text-sm leading-relaxed text-white/75">&ldquo;{tm.quote}&rdquo;</p>
                    <div className="flex items-center gap-3 border-t border-white/8 pt-4">
                      <div className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-[#25D366]/30 to-[#d4af37]/20 text-sm font-bold text-white">
                        {tm.author.charAt(0)}
                      </div>
                      <div>
                        <p style={headFont} className="text-sm font-semibold text-white">{tm.author}</p>
                        <p className="text-xs text-white/45">{tm.role}</p>
                      </div>
                    </div>
                  </SpotlightCard>
                </Reveal>
              ))}
            </div>
          </div>
        </section>


        {/* ─── FAQ ──────────────────────────────────────────────── */}
        <section id="faq" className="scroll-mt-20 px-4 py-24 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl">
            <SectionHeading eyebrow={t.faq.eyebrow} sub={t.faq.subtitle} headFont={headFont}>
              {t.faq.title}
            </SectionHeading>
            <div className="space-y-3">
              {t.faq.items.map((item, i) => (
                <Reveal key={i} delay={i * 60}>
                  <FaqItem q={item.q} a={item.a} headFont={headFont} />
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ─── FINAL CTA ────────────────────────────────────────── */}
        <section className="px-4 py-24 sm:px-6 lg:px-8">
          <Reveal>
            <div className="lux-hairline relative mx-auto max-w-5xl overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-br from-[#0c1f1a] via-[#091321] to-[#0c1726] px-6 py-16 text-center sm:px-12">
              <div className="lux-aurora pointer-events-none absolute inset-0 opacity-80" />
              <div className="pointer-events-none absolute left-1/2 top-0 h-72 w-[34rem] -translate-x-1/2 rounded-full bg-[#25D366]/15 blur-[110px]" />
              <div className="relative">
                <h2 style={headFont} className="mx-auto max-w-2xl text-balance text-3xl font-extrabold leading-[1.15] tracking-tight text-white sm:text-4xl lg:text-[2.6rem]">
                  {t.finalCta.title}
                </h2>
                <p className="mx-auto mt-5 max-w-xl text-pretty leading-relaxed text-white/55">{t.finalCta.subtitle}</p>
                <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
                  <Link
                    href="/login"
                    className="lux-btn-primary group inline-flex w-full items-center justify-center gap-2.5 rounded-xl px-8 py-4 text-base font-bold text-white transition-transform duration-200 hover:scale-[1.03] active:scale-95 sm:w-auto"
                  >
                    {t.finalCta.primary}
                    <ArrowRight className={`h-5 w-5 transition-transform group-hover:translate-x-1 ${arrowFlip}`} />
                  </Link>
                  <InstallButton
                    variant="hero"
                    className="w-full justify-center sm:w-auto"
                    label={isAr ? 'ثبّت التطبيق' : 'Install the App'}
                    installedLabel={isAr ? 'التطبيق مثبّت' : 'App Installed'}
                  />
                </div>
                <p className="mt-6 text-xs text-white/35">{t.finalCta.reassurance}</p>
              </div>
            </div>
          </Reveal>
        </section>
      </main>

      {/* ─── FOOTER ───────────────────────────────────────────── */}
      <footer className="relative z-10 border-t border-white/8 px-4 py-14 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="grid grid-cols-2 gap-8 md:grid-cols-5">
            <div className="col-span-2">
              <BrandMark size="sm" />
              <p className="mt-3 max-w-[230px] text-sm leading-relaxed text-white/40">{t.footer.tagline}</p>
              <div className="mt-4">
                <LangToggle />
              </div>
            </div>
            {t.footer.columns.map((col) => (
              <div key={col.title}>
                <p style={headFont} className="mb-4 text-xs font-semibold uppercase tracking-wider text-white/55">{col.title}</p>
                <ul className="space-y-2.5">
                  {col.links.map((l) => (
                    <li key={l}>
                      <a href="#" className="text-sm text-white/40 transition-colors hover:text-[#f3d98b]">{l}</a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-white/8 pt-7 sm:flex-row">
            <p className="text-xs text-white/30">
              © {new Date().getFullYear()} NexusCRM. {t.footer.rights} {t.footer.disclaimer}
            </p>
            <div className="flex flex-wrap items-center gap-4">
              {t.footer.badges.map((b) => (
                <span key={b} className="inline-flex items-center gap-1.5 text-xs text-white/35">
                  <ShieldCheck className="h-3.5 w-3.5 text-[#25D366]/60" /> {b}
                </span>
              ))}
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
