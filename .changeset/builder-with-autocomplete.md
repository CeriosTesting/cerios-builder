---
"@cerios/cerios-builder": minor
---

`BuilderWith` and `ClassBuilderWith` take an optional third type argument, the builder class, so property names autocomplete in instance methods:

```typescript
inRotterdam(): BuilderWith<this, "city", AddressBuilder> {
	return this.city("Rotterdam");
}
```

`this` keeps everything set earlier in the chain. The builder class is where the property names are looked up, and is the class `this` must extend. `BuilderWith<this, "city">` describes exactly the same type and keeps working, but editors cannot list property names for the generic `this`, so it offers no suggestions inside the quotes. An existing two-argument method only needs the class appended. The third argument defaults to the first, so existing uses are unaffected.

Inside a string literal, VS Code only suggests on the opening quote or Ctrl+Space by default. Set `"editor.quickSuggestions": { "strings": "on" }` to get suggestions while typing.
