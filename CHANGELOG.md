# @cerios/cerios-builder

## 1.7.1

### Patch Changes

- 2d2c4b0: Fix `build()` silently dropping values set through a class builder when the target class uses field initializers, e.g. `class ResponseEnvelope { resultSet = new ResultSet(); }` returning a fresh empty `ResultSet` instead of the one passed to `.resultSet(...)`. After `new ctor(data)` the builder decided whether the constructor had consumed the data by looking for any key left `undefined`, then assigned either every key or none. A field initializer leaves nothing `undefined`, so a class that never reads `data` at all looked exactly like one that had already assigned it - and the same all-or-nothing flag overwrote deliberately normalised values whenever one unrelated key happened to be unset. The decision is now made per key: a value the constructor stored verbatim is left alone, a value it derived from the data is kept, and a key still holding its field initializer default is assigned. Classes whose constructor takes no data parameter skip the check entirely, and one whose constructor cannot be called without arguments falls back to assigning rather than dropping the value. Note that the built value remains a deep clone of what was handed to the builder, so it compares equal to it but is not the same object.
- 6fc9486: Fix `BuilderWith<this, K1 | K2>` / `ClassBuilderWith<this, K1 | K2>` failing to compile inside an instance method that chains two or more generated setters off `this`, e.g. `setLabelWithCode(label): ClassBuilderWith<this, "label" | "code"> { return this.label(label).code(...); }`. Chaining setters accumulates the brand as an intersection of single-key brands, but the declared multi-key type computed one merged `Pick` over the whole key union - a shape TypeScript can't always prove assignable to the chained one when `this` is still a polymorphic type parameter, even though the two are equivalent for concrete types. `BuilderWith`/`ClassBuilderWith` now compute the same per-key-intersected brand the chain actually produces.

## 1.7.0

### Minor Changes

