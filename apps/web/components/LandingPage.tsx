"use client";

import { CloudShader } from "@/components/ui/cloud-shader";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  ArrowRight,
  Building2,
  Download,
  FileSearch,
  PenSquare,
  ShieldCheck,
  Sparkles,
  UploadCloud,
  UserCog,
} from "lucide-react";

const FEATURES = [
  {
    icon: FileSearch,
    title: "Smart resume parsing",
    description:
      "Upload a candidate's resume and our parser extracts contact details, experience, education, skills, and more — automatically.",
  },
  {
    icon: Building2,
    title: "White-label branded exports",
    description:
      "Every exported PDF carries your company's logo, colors, and footer — candidates only ever see your brand, never ours.",
  },
  {
    icon: UserCog,
    title: "Team & role management",
    description: "Invite teammates, control who can manage branding, and keep every upload scoped to your company.",
  },
  {
    icon: ShieldCheck,
    title: "Company-level admin oversight",
    description: "Platform admins get a clear view across every company on the platform — usage, status, and access, in one place.",
  },
];

const STEPS = [
  {
    icon: UploadCloud,
    title: "Upload",
    description: "Drop in a candidate's resume as a PDF or DOCX file.",
  },
  {
    icon: PenSquare,
    title: "Review & edit",
    description: "Check the parsed details and make any edits before it goes out.",
  },
  {
    icon: Download,
    title: "Export branded PDF",
    description: "Download a polished, white-label resume ready to share.",
  },
];

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0 },
};

const staggerContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};

export function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      <header className="sticky top-0 z-10 border-b border-slate-100 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 lg:px-8">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white">
              <Sparkles className="h-4 w-4" aria-hidden="true" />
            </div>
            <span className="text-sm font-semibold text-slate-900">White Label Resume</span>
          </div>
          <nav className="flex items-center gap-3">
            <Link href="/login" className="text-sm font-medium text-slate-600 hover:text-slate-900">
              Sign in
            </Link>
            <Link
              href="/register"
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
            >
              Get started
            </Link>
          </nav>
        </div>
      </header>

      <main>
        <section className="relative isolate overflow-hidden">
          <CloudShader
            className="absolute inset-0 -z-10 h-full w-full"
            skyTopColor="#1d4ed8"
            skyBottomColor="#8cbfe8"
            cloudColor="#fbf8f2"
          />
          <motion.div
            initial="hidden"
            animate="show"
            variants={staggerContainer}
            className="relative mx-auto max-w-7xl px-6 py-32 text-center sm:py-40 lg:px-8"
          >
            <motion.h1
              variants={fadeUp}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="mx-auto max-w-3xl text-4xl font-semibold tracking-tight text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.35)] sm:text-5xl"
            >
              Turn any resume into a branded, white-label PDF
            </motion.h1>
            <motion.p
              variants={fadeUp}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="mx-auto mt-6 max-w-2xl text-lg text-blue-50/90 drop-shadow-[0_1px_6px_rgba(0,0,0,0.4)]"
            >
              Upload a candidate&apos;s resume, let it parse automatically, review the details, and export a
              polished document carrying your company&apos;s brand — not ours.
            </motion.p>
            <motion.div
              variants={fadeUp}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="mt-10 flex items-center justify-center gap-4"
            >
              <Link
                href="/register"
                className="inline-flex items-center gap-2 rounded-lg bg-white px-6 py-3 text-sm font-medium text-brand-700 hover:bg-blue-50"
              >
                Get started <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <Link
                href="/login"
                className="inline-flex items-center rounded-lg border border-white/30 bg-white/10 px-6 py-3 text-sm font-medium text-white backdrop-blur hover:bg-white/20"
              >
                Sign in
              </Link>
            </motion.div>
          </motion.div>
        </section>

        <section className="mx-auto max-w-7xl px-6 py-20 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-semibold tracking-tight text-slate-900">Everything you need</h2>
            <p className="mt-4 text-base text-slate-600">
              Built for recruiting and staffing teams that present candidates under their own brand.
            </p>
          </div>
          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-80px" }}
            variants={staggerContainer}
            className="mt-16 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4"
          >
            {FEATURES.map((feature) => (
              <motion.div key={feature.title} variants={fadeUp} transition={{ duration: 0.4, ease: "easeOut" }}>
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                  <feature.icon className="h-5 w-5" aria-hidden="true" />
                </div>
                <h3 className="mt-4 text-base font-semibold text-slate-900">{feature.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{feature.description}</p>
              </motion.div>
            ))}
          </motion.div>
        </section>

        <section className="bg-slate-50 py-20">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-semibold tracking-tight text-slate-900">How it works</h2>
              <p className="mt-4 text-base text-slate-600">Get started in three simple steps.</p>
            </div>
            <motion.div
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, margin: "-80px" }}
              variants={staggerContainer}
              className="mt-16 grid grid-cols-1 gap-12 sm:grid-cols-3"
            >
              {STEPS.map((step, i) => (
                <motion.div
                  key={step.title}
                  variants={fadeUp}
                  transition={{ duration: 0.4, ease: "easeOut" }}
                  className="text-center"
                >
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-600 text-white">
                    <step.icon className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <div className="mt-4 text-xs font-medium uppercase tracking-wide text-brand-600">
                    Step {i + 1}
                  </div>
                  <h3 className="mt-1 text-base font-semibold text-slate-900">{step.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">{step.description}</p>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-6 py-24 lg:px-8">
          <div className="relative overflow-hidden rounded-3xl bg-brand-600 px-8 py-16 text-center sm:px-16">
            <div
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_80%_at_80%_0%,rgba(255,255,255,0.15),transparent)]"
              aria-hidden="true"
            />
            <h2 className="relative text-3xl font-semibold text-white">Ready to get started?</h2>
            <p className="relative mx-auto mt-4 max-w-xl text-base text-brand-50">
              Set up your company, add your branding, and start exporting white-label resumes in minutes.
            </p>
            <Link
              href="/register"
              className="relative mt-8 inline-flex items-center gap-2 rounded-lg bg-white px-6 py-3 text-sm font-medium text-brand-700 hover:bg-blue-50"
            >
              Create your account <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-100 py-10">
        <div className="mx-auto max-w-7xl px-6 text-center text-sm text-slate-400 lg:px-8">
          © {new Date().getFullYear()} White Label Resume Generator.
        </div>
      </footer>
    </div>
  );
}
