---
"@cerios/cerios-builder": minor
---

Expose more of the build/state API to shared methods in base-builder functions.

The `AutoBuilderBase<TBase>` / `ClassAutoBuilderBase<TBase>` views previously exposed only the generated setters and `buildPartial()`, so shared methods could not fork, validate, or build on `this`. The views now also expose every brand-free member whose type is covariant in the base type: `buildUnsafe()`, `buildWithoutCompileTimeValidation()`, `clone()`, and `addValidator()`. The compile-gated build variants still require the derived builder's brand and stay derived-only.

To make this sound, `clone` and `addValidator` on the public `CommonAutoBuilderApi` are now declared in the same generic-`Self` shape the generated setters use (`clone<Self>(this: Self): Self` instead of `clone(): this`). Call sites behave identically — `Self` infers to the receiver.

Also documented and locked with tests: a shared method that sets a base-optional property a derived type strengthens to required counts toward the derived build gate **when annotated** with `BuilderWith<this, K>` / `ClassBuilderWith<this, K>` — the annotation re-resolves the brand against the concrete builder's target at the call site. With an inferred return type the brand stays the base-optional flavor and does not satisfy the strengthened gate.
