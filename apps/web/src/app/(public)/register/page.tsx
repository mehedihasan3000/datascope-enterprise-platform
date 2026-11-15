'use client';

import { registerSchema, ROLES } from '@datascope/shared';
import {
  ArrowRight,
  Lock,
  Mail,
  ShieldAlert,
  User,
  UserCog,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { useRegisterMutation } from '@/services/authApi';
import { useAppDispatch } from '@/store';
import { addToast } from '@/store/slices/uiPreferencesSlice';

export default function RegisterPage() {
  const router = useRouter();
  const dispatch = useAppDispatch();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'ANALYST' | 'VIEWER'>(ROLES.ANALYST);
  const [formError, setFormError] = useState<string | null>(null);

  const [registerUser, { isLoading }] = useRegisterMutation();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const parsed = registerSchema.safeParse({
      fullName,
      email,
      password,
      role,
    });

    if (!parsed.success) {
      setFormError(parsed.error.issues[0]?.message ?? 'Please check your input fields');
      return;
    }

    try {
      const response = await registerUser(parsed.data).unwrap();
      dispatch(
        addToast({
          variant: 'success',
          title: 'Account created',
          description: `Signed in as ${response.data.user.fullName} (${response.data.user.role})`,
        })
      );
      router.push('/explorer');
      router.refresh();
    } catch (err: unknown) {
      const apiErr = err as { data?: { error?: { message?: string } } };
      setFormError(
        apiErr?.data?.error?.message ||
          'Registration failed. Please verify your information and try again.'
      );
    }
  };

  return (
    <div className="min-h-screen bg-[#070b14] text-slate-100 flex flex-col justify-center px-4 py-12 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-md space-y-6">
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
            Create Your DataScope Account
          </h1>
          <p className="mt-1.5 text-sm text-slate-400">
            Explore 104,000+ indexed enterprise records with role-scoped permissions
          </p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/75 p-6 sm:p-7 shadow-2xl backdrop-blur-md">
          {formError && (
            <div
              role="alert"
              className="mb-4 flex items-start gap-2.5 rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-200"
            >
              <ShieldAlert className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{formError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="fullName"
                className="block text-xs font-medium text-slate-300 mb-1.5"
              >
                Full Name
              </label>
              <div className="relative">
                <User className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <input
                  id="fullName"
                  name="fullName"
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Alex Mercer"
                  className="w-full rounded-lg border border-slate-700 bg-slate-950/90 pl-9 pr-3 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>

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
                  placeholder="alex.mercer@enterprise.io"
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
                  autoComplete="new-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min 8 chars, 1 uppercase, 1 number"
                  className="w-full rounded-lg border border-slate-700 bg-slate-950/90 pl-9 pr-3 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="role"
                className="block text-xs font-medium text-slate-300 mb-1.5"
              >
                Workspace Role
              </label>
              <div className="relative">
                <UserCog className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <select
                  id="role"
                  name="role"
                  value={role}
                  onChange={(e) => setRole(e.target.value as 'ANALYST' | 'VIEWER')}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950/90 pl-9 pr-3 py-2.5 text-sm text-white focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value={ROLES.ANALYST}>
                    Data Analyst (Search, Filter, Save & Share Views)
                  </option>
                  <option value={ROLES.VIEWER}>
                    Viewer (Browse Authorized Datasets & Shared Views)
                  </option>
                </select>
              </div>
              <p className="mt-1.5 text-[11px] text-slate-500">
                Administrator privileges are assigned by existing platform admins.
              </p>
            </div>

            <Button
              type="submit"
              isLoading={isLoading}
              className="w-full"
              size="lg"
            >
              Create Account
              <ArrowRight className="h-4 w-4" />
            </Button>
          </form>
        </div>

        <p className="text-center text-xs text-slate-400">
          Already have an account?{' '}
          <Link
            href="/login"
            className="font-semibold text-indigo-400 hover:text-indigo-300"
          >
            Sign in instead
          </Link>
        </p>
      </div>
    </div>
  );
}
