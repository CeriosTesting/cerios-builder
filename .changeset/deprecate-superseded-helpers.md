---
"@cerios/cerios-builder": minor
---

Deprecate the helper types that the auto builders and `BuilderWith` made redundant. They are still exported and still work. Each `@deprecated` tag names its replacement, and MIGRATION.md has a before/after table:

| Deprecated                                 | Replacement                                                             |
| ------------------------------------------ | ----------------------------------------------------------------------- |
| `BuilderStep` / `ClassBuilderStep`         | `BuilderWith<this, "key", YourBuilder>` / `ClassBuilderWith`            |
| `BuilderPreset` / `ClassBuilderPreset`     | `BuilderWith<YourBuilder, "key">` / `ClassBuilderWith`                  |
| `BuilderComposer` / `ClassBuilderComposer` | `BuilderComposerFromFactory` / `ClassBuilderComposerFromFactory`        |
| `BuildGate` / `ClassBuildGate`             | `BuilderWith<YourBuilder>` / `ClassBuilderWith<YourBuilder>`            |
| `RequiredFieldsTemplate`                   | `RequiredFieldsRecord<T>`, or `ReadonlyArray<Path<T>>` for nested paths |

The generated setters used to be declared with `BuilderStep`. They now return the new `InternalBuilderStep` / `InternalClassBuilderStep`, which are exported, so hovers and the too-early `build()` error no longer name a deprecated type:

```text
The 'this' context of type 'InternalBuilderStep<UserBuilder, User, "id">' is not assignable to method's 'this' of type 'MissingRequiredProperties<"name" | "role">'.
```

It is the same type under a new name. You never need to write it yourself: annotate your own methods with `BuilderWith`. Nothing that compiled before stops compiling, and nothing changes at runtime. Only a project whose lint rule reports deprecated APIs will see a warning where it names one of these types.
