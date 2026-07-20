---
"@cerios/cerios-builder": patch
---

Fix getter-only class accessors breaking the class builders.

A getter-only accessor (`get displayName() { ... }`) is structurally indistinguishable from a data property, so `CeriosClassAutoBuilder` generated a setter for it and the build step later ran into `TypeError: Cannot set property displayName ... which has only a getter` — a confusing failure far from the misuse. Worse, the compile-time build gate _demanded_ the accessor be set, making such classes unbuildable through `build()`.

Now:

- `CeriosClassAutoBuilder` generates setters for **writable public data properties only**. Methods, getter-only accessors, and `readonly` fields get no setter and don't count toward the build gate — a class owns its `readonly` fields through its own constructor, so seed them with `new Builder({ id: "1" })` or `Builder.from(instance)`. This makes setting a getter-only accessor a **compile error**, on top of the runtime guard below. Accessors with both a getter and a setter are writable and get a setter as normal; a derived class that redeclares an inherited getter-only accessor as a getter/setter pair is writable again.
- A runtime guard throws a `CeriosBuilderError` naming the accessor and the class when a getter-only accessor is written through any path that erases the `readonly` type — untyped/`any` access, `setProperty`/`setProperties`, a `setNestedProperty` root, `addToArrayProperty`, or constructor seed data — replacing the former `TypeError: Cannot set property ... which has only a getter` at build time. This guard also covers the deprecated `CeriosClassBuilder`.
- `ClassBuildGate` only demands **writable** required data properties, so classes with getter-only accessors or `readonly` fields are buildable through `build()`; enforce a genuinely required `readonly` field with runtime `requiredFields`.
- The post-construction assignment inside build skips non-writable keys instead of tripping over them.
- New `WritableKeys<T>` helper type exported.

Note: `CeriosAutoBuilder` (plain object types) deliberately keeps setters for `readonly` properties — an interface has no constructor, so the builder is the only construction path, and the built object stays `readonly`-typed.

Also documents and locks with tests the previously unspecified edge cases: symbol-keyed properties are outside the builder's model (no setter, dropped by state snapshots), private/protected class members get no setters, and builder subclass fields are carried by reference across copy-on-write forks.