- 2536e84: Add `CeriosAutoBuilder<T>()` and `CeriosClassAutoBuilder(Class)` base-class factories that give a subclass an automatic bare-name setter for every property — no more hand-written `setProperty` wrappers. Custom logic stays as ordinary class methods (their return type can be inferred), and mixes freely with the auto setters while keeping the existing compile-time required-property tracking: calling `build()` before all required properties are set is a compiler error. Reserved names (e.g. a `build` property) get a `Prop`-suffixed setter, non-identifier keys are set via bracket access, and the full build-variant/validation/`clone`/`from` API is inherited unchanged.

  Adds nested-builder composition to both auto builders. `BuilderComposerFromFactory` and `ClassBuilderComposerFromFactory` now accept factories from `CeriosAutoBuilder` / `CeriosClassAutoBuilder` subclasses, not just hand-written ones, so a custom method can take a callback, hand it a preconfigured child builder, and store the result — with the callback refusing to compile unless it returns a fully-set child builder of the right type. Previously these types resolved to `never` for auto builders, because an auto builder's declared instance type is structural and is not assignable to the nominal `CeriosBuilder`/`CeriosClassBuilder`.

  Adds `BuilderWith<Builder, Keys>` and `ClassBuilderWith<Builder, Keys>` for writing explicit return types, which matters if your lint rules require them. The built type is derived from the builder, so these take two arguments instead of the three needed by `BuilderStep`/`BuilderPreset`: `static createWithDefaults(): BuilderWith<AddressBuilder, "country">` and `inRotterdam(): BuilderWith<this, "city">`. They work for hand-written builders too. Use `this` (not the class name) in instance methods so previously set keys are preserved, and name root keys only — setting a nested value brands its root property.

  Both factories now expose one identical constructor shape, `new Builder(data, { requiredFields, validators })`. Naming the options removes a trap: the two base builders take those two arguments in opposite positional order, and the class auto builder previously had no supported way to pass either through `super()` at all. `requiredFields` additionally accepts an exhaustive record (`{ id: true, name: true }`) that the compiler forces you to keep complete — the array form is checked for validity but not completeness, so adding a required property to your type would otherwise leave runtime validation silently behind.

  The auto-builder API deliberately exposes **only** the generated root setters: `setProperty`, `setProperties`, `setNestedProperty`, and `addToArrayProperty` are not part of it. Finer-grained updates (nested values, appending to arrays) belong in a distinctly-named custom method that delegates to a root setter, or in a director that composes multiple builders — see the Director pattern section in the README.

  Fixes a class of silent state corruption in both auto builders. The proxy treated any name reachable on the prototype chain as a real member, but only 22 names were declared reserved, so a modelled property named `setProperty`, `createBuilder`, `hasOwnProperty` (and about a dozen others) type-checked as a bare setter and then invoked the real method instead — `builder.createBuilder("x")` replaced the entire builder state with the string `"x"`. All such names now route through the `*Prop` suffix like any other reserved name, and a test walks both prototype chains to fail the build if a member is ever added without being reserved.

  Copy-on-write no longer runs the subclass constructor. Every setter re-creates the builder, which previously meant calling `new this.constructor(...)` with an internal argument shape that a user-written `constructor(data?)` cannot receive — silently dropping validators and required fields on the class side, and reverting `setRequiredFields()` on the object side.

  Also fixes `DataPropertiesOnly` in the class builders so methods **with parameters** are correctly excluded from the compile-time required-property check (previously only zero-argument methods were stripped under `strictFunctionTypes`, which could make a class with a parameterized method impossible to `build()`).

  Copy-on-write carries a subclass's own instance fields across. Because it bypasses the subclass constructor, a field like `private cache = new Map()` was dropped on the first setter call — and since the name was then absent from the proxy target, the proxy handed back an auto-setter _function_ for it, so `this.cache.set(...)` failed with a `TypeError` naming `.set`. Truthiness checks silently took the wrong branch.

  Passing a bare required-fields record positionally — `new B({}, { name: true })` instead of `new B({}, { requiredFields: { name: true } })` — now throws. It structurally matches the options object, so it was previously accepted and silently produced a builder with **zero** required fields, meaning runtime validation passed for every incomplete object.

  `__proto__` is no longer a reserved builder name, so no `__proto__Prop` setter is generated. That setter mapped straight back to the real `__proto__` key; on the class builder the resulting assignment re-parented the built instance, which silently stopped being an instance of its own class and lost every method.

  `CeriosClassAutoBuilder(Person)` returns one memoised runtime class per target class — it previously minted a new class on every call — so `instanceof` holds across separate factory calls. The deprecated `requiredDataProperties` static is no longer part of the returned constructor type — with the runtime class now shared, writing it there would have been visible to every other consumer of that class. Declaring the static on your own subclass is unaffected.

  **Changes affecting existing (non-auto) builders:**

  - `buildFrozen()` and `buildSealed()` no longer freeze and return the builder's own internal state. They returned `this._actual` directly, so two calls yielded the same object, mutating a nested field of the result mutated the builder, and a `buildSealed()` after a `buildFrozen()` came back frozen rather than sealed. The deep variants were already correct.
  - `CeriosClassBuilder` no longer aliases its internal state into the instance it builds. Mutating a built instance's nested object changed the builder, and `buildDeepFrozen()` froze the builder's own state permanently, so every later build from it silently dropped writes.
  - Deep clone preserves prototypes, so a nested class instance stays an instance of its class instead of being flattened to a plain object and losing its methods.
  - `setProperty`, `setProperties`, and `addToArrayProperty` reject `__proto__` as a key. `setNestedProperty` already rejected it inside a path; a plain key was unguarded. `constructor` and `prototype` remain settable as ordinary keys — only path traversal through them is blocked.
  - `CeriosBuilder.from()` returns a branded, immediately buildable builder, matching the auto builders. Seeding from a complete object no longer forces a `buildUnsafe()` fallback. Note it requires the subclass to declare a public constructor.
  - `setNestedProperty` no longer re-clones each intermediate level of the path, which made its cost O(depth x size) on state that was already freshly cloned.

  - Deep clone now preserves `Date`, `Map`, `Set`, and `RegExp` (each previously cloned to `{}`, so a `Date` in seed data was silently destroyed) and handles circular references (which previously threw `RangeError: Maximum call stack size exceeded` from `from()`, `clone()`, and `buildDeepFrozen()`). One implementation replaces five near-identical private copies; `deepFreeze`/`deepSeal` likewise collapse from four copies to one, and are cycle-safe.
  - Build variants no longer hand out the builder's live internal state. `build()` and `buildUnsafe()` returned `this._actual` by reference, so mutating the result mutated the builder and everything built from it afterwards; `buildFrozen()` called `Object.freeze` on the builder's own state. `buildPartial()` is now a deep copy, which is what its documentation already claimed.
  - `setNestedProperty()` rejects paths containing `__proto__`, `constructor`, or `prototype` instead of writing through a prototype and silently swallowing the value.
  - Validation errors are now `CeriosBuilderError`, an `Error` subclass carrying `missingFields` and `validationErrors` arrays so callers can stop string-matching. Existing message text is unchanged apart from the two items below.
  - A validator returning `false` is now identified by index and function name. Three failing validators previously produced `"Validation failed: Validation failed; Validation failed; Validation failed"`, with no way to tell which failed. A validator returning `undefined` — easy to write by forgetting a `return` — was treated as a **pass** and is now an error, as is an empty-string return.
  - The "Please set these fields before calling build." advice now names the variant actually called, so `buildDeepSealed()` no longer points at `build()`.

  - `CeriosClassBuilder.clearOptionalProperties()` now preserves the root object of a nested required path. A required path like `"address.city"` was matched as a single literal key, found nothing, and discarded `address` entirely — destroying the data the call was meant to keep. `CeriosBuilder` already handled this correctly; both now share one implementation.
  - `CeriosBuilder.buildPartial()` returns a copy instead of the live internal state, so callers can no longer mutate a builder through it. This matches `CeriosClassBuilder.buildPartial()`.
  - `CeriosBuilder.setRequiredFields()` is now copy-on-write and returns a new builder rather than mutating and returning `this`. This matches `CeriosClassBuilder.setRequiredFields()` and every other method on both classes. Fluent chains are unaffected; only code holding the pre-call reference and expecting it to have changed will see a difference.

