import Link from 'next/link'
import {
  MessageSquare, Zap, Users, BarChart3, Shield, Globe2,
  CheckCircle2, ArrowRight, Monitor, Smartphone, Layers,
  BotMessageSquare, Bell, Target, ChevronRight, Star,
} from 'lucide-react'
import { InstallButton } from '@/components/landing/InstallButton'

// ─── Static data ─────────────────────────────────────────────────────────────

const FEATURES = [
  {
    icon: MessageSquare,
    title: 'WhatsApp-Native Messaging',
    desc: 'Real bubbles, delivery ticks, reactions, replies, and interactive buttons — exactly as WhatsApp renders them.',
    color: 'from-green-500/20 to-emerald-500/10',
    accent: '#25D366',
  },
  {
    icon: Layers,
    title: 'Multi-Provider Support',
    desc: 'Switch between Meta Business API and Baileys (QR scan) with automatic failover. Zero message loss.',
    color: 'from-blue-500/20 to-cyan-500/10',
    accent: '#3b82f6',
  },
  {
    icon: Zap,
    title: 'Realtime Sync',
    desc: 'Sub-second message delivery, live typing indicators, and instant read receipts across every device.',
    color: 'from-yellow-500/20 to-amber-500/10',
    accent: '#f59e0b',
  },
  {
    icon: BotMessageSquare,
    title: 'Smart Automation',
    desc: 'Build flows, trigger campaigns, run AI-powered bots, and respond to events automatically — 24/7.',
    color: 'from-purple-500/20 to-violet-500/10',
    accent: '#8b5cf6',
  },
  {
    icon: Users,
    title: 'Team Inbox',
    desc: 'Assign conversations, add internal notes, route by tags, and never let a message fall through the cracks.',
    color: 'from-pink-500/20 to-rose-500/10',
    accent: '#ec4899',
  },
  {
    icon: BarChart3,
    title: 'Analytics & Reports',
    desc: 'Track response times, campaign conversions, message delivery rates, and team performance in real time.',
    color: 'from-orange-500/20 to-red-500/10',
    accent: '#f97316',
  },
]

const STEPS = [
  {
    n: '01',
    title: 'Connect WhatsApp',
    desc: 'Link via Meta Business API with your WABA number, or scan a QR code with Baileys — ready in minutes.',
    icon: Globe2,
  },
  {
    n: '02',
    title: 'Import Contacts',
    desc: 'Upload CSV, sync from your CRM, or let conversations auto-create contacts as people message you.',
    icon: Users,
  },
  {
    n: '03',
    title: 'Message at Scale',
    desc: 'Send broadcast campaigns, set automation flows, reply from the team inbox, and watch analytics update live.',
    icon: Target,
  },
]

const PLANS = [
  {
    name: 'Starter',
    price: 'Free',
    sub: 'Forever free for small teams',
    features: ['1 WhatsApp number', 'Up to 500 contacts', '3 team members', 'Basic automation', 'Community support'],
    cta: 'Get Started Free',
    href: '/login',
    highlight: false,
  },
  {
    name: 'Professional',
    price: '$49',
    sub: 'per month, billed monthly',
    features: [
      '3 WhatsApp numbers',
      'Up to 10,000 contacts',
      'Unlimited team members',
      'Advanced automation + AI bot',
      'Broadcast campaigns',
      'Priority support',
    ],
    cta: 'Start Free Trial',
    href: '/login',
    highlight: true,
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    sub: 'Self-hosted or managed cloud',
    features: [
      'Unlimited numbers',
      'Unlimited contacts',
      'White-label option',
      'Custom integrations',
      'Dedicated infrastructure',
      'SLA + onboarding',
    ],
    cta: 'Contact Sales',
    href: 'mailto:sales@nexuscrm.io',
    highlight: false,
  },
]

