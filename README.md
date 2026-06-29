# PayCompare

A directory, comparison, and review platform for payment processors / gateways.
Built with Next.js (App Router), TypeScript, Tailwind CSS, shadcn/ui, and MongoDB.

> Source of truth: [`../_ai_context/PRD_Payment.md`](../_ai_context/PRD_Payment.md) (what) +
> [`../_ai_context/DESIGN_Payment.md`](../_ai_context/DESIGN_Payment.md) (how it looks).
> Build plan & checklist: [`../_ai_context/TODO.md`](../_ai_context/TODO.md).

## Getting started

```bash
npm install
cp .env.example .env.local   # then fill in real values
npm run dev                  # http://localhost:3000
```

You need a MongoDB connection string in `MONGODB_URI` for DB-backed features. The
app boots and renders the design system without a database; pages that query data
arrive in later milestones.

## Scripts

| Command            | Purpose                                  |
| ------------------ | ---------------------------------------- |
| `npm run dev`      | Start the dev server                     |
| `npm run build`    | Production build                         |
| `npm run start`    | Serve the production build               |
| `npm run lint`     | ESLint (`next/core-web-vitals`)          |
| `npm run typecheck`| `tsc --noEmit` (strict)                  |
| `npm run seed:admin` | Seed the first admin (Stage 1)         |
| `npm run seed`     | Seed sample data (Stage 6)               |

## Project layout

```
app/
  (public)/        public, SSR/SSG pages (Navbar + Footer shell)
  admin/           auth-gated admin SPA (Stage 1+)
  api/             Route Handlers (Stage 1+)
  layout.tsx       root layout — Inter font, tokens, Toaster
  globals.css      Mono Minimal design tokens (DESIGN §10.1)
components/
  public/          Navbar, Footer, ProcessorCard, ...
  admin/           AdminShell, DataTable, ...
  ui/              shadcn/ui primitives
lib/               db, utils, validators, auth, upload, seo, ratings
models/            Mongoose models (Stage 1)
scripts/           seed scripts
```

## Design system

Mono Minimal — monochrome **ink** + one **violet** accent + **amber** stars only.
Tokens live in `app/globals.css`; Tailwind theme in `tailwind.config.ts`. See
[`DESIGN_Payment.md`](../_ai_context/DESIGN_Payment.md). Deviations are logged in
[`NOTES.md`](./NOTES.md).
