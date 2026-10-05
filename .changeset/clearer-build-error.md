---
"@cerios/cerios-builder": minor
---

Calling `build()` (or `buildFrozen()`, `buildSealed()`, and the other compile-time-checked variants) before every required property is set now gives a short compile error that names the missing properties:

```text
The 'this' context of type 'InternalBuilderStep<UserBuilder, User, "id">' is not assignable to method's 'this' of type 'MissingRequiredProperties<"name" | "role">'.
```

Previously the error was a four-line chain that printed the builder's full brand type up to three times before reaching the missing names. The build variants now infer the receiver type and check it against the required brand themselves. When the check fails, the `this` type they demand is `MissingRequiredProperties<...>`, which no builder can satisfy, so the error stops there instead of elaborating on the builder type. This applies to the auto builders and to the deprecated `CeriosBuilder` / `CeriosClassBuilder`.

Nothing that compiled before stops compiling. That includes calling `build()` on `this` inside a builder's own method after setting every required property, generic helpers that accept a fully branded builder, overriding `build()` in a subclass, and `ReturnType<UserBuilder["build"]>`. `BuildGate` / `ClassBuildGate` are still exported and still describe the same condition. They are now deprecated in favour of `BuilderWith<YourBuilder>` / `ClassBuilderWith<YourBuilder>`. The new `MissingRequiredProperties` type is exported too.