- 2536e84: Add first-class support for base types and base classes to both auto builders.

  Building a derived target already worked — setters are generated from `keyof T`, which includes inherited members, and `CeriosClassAutoBuilder` runs the real constructor chain — and is now covered by tests for inherited data properties, `instanceof` both classes, inherited methods, required fields on inherited properties, `from()`, and compile-time gating.

  What was missing is the deprecated builders' shared base builder (`abstract class BaseXBuilder<T extends Base> extends CeriosBuilder<T>`), whose literal port is illegal TypeScript for a factory-based auto builder. Its replacement is the **base-builder function**: shared custom methods are written once in a function constrained on the new `AutoBuilderBase<TBase>` (`ClassAutoBuilderBase<TBase>` for classes, where TBase may be abstract) and applied on top of each concrete auto builder, returned as the new `BuilderExtension<TBuilder, TShared>` so the derived builder keeps its full setter set, statics, and per-builder required fields. Setter calls inside shared methods brand the derived builder's compile-time build gate like any direct setter call.

  See the README section "Base Types and Shared Builder Logic" and MIGRATION.md section 7 ("Generic base builder classes → base-builder functions").

- 2536e84: **Deprecate `CeriosBuilder` and `CeriosClassBuilder`.** Both hand-written builder base classes are deprecated and will be **removed in the next major version**. Migrate to `CeriosAutoBuilder<T>()` / `CeriosClassAutoBuilder(Class)`, which generate every setter automatically with the same compile-time required-property tracking — see MIGRATION.md for a per-feature before/after guide. The `setNestedProperty` dot-path feature is intentionally not carried over: compose nested objects with a director that coordinates multiple builders (or with nested-builder callbacks via `BuilderComposerFromFactory`) instead.

  **An all-optional type can now `build()` immediately.** The compile-time gate on `build()` and the other validated build variants dissolves when the target type has no required properties, so a builder for an all-optional type no longer needs a throwaway setter call (or a `buildUnsafe()` fallback) before building. This applies to all four builder base classes and is exposed as the `BuildGate` / `ClassBuildGate` types.

