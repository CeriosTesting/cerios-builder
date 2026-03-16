---
"@cerios/cerios-builder": patch
---

Improve type ergonomics for shared generic builder base classes and reduce deprecated-brand usage internally.

- Improve `CeriosClassBuilder` type inference for fluent methods in generic base builders so key suggestions and chaining work more reliably without repetitive casts.
- Expand `ClassBuilderStep` key support while continuing to track data-only fields in the branded type state.
- Introduce internal non-deprecated branding (`InternalClassBrand`, `InternalBuilderBrand`) and switch internal type plumbing to use these aliases.
- Keep `CeriosBrand` and `CeriosClassBrand` exported as backward-compatible deprecated aliases.
- Add coverage and README examples for shared POST/PATCH builder patterns across both object and class builders.
