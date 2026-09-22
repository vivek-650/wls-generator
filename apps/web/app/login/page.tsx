"use client";

import { ErrorBanner } from "@/components/Banner";
import { PrimaryButton, TextInput } from "@/components/FormField";
import { Spinner } from "@/components/Spinner";
import { ApiError } from "@/lib/apiClient";
import { useAuth } from "@/lib/auth-context";
import { motion } from "framer-motion";
import { LogIn, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const user = await login({ email, password });
      router.replace(user.role === "SUPER_ADMIN" ? "/admin" : "/dashboard");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to log in. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-gradient-to-br from-brand-600 via-brand-700 to-slate-900 lg:block">
        <div className="relative flex h-full w-full flex-col justify-between p-12">
          <div className="flex items-center gap-2 text-white">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/15 backdrop-blur">
              <Sparkles className="h-4 w-4" aria-hidden="true" />
            </div>
            <span className="text-sm font-semibold">White Label Resume</span>
          </div>
          <div className="max-w-md text-white">
            <h2 className="text-3xl font-semibold leading-tight">
              Turn resumes into branded PDFs in minutes
            </h2>
            <p className="mt-3 text-sm text-blue-50/90">
              Upload, review, and export — every candidate leaves with your logo, colors, and
              footer, never ours.
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-center bg-white px-4 py-16">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="w-full max-w-sm"
        >
          <div className="flex flex-col items-center text-center lg:items-start lg:text-left">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-600 text-white">
              <LogIn className="h-5 w-5" aria-hidden="true" />
            </div>
            <h1 className="mt-4 text-xl font-semibold text-slate-900">Sign in</h1>
            <p className="mt-1 text-sm text-slate-500">Access your company dashboard.</p>
          </div>

          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            <TextInput
              label="Email"
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <TextInput
              label="Password"
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <ErrorBanner message={error} />
            <PrimaryButton type="submit" disabled={submitting} className="w-full py-2">
              {submitting && <Spinner className="h-4 w-4" />}
              Sign in
            </PrimaryButton>
          </form>

          <p className="mt-6 text-center text-sm text-slate-500 lg:text-left">
            Don&apos;t have an account?{" "}
            <Link href="/register" className="font-medium text-brand-600 hover:text-brand-700">
              Register your company
            </Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
}
