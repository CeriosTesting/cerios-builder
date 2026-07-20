---
"@cerios/cerios-builder": patch
---

Fix `BuilderWith<this, K1 | K2>` / `ClassBuilderWith<this, K1 | K2>` failing to compile inside an instance method that chains two or more generated setters off `this`, e.g. `setLabelWithCode(label): ClassBuilderWith<this, "label" | "code"> { return this.label(label).code(...); }`. Chaining setters accumulates the brand as an intersection of single-key brands, but the declared multi-key type computed one merged `Pick` over the whole key union - a shape TypeScript can't always prove assignable to the chained one when `this` is still a polymorphic type parameter, even though the two are equivalent for concrete types. `BuilderWith`/`ClassBuilderWith` now compute the same per-key-intersected brand the chain actually produces.
