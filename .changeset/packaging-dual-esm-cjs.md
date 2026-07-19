---
"@cerios/cerios-builder": patch
---

The published package now ships explicit dual CJS/ESM artifacts with per-condition type declarations. The build tool moved from tsup to tsdown, and the dist filenames changed: `dist/index.js` → `dist/index.cjs`, `dist/index.d.ts` → `dist/index.d.cts`, with `dist/index.d.mts` added alongside `dist/index.mjs`. The `exports` map now declares a `types` condition per branch (`.d.mts` for `import`, `.d.cts` for `require`/`default`), so TypeScript resolves the matching declaration format under every module resolution mode; the layout is validated with `@arethetypeswrong/cli` in CI. Importing the package entry point (`import`/`require` of `@cerios/cerios-builder`) is unaffected — only code deep-importing dist filenames directly would notice.
