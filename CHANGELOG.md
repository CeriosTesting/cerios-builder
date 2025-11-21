# @cerios/cerios-builder

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
