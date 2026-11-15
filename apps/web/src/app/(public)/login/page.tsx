'use client';

import { loginSchema } from '@datascope/shared';
import { ArrowRight, KeyRound, Lock, Mail, ShieldAlert, UserCheck } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { useLoginMutation } from '@/services/authApi';
import { useAppDispatch } from '@/store';
import { addToast } from '@/store/slices/uiPreferencesSlice';

const DEMO_ACCOUNTS = [
  {
    label: 'Administrator',
    email: 'admin@datascope.io',
    password: 'Password123!',
    description: 'Full users, datasets & permission config',
    accent: 'border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-rose-200',
  },
  {
    label: 'Data Analyst',
    email: 'analyst@datascope.io',
    password: 'Password123!',
    description: 'Advanced search, filter builder & saved views',
    accent:
      'border-indigo-500/30 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-200',
  },
  {
    label: 'Viewer',
    email: 'viewer@datascope.io',
    password: 'Password123!',
    description: 'Read-only authorized datasets & shared views',
    accent: 'border-cyan-500/30 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-200',
  },
] as const;

function LoginFormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const dispatch = useAppDispatch();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const [login, { isLoading }] = useLoginMutation();

  const redirectTarget = (() => {
    const raw = searchParams.get('redirect');
    return raw && raw.startsWith('/') && !raw.startsWith('//') ? raw : '/explorer';
  })();

  const executeLogin = async (loginEmail: string, loginPassword: string) => {
    setFormError(null);

    const parsed = loginSchema.safeParse({
      email: loginEmail,
      password: loginPassword,
    });
    if (!parsed.success) {
      setFormError(parsed.error.issues[0]?.message ?? 'Invalid login credentials');
      return;
    }

    try {
      const response = await login(parsed.data).unwrap();
      dispatch(
        addToast({
          variant: 'success',
          title: `Welcome back, ${response.data.user.fullName}`,
          description: `Authenticated as ${response.data.user.role}`,
        })
      );
      router.replace(redirectTarget);
      router.refresh();
    } catch (err: unknown) {
      const apiErr = err as { data?: { error?: { message?: string } } };
      setFormError(
        apiErr?.data?.error?.message ||
          'Authentication failed. Please check your email and password.'
      );
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    void executeLogin(email, password);
  };

  const handleDemoLogin = (demoEmail: string, demoPassword: string) => {
    setEmail(demoEmail);
    setPassword(demoPassword);
    void executeLogin(demoEmail, demoPassword);
  };

  return (
    <div className="min-h-screen bg-[#070b14] text-slate-100 flex flex-col justify-center px-4 py-12 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-md space-y-6">
        {/* Brand */}
        <div className="text-center">
          <Link href="/" className="inline-flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-cyan-500 text-white font-bold shadow-lg shadow-indigo-500/20">
              DS
            </div>
            <span className="text-xl font-bold tracking-tight text-white">
              DataScope
            </span>
          </Link>
          <h1 className="mt-5 text-2xl font-bold tracking-tight text-white">
            Sign in to Enterprise Workspace
          </h1>
          <p className="mt-1.5 text-sm text-slate-400">
            Secured with custom JWT + HttpOnly cookies & dataset-level RBAC
          </p>
        </div>

        {/* Login Card */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/75 p-6 sm:p-7 shadow-2xl backdrop-blur-md space-y-6">
          {formError && (
            <div
              role="alert"
              className="flex items-start gap-2.5 rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-200"
            >
              <ShieldAlert className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{formError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="block text-xs font-medium text-slate-300 mb-1.5"
              >
                Enterprise Email
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="analyst@datascope.io"
                  className="w-full rounded-lg border border-slate-700 bg-slate-950/90 pl-9 pr-3 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-xs font-medium text-slate-300 mb-1.5"
              >
                Password
              </label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-lg border border-slate-700 bg-slate-950/90 pl-9 pr-3 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>

            <Button
              type="submit"
              isLoading={isLoading}
              className="w-full"
              size="lg"
            >
              Sign In
              <ArrowRight className="h-4 w-4" />
            </Button>
          </form>

          {/* 1-Click Demo Role Access */}
          <div className="border-t border-slate-800 pt-5">
            <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
              <KeyRound className="h-3.5 w-3.5 text-indigo-400" />
              1-Click Demo Role Access
            </div>
            <div className="space-y-2">
              {DEMO_ACCOUNTS.map((demo) => (
                <button
                  key={demo.email}
                  type="button"
                  disabled={isLoading}
                  onClick={() => handleDemoLogin(demo.email, demo.password)}
                  className={`w-full flex items-center justify-between rounded-xl border px-3.5 py-2.5 text-left transition-all cursor-pointer disabled:opacity-50 ${demo.accent}`}
                >
                  <div>
                    <div className="flex items-center gap-1.5 text-xs font-semibold">
                      <UserCheck className="h-3.5 w-3.5" />
                      {demo.label}
                    </div>
                    <div className="mt-0.5 text-[11px] opacity-80">
                      {demo.description}
                    </div>
                  </div>
                  <span className="text-[11px] font-mono opacity-75">
                    {demo.email.split('@')[0]}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <p className="text-center text-xs text-slate-400">
          Need a new workspace account?{' '}
          <Link
            href="/register"
            className="font-semibold text-indigo-400 hover:text-indigo-300"
          >
            Register here
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#070b14] flex items-center justify-center text-slate-400 text-sm">
          Loading authentication portal...
        </div>
      }
    >
      <LoginFormContent />
    </Suspense>
  );
}
