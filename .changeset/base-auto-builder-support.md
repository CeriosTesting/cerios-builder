---
"@cerios/cerios-builder": minor
---

Add first-class support for base types and base classes to both auto builders.

Building a derived target already worked — setters are generated from `keyof T`, which includes inherited members, and `CeriosClassAutoBuilder` runs the real constructor chain — and is now covered by tests for inherited data properties, `instanceof` both classes, inherited methods, required fields on inherited properties, `from()`, and compile-time gating.

What was missing is the deprecated builders' shared base builder (`abstract class BaseXBuilder<T extends Base> extends CeriosBuilder<T>`), whose literal port is illegal TypeScript for a factory-based auto builder. Its replacement is the **base-builder function**: shared custom methods are written once in a function constrained on the new `AutoBuilderBase<TBase>` (`ClassAutoBuilderBase<TBase>` for classes, where TBase may be abstract) and applied on top of each concrete auto builder, returned as the new `BuilderExtension<TBuilder, TShared>` so the derived builder keeps its full setter set, statics, and per-builder required fields. Setter calls inside shared methods brand the derived builder's compile-time build gate like any direct setter call.

See the README section "Base Types and Shared Builder Logic" and MIGRATION.md section 7 ("Generic base builder classes → base-builder functions").
