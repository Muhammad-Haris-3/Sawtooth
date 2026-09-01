# Deploying Sawtooth

The site is a **Next.js static export**. There is no backend, no database and no
serverless function — `npm run build` writes plain HTML, CSS, JS and JSON into
`web/out/`, and any static host will serve it.

**Why no API.** The result is fixed. There is no live register and nothing to
compute at request time; every number the site shows is a precomputed aggregate,
and the largest object is the 1.8 MB facility lookup, fetched only when someone
actually searches. A FastAPI service here would serve static rows and call
itself an architecture.

---

## Deploy on Vercel (recommended: connect the repo)

Connecting the GitHub repository is better than CLI deploys — every push to
`main` redeploys automatically.

1. Go to **[vercel.com/new](https://vercel.com/new)** and import
   `Muhammad-Haris-3/Sawtooth`.
2. **Set Root Directory to `web`.** This is the only setting that matters — the
   Next.js app lives in a subdirectory.
3. Leave everything else at the detected defaults:
   - Framework preset: **Next.js**
   - Build command: `next build`
   - Output directory: (leave blank — Next.js handles `output: "export"`)
4. Deploy.

Free Hobby tier is sufficient. The site is static, so there are no cold starts
and no function invocations.

## Or deploy from the CLI

```bash
npx vercel login
```

then, from the repository root:

```bash
npx vercel --cwd web --prod
```

## Rebuilding the site data

The JSON the site reads is generated from the analysis, not hand-maintained:

```bash
.venv/Scripts/python.exe analysis/export_site_data.py
```

That reads `data/sawtooth.duckdb` and `analysis/model_results.json` and writes
`web/public/data/*.json`. Rebuild the panel first if the DuckDB file is absent —
see the Reproduce section of the [README](README.md).

## Local preview

```bash
npm --prefix web run dev
```

```bash
npm --prefix web run build
```

The build writes `web/out/`. Serve that directory with any static file server to
check the exported site exactly as it will be hosted.
