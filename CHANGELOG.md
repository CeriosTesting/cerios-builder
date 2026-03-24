# @cerios/cerios-builder

## 1.6.0

### Minor Changes

- b2d8ebd: Add custom validation and optional-property management capabilities to both `CeriosBuilder` and `CeriosClassBuilder`.
  - Add `addValidator()` support with validator execution on validated build paths and custom error messages.
  - Add optional property utilities: `removeOptionalProperty()` and `clearOptionalProperties()`.
  - Add/improve cloning and object-instance factory flows (`clone()` / `from(...)`) with immutability-focused behavior.
  - Export additional public types (`ClassPath`, `OptionalKeys`) for stronger typing in class/nested path use cases.
  - Expand documentation and test coverage for validators, property removal, cloning, nested properties, and class-builder array operations.

### Patch Changes

- 7cc1e85: Deprecate static required-field templates in favor of constructor- and instance-level required field configuration.
  - Deprecate `CeriosBuilder.requiredTemplate` and recommend `super(data, requiredFields)` or `setRequiredFields()`.
  - Deprecate `CeriosClassBuilder.requiredDataProperties` and recommend constructor-provided required fields or `setRequiredFields()`.
  - Add support for passing required fields as a readonly array into `CeriosClassBuilder` constructor (while keeping `Set<string>` compatibility).
  - Update `CeriosClassBuilder.clearOptionalProperties()` to use the combined required-field template (static defaults + instance-level fields), so constructor/runtime required fields are now honored.
  - Add tests covering constructor-defined required fields for optional-property clearing in both builder variants.

- 7cc1e85: Improve fluent method return typing ergonomics for both object and class builders.
  - Add and use a unified `BuilderStep` helper for `CeriosBuilder` custom methods, including nested path setters.
  - Add and export `BuilderPreset`, `BuilderComposer`, and `BuilderComposerFromFactory` for cleaner object-builder factory/callback typing.
  - Add and export `ClassBuilderStep` for `CeriosClassBuilder` custom methods with support for direct keys and nested paths.
  - Add and export `ClassBuilderPreset`, `ClassBuilderComposer`, and `ClassBuilderComposerFromFactory` for cleaner class-builder factory/callback typing.
  - Align internal builder method return types with the new helper types for consistency.
  - Deprecate direct consumer usage of `CeriosBrand` and `CeriosClassBrand` (kept exported for backward compatibility).
  - Deprecate direct consumer usage of `BuilderType` (kept exported for backward compatibility).
  - Update README examples to document modern helper-based typing patterns for both builder styles.

- cb8b70b: Improve type ergonomics for shared generic builder base classes and reduce deprecated-brand usage internally.
  - Improve `CeriosClassBuilder` type inference for fluent methods in generic base builders so key suggestions and chaining work more reliably without repetitive casts.
  - Expand `ClassBuilderStep` key support while continuing to track data-only fields in the branded type state.
  - Introduce internal non-deprecated branding (`InternalClassBrand`, `InternalBuilderBrand`) and switch internal type plumbing to use these aliases.
  - Keep `CeriosBrand` and `CeriosClassBrand` exported as backward-compatible deprecated aliases.
  - Add coverage and README examples for shared POST/PATCH builder patterns across both object and class builders.

## 1.5.0

### Minor Changes

- 33431d9: introduces a new experimental builder for TypeScript classes, refactors some core types for better modularity, and improves the organization of test files. The most significant change is the addition of CeriosClassBuilder, enabling type-safe, fluent building of actual class instances (not just plain objects), with support for decorators, methods, and prototype chains. Additionally, the codebase now separates utility types into their own module, and test files are reorganized for clarity and maintainability.

## 1.4.1

### Patch Changes

- 845e5a7: extra helper BuilderType for simplified builder type extraction

## 1.4.0

### Minor Changes

- d6735eb: added building immutable objects

## 1.3.0

### Minor Changes

- e132d60: build() now does runtime and compile time validation. So is now the same as buildSafe which is deprecated now. Also added new build methods to have more control.

## 1.2.1

### Patch Changes

- 68e726e: Bugfix for couldn't set nested optional properties

## 1.2.0

### Minor Changes

- 7aaa781: Added support for runtime deeply nested properties validation. Typescript performance updates

## 1.1.0

### Minor Changes

- 28915ff: Added new functionality to add multiple props at once, ability to add an item to an array property and added examples to the readme for defaults behaviour