- 446bf56: Expose more of the build/state API to shared methods in base-builder functions.

  The `AutoBuilderBase<TBase>` / `ClassAutoBuilderBase<TBase>` views previously exposed only the generated setters and `buildPartial()`, so shared methods could not fork, validate, or build on `this`. The views now also expose every brand-free member whose type is covariant in the base type: `buildUnsafe()`, `buildWithoutCompileTimeValidation()`, `clone()`, and `addValidator()`. The compile-gated build variants still require the derived builder's brand and stay derived-only.

  To make this sound, `clone` and `addValidator` on the public `CommonAutoBuilderApi` are now declared in the same generic-`Self` shape the generated setters use (`clone<Self>(this: Self): Self` instead of `clone(): this`). Call sites behave identically — `Self` infers to the receiver.

  Also documented and locked with tests: a shared method that sets a base-optional property a derived type strengthens to required counts toward the derived build gate **when annotated** with `BuilderWith<this, K>` / `ClassBuilderWith<this, K>` — the annotation re-resolves the brand against the concrete builder's target at the call site. With an inferred return type the brand stays the base-optional flavor and does not satisfy the strengthened gate.

### Patch Changes

- 446bf56: Fix getter-only class accessors breaking the class builders.

  A getter-only accessor (`get displayName() { ... }`) is structurally indistinguishable from a data property, so `CeriosClassAutoBuilder` generated a setter for it and the build step later ran into `TypeError: Cannot set property displayName ... which has only a getter` — a confusing failure far from the misuse. Worse, the compile-time build gate _demanded_ the accessor be set, making such classes unbuildable through `build()`.

  Now:

  - `CeriosClassAutoBuilder` generates setters for **writable public data properties only**. Methods, getter-only accessors, and `readonly` fields get no setter and don't count toward the build gate — a class owns its `readonly` fields through its own constructor, so seed them with `new Builder({ id: "1" })` or `Builder.from(instance)`. This makes setting a getter-only accessor a **compile error**, on top of the runtime guard below. Accessors with both a getter and a setter are writable and get a setter as normal; a derived class that redeclares an inherited getter-only accessor as a getter/setter pair is writable again.
  - A runtime guard throws a `CeriosBuilderError` naming the accessor and the class when a getter-only accessor is written through any path that erases the `readonly` type — untyped/`any` access, `setProperty`/`setProperties`, a `setNestedProperty` root, `addToArrayProperty`, or constructor seed data — replacing the former `TypeError: Cannot set property ... which has only a getter` at build time. This guard also covers the deprecated `CeriosClassBuilder`.
  - `ClassBuildGate` only demands **writable** required data properties, so classes with getter-only accessors or `readonly` fields are buildable through `build()`; enforce a genuinely required `readonly` field with runtime `requiredFields`.
  - The post-construction assignment inside build skips non-writable keys instead of tripping over them.
  - New `WritableKeys<T>` helper type exported.

  Note: `CeriosAutoBuilder` (plain object types) deliberately keeps setters for `readonly` properties — an interface has no constructor, so the builder is the only construction path, and the built object stays `readonly`-typed.

  Also documents and locks with tests the previously unspecified edge cases: symbol-keyed properties are outside the builder's model (no setter, dropped by state snapshots), private/protected class members get no setters, and builder subclass fields are carried by reference across copy-on-write forks.

- 2536e84: The published package now ships explicit dual CJS/ESM artifacts with per-condition type declarations. The build tool moved from tsup to tsdown, and the dist filenames changed: `dist/index.js` → `dist/index.cjs`, `dist/index.d.ts` → `dist/index.d.cts`, with `dist/index.d.mts` added alongside `dist/index.mjs`. The `exports` map now declares a `types` condition per branch (`.d.mts` for `import`, `.d.cts` for `require`/`default`), so TypeScript resolves the matching declaration format under every module resolution mode; the layout is validated with `@arethetypeswrong/cli` in CI. Importing the package entry point (`import`/`require` of `@cerios/cerios-builder`) is unaffected — only code deep-importing dist filenames directly would notice.

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
