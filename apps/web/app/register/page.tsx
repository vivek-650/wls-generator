"use client";

import { ErrorBanner } from "@/components/Banner";
import { PrimaryButton, TextInput } from "@/components/FormField";
import { Spinner } from "@/components/Spinner";
import { ApiError } from "@/lib/apiClient";
import { useAuth } from "@/lib/auth-context";
import { motion } from "framer-motion";
import { Building2, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

export default function RegisterPage() {
  const { register } = useAuth();
  const router = useRouter();
  const [companyName, setCompanyName] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await register({ companyName, name, email, password });
      router.replace("/dashboard/settings/branding?onboarding=1");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to register. Please try again.");
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
              Set up your workspace in under a minute
            </h2>
            <p className="mt-3 text-sm text-blue-50/90">
              Add your branding once — every candidate resume you export carries it
              automatically from then on.
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
              <Building2 className="h-5 w-5" aria-hidden="true" />
            </div>
            <h1 className="mt-4 text-xl font-semibold text-slate-900">Register your company</h1>
            <p className="mt-1 text-sm text-slate-500">
              This creates your company account and signs you in as the admin.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            <TextInput
              label="Company name"
              id="companyName"
              required
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
            />
            <TextInput
              label="Your name"
              id="name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
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
              autoComplete="new-password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <ErrorBanner message={error} />
            <PrimaryButton type="submit" disabled={submitting} className="w-full py-2">
              {submitting && <Spinner className="h-4 w-4" />}
              Create account
            </PrimaryButton>
          </form>

          <p className="mt-6 text-center text-sm text-slate-500 lg:text-left">
            Already have an account?{" "}
            <Link href="/login" className="font-medium text-brand-600 hover:text-brand-700">
              Sign in
            </Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
}
