"use client";

import { ErrorBanner } from "@/components/Banner";
import { PrimaryButton, TextInput } from "@/components/FormField";
import { Spinner } from "@/components/Spinner";
import { ApiError } from "@/lib/apiClient";
import { useAuth } from "@/lib/auth-context";
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
      router.replace("/dashboard/branding?onboarding=1");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to register. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-10">
      <div className="w-full max-w-sm rounded-lg border border-gray-200 bg-white p-8 shadow-sm">
        <h1 className="text-xl font-semibold text-gray-900">Register your company</h1>
        <p className="mt-1 text-sm text-gray-500">
          This creates your company account and signs you in as the admin.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
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
          <PrimaryButton type="submit" disabled={submitting} className="w-full">
            {submitting && <Spinner className="h-4 w-4" />}
            Create account
          </PrimaryButton>
        </form>

        <p className="mt-6 text-center text-sm text-gray-500">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-brand-600 hover:text-brand-700">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
