---
"@cerios/cerios-builder": minor
---

Add `removeRequiredProperty(key)`, the counterpart of `removeOptionalProperty(key)`, on the auto builders and the deprecated builders. It accepts only required keys (and `removeOptionalProperty` only optional ones), and returns a new builder without that property. The main use is building an invalid object for a negative test:

```typescript
const withoutName = UserBuilder.from(validUser).removeRequiredProperty("name").buildUnsafe();
```

The returned builder can no longer use the compile-time-checked build variants: `build()` reports `MissingRequiredProperties<"name">`. Use `buildUnsafe()` or `buildPartial()` for the incomplete object, while `buildWithoutCompileTimeValidation()` still runs the runtime checks. Setting the property again on that same builder does not lift the restriction, because the compile-time tracking cannot forget a removal. Builders are immutable, so build from the builder you had before the removal instead. The marker type it adds, `RemovedRequiredProperties`, is exported.

`removeRequiredProperty` is now a reserved builder name: a property literally named `removeRequiredProperty` is set with `removeRequiredPropertyProp`, like every other property named after a builder member.
