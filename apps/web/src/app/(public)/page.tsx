'use client';

import {
  ArrowRight,
  BarChart3,
  Database,
  Filter,
  Layers,
  Lock,
  Search,
  Sparkles,
  Zap,
} from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui/Badge';
import { useAppSelector } from '@/store';

const PLATFORM_CAPABILITIES = [
  {
    icon: Search,
    title: 'Hybrid PostgreSQL Search',
    description:
      'Combines GIN tsvector Full-Text Search, pg_trgm trigram substring matching, and exact B-Tree lookups across 104,000+ indexed enterprise records (built for 10M+ scale).',
  },
  {
    icon: Filter,
    title: 'Multi-Condition Filter AST',
    description:
      'Compose nested AND/OR clauses across structured columns and dynamic JSONB attributes with URL-synchronized bookmarkable state.',
  },
  {
    icon: Zap,
    title: 'RTK Query + Virtualized Grid',
    description:
      'Automatic request deduplication, tag-based cache invalidation, and 60fps row virtualization via TanStack Table & Virtual.',
  },
  {
    icon: Lock,
    title: 'Zero-Trust Dataset RBAC',
    description:
      'Server-enforced Role-Based Access Control (Admin, Analyst, Viewer) plus per-dataset permission gates via HttpOnly JWT cookies.',
  },
  {
    icon: Layers,
    title: 'Saved Views & Audit History',
    description:
      'Persist column layouts, sort stacks, and filter presets; share curated intelligence views securely with authorized team roles.',
  },
  {
    icon: BarChart3,
    title: 'SQL Aggregation Analytics',
    description:
      'Interactive Recharts visualizations driven by pure PostgreSQL GROUP BY & window queries—never downloading full datasets to the client.',
  },
];

const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#070b14]';

const PREVIEW_ROWS = [
  {
    code: 'ENT-001042',
    title: 'Quantum BioLabs GmbH',
    category: 'Healthcare & BioTech',
    country: 'Germany',
    revenue: '$48.2M',
    status: 'Active',
  },
  {
    code: 'ENT-002918',
    title: 'Apex Autonomous Robotics Ltd',
    category: 'Advanced Manufacturing',
    country: 'United States',
    revenue: '$62.5M',
    status: 'Active',
  },
  {
    code: 'ENT-004511',
    title: 'Nordic Cloud Infrastructure AS',
    category: 'AI & Cloud Infrastructure',
    country: 'Norway',
    revenue: '$31.8M',
    status: 'Pending',
  },
];

