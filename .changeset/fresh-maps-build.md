---
"@cerios/cerios-builder": patch
---

Improve fluent method return typing ergonomics for both object and class builders.

- Add and use a unified `BuilderStep` helper for `CeriosBuilder` custom methods, including nested path setters.
- Add and export `BuilderPreset`, `BuilderComposer`, and `BuilderComposerFromFactory` for cleaner object-builder factory/callback typing.
- Add and export `ClassBuilderStep` for `CeriosClassBuilder` custom methods with support for direct keys and nested paths.
- Add and export `ClassBuilderPreset`, `ClassBuilderComposer`, and `ClassBuilderComposerFromFactory` for cleaner class-builder factory/callback typing.
- Align internal builder method return types with the new helper types for consistency.
- Deprecate direct consumer usage of `CeriosBrand` and `CeriosClassBrand` (kept exported for backward compatibility).
- Deprecate direct consumer usage of `BuilderType` (kept exported for backward compatibility).
- Update README examples to document modern helper-based typing patterns for both builder styles.
