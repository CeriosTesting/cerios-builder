---
"@cerios/cerios-builder": patch
---

Deprecate static required-field templates in favor of constructor- and instance-level required field configuration.

- Deprecate `CeriosBuilder.requiredTemplate` and recommend `super(data, requiredFields)` or `setRequiredFields()`.
- Deprecate `CeriosClassBuilder.requiredDataProperties` and recommend constructor-provided required fields or `setRequiredFields()`.
- Add support for passing required fields as a readonly array into `CeriosClassBuilder` constructor (while keeping `Set<string>` compatibility).
- Update `CeriosClassBuilder.clearOptionalProperties()` to use the combined required-field template (static defaults + instance-level fields), so constructor/runtime required fields are now honored.
- Add tests covering constructor-defined required fields for optional-property clearing in both builder variants.