export default function LandingPage() {
  const { isAuthenticated, user } = useAppSelector((s) => s.auth);

  return (
    <div className="min-h-screen bg-[#070b14] text-slate-100 flex flex-col">
      {/* Subtle Top Grid Glow */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 h-96 w-[760px] rounded-full bg-indigo-600/15 blur-[120px]" />
        <div className="absolute top-64 right-0 h-72 w-72 rounded-full bg-cyan-500/10 blur-[100px]" />
      </div>

      {/* Navigation */}
      <header className="relative z-10 border-b border-slate-800/80 bg-[#070b14]/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className={`flex items-center gap-3 rounded-lg ${FOCUS_RING}`}
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-cyan-500 font-bold text-white shadow-lg shadow-indigo-500/20">
                DS
              </div>
              <span className="text-base font-bold tracking-tight text-white">
                DataScope
              </span>
            </Link>
            <span className="hidden sm:inline-block rounded border border-indigo-500/30 bg-indigo-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-indigo-300">
              Enterprise v1.0
            </span>
          </div>

          <div className="flex items-center gap-3">
            {isAuthenticated && user ? (
              <Link
                href="/explorer"
                className={`inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 transition-colors ${FOCUS_RING}`}
              >
                Open Data Explorer
                <ArrowRight className="h-4 w-4" />
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className={`rounded-lg px-3.5 py-2 text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800/70 transition-colors ${FOCUS_RING}`}
                >
                  Sign In
                </Link>
                <Link
                  href="/register"
                  className={`inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 transition-colors shadow-sm shadow-indigo-950/40 ${FOCUS_RING}`}
                >
                  Get Started
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="relative z-10 flex-1">
        <section className="mx-auto max-w-7xl px-4 pt-14 pb-16 sm:px-6 lg:px-8 lg:pt-20">
          <div className="mx-auto max-w-3xl text-center">
            <Badge variant="indigo" className="mb-5 px-3 py-1 text-xs">
              <Sparkles className="h-3.5 w-3.5" />
              104,000+ Indexed PostgreSQL Records · Sub-50ms Query Engine
            </Badge>

            <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl lg:text-6xl leading-[1.1]">
              Enterprise Data Discovery at{' '}
              <span className="bg-gradient-to-r from-indigo-400 via-cyan-300 to-indigo-400 bg-clip-text text-transparent">
                Million-Row Scale
              </span>
            </h1>

            <p className="mt-6 text-base sm:text-lg text-slate-400 leading-relaxed">
              DataScope empowers analysts and enterprise teams to search, filter,
              sort, audit, and visualize massive business datasets through a
              high-throughput PostgreSQL + Drizzle engine and RTK Query workspace.
            </p>

            <div className="mt-9 flex flex-wrap items-center justify-center gap-3 sm:gap-4">
              <Link
                href={isAuthenticated ? '/explorer' : '/login'}
                className={`w-full sm:w-auto justify-center inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white hover:bg-indigo-500 transition-all shadow-lg shadow-indigo-600/25 ${FOCUS_RING}`}
              >
                {isAuthenticated ? 'Launch Data Explorer' : 'Sign In to Workspace'}
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/register"
                className={`w-full sm:w-auto justify-center inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900/70 px-6 py-3 text-sm font-semibold text-slate-200 hover:bg-slate-800 transition-colors ${FOCUS_RING}`}
              >
                <Database className="h-4 w-4 text-cyan-400" />
                Create Analyst Account
              </Link>
            </div>
          </div>

          {/* Platform Architecture Highlights */}
          <div className="mt-14 grid grid-cols-2 gap-3 sm:grid-cols-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-4 backdrop-blur-sm">
            <div className="rounded-xl bg-slate-950/60 p-4 border border-slate-800/70">
              <div className="text-xs text-slate-400">Seeded Dataset Scale</div>
              <div className="mt-1 text-xl sm:text-2xl font-bold text-white tabular-nums">
                104,000+
              </div>
              <div className="mt-1 text-[11px] text-emerald-400">
                Composite + GIN Ready
              </div>
            </div>
            <div className="rounded-xl bg-slate-950/60 p-4 border border-slate-800/70">
              <div className="text-xs text-slate-400">Search Engines</div>
              <div className="mt-1 text-xl sm:text-2xl font-bold text-white">
                FTS + Trigram
              </div>
              <div className="mt-1 text-[11px] text-cyan-400">
                tsvector & pg_trgm
              </div>
            </div>
            <div className="rounded-xl bg-slate-950/60 p-4 border border-slate-800/70">
              <div className="text-xs text-slate-400">Pagination Modes</div>
              <div className="mt-1 text-xl sm:text-2xl font-bold text-white">
                Hybrid
              </div>
              <div className="mt-1 text-[11px] text-indigo-400">
                Offset & Keyset Cursor
              </div>
            </div>
            <div className="rounded-xl bg-slate-950/60 p-4 border border-slate-800/70">
              <div className="text-xs text-slate-400">Access Governance</div>
              <div className="mt-1 text-xl sm:text-2xl font-bold text-white">
                3-Tier RBAC
              </div>
              <div className="mt-1 text-[11px] text-amber-400">
                HttpOnly JWT + Dataset ACL
              </div>
            </div>
          </div>

          {/* Explorer Workspace Preview Frame */}
          <div className="mt-10 rounded-2xl border border-slate-800 bg-slate-900/70 shadow-2xl overflow-hidden backdrop-blur-sm">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 bg-slate-950/80 px-4 py-3">
              <div className="flex items-center gap-2.5">
                <div className="flex items-center gap-1.5" aria-hidden="true">
                  <span className="h-2.5 w-2.5 rounded-full bg-rose-500/70" />
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-500/70" />
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/70" />
                </div>
                <span className="text-xs font-semibold text-slate-200">
                  Data Explorer · Global Enterprise Intelligence (100,000 rows)
                </span>
              </div>
              <div className="flex items-center gap-2 text-[11px]">
                <span className="rounded-md bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 font-medium text-emerald-300 tabular-nums">
                  14ms · GIN Index Scan
                </span>
                <span className="rounded-md bg-indigo-500/15 border border-indigo-500/30 px-2 py-0.5 font-medium text-indigo-300">
                  Virtualized Grid
                </span>
              </div>
            </div>

            <div className="p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-800 bg-slate-950/70 px-3.5 py-2.5">
                <div className="flex items-center gap-2 text-xs text-slate-300 min-w-0">
                  <Search className="h-3.5 w-3.5 text-indigo-400 shrink-0" />
                  <span className="font-mono truncate">
                    &quot;Quantum&quot; AND status = &apos;Active&apos; AND revenue &gt;= $10,000,000
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                  <span className="rounded bg-slate-800 px-2 py-0.5 text-slate-300">
                    FTS Mode
                  </span>
                  <span className="rounded bg-slate-800 px-2 py-0.5 text-slate-300">
                    Sort: Revenue DESC
                  </span>
                </div>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/60">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-800 bg-slate-900/90 text-[11px] uppercase tracking-wider text-slate-400">
                    <tr>
                      <th className="px-3.5 py-2">Record Code</th>
                      <th className="px-3.5 py-2">Entity Name</th>
                      <th className="px-3.5 py-2">Category</th>
                      <th className="px-3.5 py-2">Country</th>
                      <th className="px-3.5 py-2 text-right">Revenue</th>
                      <th className="px-3.5 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80">
                    {PREVIEW_ROWS.map((row) => (
                      <tr key={row.code} className="text-slate-200">
                        <td className="px-3.5 py-2.5 font-mono text-indigo-300 whitespace-nowrap">
                          {row.code}
                        </td>
                        <td className="px-3.5 py-2.5 font-medium whitespace-nowrap">
                          {row.title}
                        </td>
                        <td className="px-3.5 py-2.5 text-slate-300 whitespace-nowrap">
                          {row.category}
                        </td>
                        <td className="px-3.5 py-2.5 text-slate-300 whitespace-nowrap">
                          {row.country}
                        </td>
                        <td className="px-3.5 py-2.5 text-right tabular-nums font-semibold text-emerald-300 whitespace-nowrap">
                          {row.revenue}
                        </td>
                        <td className="px-3.5 py-2.5 whitespace-nowrap">
                          <span
                            className={
                              row.status === 'Active'
                                ? 'rounded bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 text-[11px] font-medium text-emerald-300'
                                : 'rounded bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 text-[11px] font-medium text-amber-300'
                            }
                          >
                            {row.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Feature Grid */}
          <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {PLATFORM_CAPABILITIES.map((cap) => {
              const Icon = cap.icon;
              return (
                <div
                  key={cap.title}
                  className="rounded-2xl border border-slate-800/90 bg-slate-900/45 p-6"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/15 text-indigo-400 border border-indigo-500/20">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h2 className="mt-4 text-base font-semibold text-white">
                    {cap.title}
                  </h2>
                  <p className="mt-2 text-sm text-slate-400 leading-relaxed">
                    {cap.description}
                  </p>
                </div>
              );
            })}
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-slate-800/80 px-4 py-6 text-center text-xs text-slate-400">
        DataScope Enterprise Data Discovery & Intelligence Platform · Next.js App
        Router · Redux Toolkit · Express.js · Cloud PostgreSQL
      </footer>
    </div>
  );
}