const TESTIMONIALS = [
  {
    quote: 'We went from managing 200 WhatsApp chats in our phones to routing 3,000 conversations a day through a single team inbox.',
    author: 'Sara Al-Rashid',
    role: 'Head of Support, NovaMart',
  },
  {
    quote: 'The broadcast templates work exactly like real WhatsApp messages — not the broken HTML previews other tools give you.',
    author: 'Diego Mendes',
    role: 'Growth Lead, BrasilTech',
  },
  {
    quote: "Installation took 10 minutes. The AI bot handles 70% of inbound questions before a human even sees them.",
    author: 'Khalid Farooq',
    role: 'CEO, FastShip Logistics',
  },
]

// ─── Page ────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#050c18] text-white overflow-x-hidden">
      {/* Ambient gradients */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] rounded-full bg-[#25D366]/8 blur-[120px]" />
        <div className="absolute top-1/3 right-0 w-[500px] h-[500px] rounded-full bg-blue-600/6 blur-[100px]" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] rounded-full bg-emerald-600/5 blur-[100px]" />
      </div>

      {/* ─── Navbar ─────────────────────────────────────────────── */}
      <header className="relative z-20 border-b border-white/5 backdrop-blur-md bg-[#050c18]/80 sticky top-0">
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#25D366] to-[#128C7E] flex items-center justify-center shadow-lg shadow-green-500/25">
              <MessageSquare className="w-4 h-4 text-white" strokeWidth={2.5} />
            </div>
            <span className="font-bold text-lg tracking-tight">
              Nexus<span className="text-[#25D366]">CRM</span>
            </span>
          </div>

          {/* Nav links */}
          <div className="hidden md:flex items-center gap-7 text-sm text-white/60">
            <a href="#features" className="hover:text-white transition-colors">Features</a>
            <a href="#how-it-works" className="hover:text-white transition-colors">How it works</a>
            <a href="#install" className="hover:text-white transition-colors">Get the app</a>
            <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>
          </div>

          {/* CTAs */}
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm text-white/60 hover:text-white transition-colors hidden sm:block">
              Sign in
            </Link>
            <Link
              href="/login"
              className="text-sm font-semibold px-4 py-2 rounded-lg bg-[#25D366] hover:bg-[#1db954] text-white transition-all duration-200 hover:shadow-lg hover:shadow-green-500/25 hover:scale-105 active:scale-95"
            >
              Get Started
            </Link>
          </div>
        </nav>
      </header>

      <main className="relative z-10">
        {/* ─── Hero ─────────────────────────────────────────────── */}
        <section className="pt-20 pb-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 mb-6 px-3 py-1.5 rounded-full border border-[#25D366]/30 bg-[#25D366]/10 text-[#25D366] text-xs font-semibold tracking-wide">
            <span className="w-1.5 h-1.5 rounded-full bg-[#25D366] animate-pulse" />
            WhatsApp Business Platform
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-black tracking-tight leading-[1.08] mb-6">
            The CRM Built for{' '}
            <span className="relative inline-block">
              <span className="bg-gradient-to-r from-[#25D366] via-emerald-400 to-[#128C7E] bg-clip-text text-transparent">
                WhatsApp Scale
              </span>
              <span className="absolute -bottom-1 left-0 right-0 h-[3px] bg-gradient-to-r from-[#25D366] to-transparent rounded-full opacity-60" />
            </span>
          </h1>

          <p className="max-w-2xl mx-auto text-lg sm:text-xl text-white/55 leading-relaxed mb-10">
            Send templates, run campaigns, automate replies, and manage your entire team inbox — all with real WhatsApp rendering across Meta API and Baileys.
          </p>

          {/* CTA buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
            <Link
              href="/login"
              className="group inline-flex items-center gap-2.5 px-7 py-3.5 rounded-xl font-bold text-base bg-[#25D366] hover:bg-[#1db954] text-white transition-all duration-200 hover:shadow-xl hover:shadow-green-500/30 hover:scale-105 active:scale-95"
            >
              Start Free — No Card Needed
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
            <InstallButton variant="hero" />
          </div>

          {/* Social proof */}
          <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-white/40">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-[#25D366]" />
              <span>500+ businesses</span>
            </div>
            <div className="w-px h-4 bg-white/10 hidden sm:block" />
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-[#25D366]" />
              <span>2M+ messages/day</span>
            </div>
            <div className="w-px h-4 bg-white/10 hidden sm:block" />
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-[#25D366]" />
              <span>99.9% uptime</span>
            </div>
            <div className="w-px h-4 bg-white/10 hidden sm:block" />
            <div className="flex items-center gap-1.5">
              <div className="flex -space-x-0.5">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                ))}
              </div>
              <span>4.9/5 rating</span>
            </div>
          </div>

          {/* App preview mockup */}
          <div className="mt-16 relative max-w-4xl mx-auto">
            <div className="absolute inset-0 -m-4 rounded-3xl bg-gradient-to-b from-[#25D366]/10 to-transparent blur-2xl" />
            <div className="relative rounded-2xl border border-white/10 bg-[#0a1628] overflow-hidden shadow-2xl shadow-black/50">
              {/* Fake browser chrome */}
              <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5 bg-[#060e1c]">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-500/60" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
                  <div className="w-3 h-3 rounded-full bg-green-500/60" />
                </div>
                <div className="flex-1 mx-4 h-6 rounded-md bg-white/5 flex items-center px-3">
                  <span className="text-[11px] text-white/30">app.nexuscrm.io/dashboard/conversations</span>
                </div>
              </div>

              {/* Chat UI mockup */}
              <div className="flex h-72 sm:h-96">
                {/* Sidebar */}
                <div className="w-64 border-r border-white/5 hidden sm:flex flex-col">
                  <div className="px-3 py-3 border-b border-white/5">
                    <div className="h-7 rounded-md bg-white/5 w-full" />
                  </div>
                  {[
                    { name: 'Sara Ahmed', msg: 'Order confirmed ✓✓', time: '10:42', unread: 2, green: true },
                    { name: 'Mohammed K.', msg: 'When will it ship?', time: '10:31', unread: 0, green: false },
                    { name: 'Layla Hassan', msg: 'Thank you! 🙏', time: '09:58', unread: 0, green: false },
                    { name: 'Ahmed Al-F.', msg: 'Template sent', time: '09:14', unread: 0, green: false },
                  ].map((c, i) => (
                    <div key={i} className={`flex items-center gap-3 px-3 py-3 border-b border-white/3 ${i === 0 ? 'bg-[#25D366]/10' : 'hover:bg-white/3'}`}>
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-white/10 to-white/5 flex items-center justify-center text-xs font-bold text-white/70 flex-shrink-0">
                        {c.name[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-semibold text-white/80 truncate">{c.name}</span>
                          <span className="text-[10px] text-white/30 ml-1 flex-shrink-0">{c.time}</span>
                        </div>
                        <p className="text-[11px] text-white/40 truncate mt-0.5">{c.msg}</p>
                      </div>
                      {c.unread > 0 && (
                        <span className="w-4 h-4 rounded-full bg-[#25D366] text-white text-[9px] font-bold flex items-center justify-center flex-shrink-0">
                          {c.unread}
                        </span>
                      )}
                    </div>
                  ))}
                </div>

                {/* Chat pane */}
                <div className="flex-1 flex flex-col">
                  {/* Chat header */}
                  <div className="flex items-center gap-3 px-4 py-3 border-b border-white/5">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#25D366]/40 to-emerald-600/20 flex items-center justify-center text-xs font-bold text-white">S</div>
                    <div>
                      <p className="text-xs font-semibold text-white">Sara Ahmed</p>
                      <p className="text-[10px] text-[#25D366]">online</p>
                    </div>
                  </div>

                  {/* Messages */}
                  <div className="flex-1 px-4 py-4 space-y-3 overflow-hidden">
                    <div className="flex justify-start">
                      <div className="max-w-[70%] rounded-2xl rounded-tl-sm bg-white/8 px-3 py-2">
                        <p className="text-xs text-white/80">Hi! Is my order ready?</p>
                        <p className="text-[10px] text-white/30 mt-1 text-right">10:38</p>
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <div className="max-w-[70%] rounded-2xl rounded-tr-sm bg-[#25D366] px-3 py-2">
                        <p className="text-xs text-white">Yes! Your order #2847 is confirmed and ships today 🎉</p>
                        <div className="flex items-center justify-end gap-1 mt-1">
                          <p className="text-[10px] text-white/70">10:40</p>
                          <svg className="w-3 h-3 text-white/80" viewBox="0 0 16 11" fill="currentColor">
                            <path d="M11.071.653a.45.45 0 0 0-.304.848l.025.024-7.97 8.6-.025-.024a.45.45 0 1 0-.651.62l.5.524a.45.45 0 0 0 .65.001l8.5-9.175a.45.45 0 0 0-.725-.394zM14.575.324a.45.45 0 0 0-.63.058l-7.97 8.6a.45.45 0 1 0 .651.62l7.97-8.6a.45.45 0 0 0-.021-.678z"/>
                          </svg>
                        </div>
                      </div>
                    </div>
                    <div className="flex justify-start">
                      <div className="max-w-[70%] rounded-2xl rounded-tl-sm bg-white/8 px-3 py-2">
                        <p className="text-xs text-white/80">Amazing! Thank you so much 🙏</p>
                        <p className="text-[10px] text-white/30 mt-1 text-right">10:42</p>
                      </div>
                    </div>
                    {/* Typing indicator */}
                    <div className="flex justify-start">
                      <div className="rounded-2xl rounded-tl-sm bg-white/8 px-3 py-2.5 flex gap-1 items-center">
                        <span className="w-1.5 h-1.5 rounded-full bg-white/40 animate-bounce [animation-duration:1s]" />
                        <span className="w-1.5 h-1.5 rounded-full bg-white/40 animate-bounce [animation-duration:1s] [animation-delay:0.2s]" />
                        <span className="w-1.5 h-1.5 rounded-full bg-white/40 animate-bounce [animation-duration:1s] [animation-delay:0.4s]" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ─── Features ─────────────────────────────────────────── */}
        <section id="features" className="py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-[#25D366] text-sm font-semibold tracking-widest uppercase mb-3">Platform features</p>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight mb-4">
              Everything a business needs<br className="hidden sm:block" />
              <span className="text-white/40"> on WhatsApp</span>
            </h2>
            <p className="text-white/50 max-w-xl mx-auto">
              One platform that handles messaging, automation, contacts, campaigns, and analytics — without switching tools.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map((f) => {
              const Icon = f.icon
              return (
                <div
                  key={f.title}
                  className="group relative p-6 rounded-2xl border border-white/6 bg-gradient-to-br from-white/4 to-transparent hover:border-white/12 hover:from-white/6 transition-all duration-300"
                >
                  <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${f.color} flex items-center justify-center mb-4`}>
                    <Icon className="w-5 h-5" style={{ color: f.accent }} />
                  </div>
                  <h3 className="font-bold text-base text-white mb-2">{f.title}</h3>
                  <p className="text-sm text-white/50 leading-relaxed">{f.desc}</p>
                </div>
              )
            })}
          </div>
        </section>

        {/* ─── How it works ─────────────────────────────────────── */}
        <section id="how-it-works" className="py-24 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#25D366]/4 to-transparent pointer-events-none" />
          <div className="max-w-7xl mx-auto relative">
            <div className="text-center mb-16">
              <p className="text-[#25D366] text-sm font-semibold tracking-widest uppercase mb-3">How it works</p>
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight mb-4">
                Up and running in{' '}
                <span className="text-[#25D366]">10 minutes</span>
              </h2>
              <p className="text-white/50 max-w-xl mx-auto">
                No complex setup. No developers required. Just connect and start messaging.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
              {/* Connector line */}
              <div className="hidden md:block absolute top-10 left-[calc(16.66%+1rem)] right-[calc(16.66%+1rem)] h-px bg-gradient-to-r from-[#25D366]/0 via-[#25D366]/40 to-[#25D366]/0" />

              {STEPS.map((s) => {
                const Icon = s.icon
                return (
                  <div key={s.n} className="flex flex-col items-center text-center">
                    <div className="relative mb-6">
                      <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#25D366]/20 to-emerald-900/20 border border-[#25D366]/20 flex items-center justify-center">
                        <Icon className="w-8 h-8 text-[#25D366]" />
                      </div>
                      <span className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-[#25D366] text-white text-[10px] font-black flex items-center justify-center">
                        {s.n.slice(-1)}
                      </span>
                    </div>
                    <h3 className="font-bold text-lg text-white mb-2">{s.title}</h3>
                    <p className="text-sm text-white/50 leading-relaxed max-w-xs">{s.desc}</p>
                  </div>
                )
              })}
            </div>
          </div>
        </section>

        {/* ─── Install / PWA ────────────────────────────────────── */}
        <section id="install" className="py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
          <div className="rounded-3xl border border-white/8 bg-gradient-to-br from-[#25D366]/10 via-emerald-900/5 to-[#050c18] p-8 md:p-14 overflow-hidden relative">
            <div className="absolute top-0 right-0 w-[400px] h-[400px] rounded-full bg-[#25D366]/8 blur-[80px] pointer-events-none" />

            <div className="relative grid md:grid-cols-2 gap-12 items-center">
              {/* Text side */}
              <div>
                <p className="text-[#25D366] text-sm font-semibold tracking-widest uppercase mb-3">Install the app</p>
                <h2 className="text-3xl sm:text-4xl font-black tracking-tight mb-4">
                  Always one tap away —{' '}
                  <span className="text-[#25D366]">on every device</span>
                </h2>
                <p className="text-white/55 leading-relaxed mb-8">
                  Install Nexus CRM as a native app on your phone or desktop. No app store needed — just click install and it lands on your home screen or taskbar.
                </p>

                <div className="flex flex-col sm:flex-row gap-3">
                  <InstallButton variant="section" />
                  <Link
                    href="/login"
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium text-sm border border-white/15 text-white/70 hover:text-white hover:border-white/30 transition-colors"
                  >
                    Open in browser
                    <ChevronRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>

              {/* Platform cards */}
              <div className="grid grid-cols-1 gap-4">
                {[
                  {
                    Icon: Monitor,
                    title: 'Desktop (Chrome / Edge)',
                    steps: ['Click the install icon in your address bar', 'Or use the "Install App" button above', 'App appears in your taskbar / dock'],
                  },
                  {
                    Icon: Smartphone,
                    title: 'Android (Chrome)',
                    steps: ['Tap the "Add to Home Screen" banner', 'Or tap ⋮ menu → Install App', 'Icon appears on your home screen'],
                  },
                  {
                    Icon: ({...props}: React.SVGProps<SVGSVGElement>) => (
                      <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
                        <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                      </svg>
                    ),
                    title: 'iPhone / iPad (Safari)',
                    steps: ['Open in Safari (not Chrome)', 'Tap the Share button (□↑)', 'Tap "Add to Home Screen"'],
                  },
                ].map(({ Icon, title, steps }) => (
                  <div key={title} className="flex gap-4 p-4 rounded-xl border border-white/6 bg-white/3">
                    <div className="w-9 h-9 rounded-lg bg-[#25D366]/15 flex items-center justify-center flex-shrink-0">
                      <Icon className="w-4 h-4 text-[#25D366]" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white mb-2">{title}</p>
                      <ol className="space-y-1">
                        {steps.map((s, i) => (
                          <li key={i} className="text-xs text-white/50 flex gap-2">
                            <span className="text-[#25D366] font-bold">{i + 1}.</span>
                            {s}
                          </li>
                        ))}
                      </ol>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ─── Testimonials ─────────────────────────────────────── */}
        <section className="py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-[#25D366] text-sm font-semibold tracking-widest uppercase mb-3">Customer stories</p>
            <h2 className="text-3xl sm:text-4xl font-black tracking-tight">
              Real businesses, real results
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {TESTIMONIALS.map((t) => (
              <div key={t.author} className="p-6 rounded-2xl border border-white/6 bg-gradient-to-br from-white/4 to-transparent flex flex-col gap-4">
                <div className="flex gap-0.5">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 text-amber-400 fill-amber-400" />
                  ))}
                </div>
                <p className="text-sm text-white/70 leading-relaxed flex-1">&ldquo;{t.quote}&rdquo;</p>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#25D366]/30 to-emerald-900/20 flex items-center justify-center text-sm font-bold text-[#25D366]">
                    {t.author[0]}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">{t.author}</p>
                    <p className="text-xs text-white/40">{t.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        

        {/* ─── Final CTA ────────────────────────────────────────── */}
        <section className="py-24 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto text-center">
          <div className="relative">
            <div className="absolute inset-0 -m-8 rounded-3xl bg-[#25D366]/6 blur-3xl pointer-events-none" />
            <div className="relative">
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight mb-4">
                Ready to take your WhatsApp<br className="hidden sm:block" />
                business to the next level?
              </h2>
              <p className="text-white/50 mb-10 max-w-xl mx-auto">
                Join hundreds of businesses already using Nexus CRM to deliver faster support, run smarter campaigns, and close more deals on WhatsApp.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link
                  href="/login"
                  className="group inline-flex items-center gap-2.5 px-8 py-4 rounded-xl font-bold text-base bg-[#25D366] hover:bg-[#1db954] text-white transition-all duration-200 hover:shadow-xl hover:shadow-green-500/30 hover:scale-105 active:scale-95"
                >
                  Start Free Today
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </Link>
                <InstallButton variant="hero" />
              </div>
              <p className="mt-6 text-xs text-white/25">
                No credit card required • Set up in 10 minutes • Cancel anytime
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* ─── Footer ───────────────────────────────────────────── */}
      <footer className="relative z-10 border-t border-white/5 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10">
            {/* Brand */}
            <div className="col-span-2 md:col-span-1">
              <div className="flex items-center gap-2.5 mb-3">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#25D366] to-[#128C7E] flex items-center justify-center">
                  <MessageSquare className="w-3.5 h-3.5 text-white" strokeWidth={2.5} />
                </div>
                <span className="font-bold text-base">Nexus<span className="text-[#25D366]">CRM</span></span>
              </div>
              <p className="text-xs text-white/35 leading-relaxed max-w-[200px]">
                Professional WhatsApp CRM for modern businesses.
              </p>
            </div>

            {/* Product */}
            <div>
              <p className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-4">Product</p>
              <ul className="space-y-2.5">
                {['Features', 'Pricing', 'Changelog', 'Roadmap'].map((l) => (
                  <li key={l}>
                    <a href="#" className="text-sm text-white/40 hover:text-white/70 transition-colors">{l}</a>
                  </li>
                ))}
              </ul>
            </div>

            {/* Resources */}
            <div>
              <p className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-4">Resources</p>
              <ul className="space-y-2.5">
                {['Documentation', 'API Reference', 'Status', 'Blog'].map((l) => (
                  <li key={l}>
                    <a href="#" className="text-sm text-white/40 hover:text-white/70 transition-colors">{l}</a>
                  </li>
                ))}
              </ul>
            </div>

            {/* Company */}
            <div>
              <p className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-4">Company</p>
              <ul className="space-y-2.5">
                {['About', 'Privacy', 'Terms', 'Contact'].map((l) => (
                  <li key={l}>
                    <a href="#" className="text-sm text-white/40 hover:text-white/70 transition-colors">{l}</a>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="border-t border-white/5 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-xs text-white/25">
              © {new Date().getFullYear()} Nexus CRM. Not affiliated with Meta Platforms Inc.
            </p>
            <div className="flex items-center gap-4">
              <Shield className="w-3.5 h-3.5 text-white/20" />
              <span className="text-xs text-white/25">GDPR ready</span>
              <Bell className="w-3.5 h-3.5 text-white/20" />
              <span className="text-xs text-white/25">99.9% uptime SLA</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
