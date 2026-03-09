---
"@cerios/cerios-builder": minor
---

Add custom validation and optional-property management capabilities to both `CeriosBuilder` and `CeriosClassBuilder`.

- Add `addValidator()` support with validator execution on validated build paths and custom error messages.
- Add optional property utilities: `removeOptionalProperty()` and `clearOptionalProperties()`.
- Add/improve cloning and object-instance factory flows (`clone()` / `from(...)`) with immutability-focused behavior.
- Export additional public types (`ClassPath`, `OptionalKeys`) for stronger typing in class/nested path use cases.
- Expand documentation and test coverage for validators, property removal, cloning, nested properties, and class-builder array operations.
