---
"@cerios/cerios-builder": minor
---

Clearer messages in the editor and at run time. Nothing that compiled before stops compiling, and every existing error message still starts with the same text.

- **`build()` inside your own builder method now names the required properties.** Calling `this.build()` in a builder method used to show a truncated error (`MissingRequiredProperties<RemovedKeysOf<this> | ... | ... | ...>`). It now reads:

  ```text
  The 'this' context of type 'this' is not assignable to method's 'this' of type 'RequiredPropertiesNotSet<"id" | "name" | "role", this, ...>'.
  ```

  The new `RequiredPropertiesNotSet` type is exported. Its documentation explains why this happens and the three ways to fix it. Errors at a normal call site are unchanged (`MissingRequiredProperties<"name" | "role">`).

- **Readable setter type in hovers and errors.** The type every generated setter returns now shows as `BuilderWithProperty<UserBuilder, User, "id">` ("a `UserBuilder` with `id` set") instead of `InternalBuilderStep<...>`. `ClassBuilderWithProperty` is the class-builder equivalent. Both are exported. `InternalBuilderStep` / `InternalClassBuilderStep` remain exported as deprecated aliases of the same type.

- **Plain-language documentation** on the build methods and on `MissingRequiredProperties`, which is what hovering them in the editor shows.

- **Hints in runtime errors.** "Missing required fields" errors now end with a pointer to `buildUnsafe()` / `buildPartial()` for intentionally incomplete objects. When a validator fails by returning `false`, the message suggests returning an error message string instead. `missingFields` and `validationErrors` are unchanged.

- **README:** a new "Understanding Error Messages" section, and a note that TypeScript 7 (native) does not yet show a property's documentation comment when you hover its setter. TypeScript 6 and earlier do. Ctrl+Click works in both.
