---
"@cerios/cerios-builder": minor
---

**Deprecate `CeriosBuilder` and `CeriosClassBuilder`.** Both hand-written builder base classes are deprecated and will be **removed in the next major version**. Migrate to `CeriosAutoBuilder<T>()` / `CeriosClassAutoBuilder(Class)`, which generate every setter automatically with the same compile-time required-property tracking — see MIGRATION.md for a per-feature before/after guide. The `setNestedProperty` dot-path feature is intentionally not carried over: compose nested objects with a director that coordinates multiple builders (or with nested-builder callbacks via `BuilderComposerFromFactory`) instead.

**An all-optional type can now `build()` immediately.** The compile-time gate on `build()` and the other validated build variants dissolves when the target type has no required properties, so a builder for an all-optional type no longer needs a throwaway setter call (or a `buildUnsafe()` fallback) before building. This applies to all four builder base classes and is exposed as the `BuildGate` / `ClassBuildGate` types.
