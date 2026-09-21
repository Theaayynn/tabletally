"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LogIn, ChefHat } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input, Label, FieldGroup } from "@/components/ui/Input";
import { api, ApiError } from "@/lib/api-client";

interface LoginResponse {
  user: { role: "ADMIN" | "EXECUTIVE" };
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { user } = await api.post<LoginResponse>("/api/auth/login", { email, password });
      const next = searchParams.get("next");
      router.push(next || (user.role === "ADMIN" ? "/admin" : "/executive"));
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-600 text-white shadow-pop">
            <ChefHat className="h-6 w-6" />
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-ink-900">TableTally</h1>
          <p className="mt-1 text-sm text-ink-500">Sign in to manage your outlets</p>
        </div>

        <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-card">
          <form onSubmit={onSubmit}>
            <FieldGroup>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@restaurant.com"
              />
            </FieldGroup>
            <FieldGroup className="mb-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </FieldGroup>

            {error && <p className="mb-3 text-sm font-medium text-rose-600">{error}</p>}

            <Button type="submit" className="w-full" loading={loading}>
              <LogIn className="h-4 w-4" />
              Sign in
            </Button>
          </form>
        </div>

        <div className="mt-5 rounded-2xl border border-dashed border-slate-200 bg-white/60 p-4 text-xs text-ink-500">
          <p className="mb-1.5 font-semibold text-ink-700">Seeded demo accounts</p>
          <p>Admin — admin@tabletally.test / Admin@12345</p>
          <p>Executive — priya@tabletally.test / Exec@12345</p>
        </div>
      </div>
    </div>
  );
}
