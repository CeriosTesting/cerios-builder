---
"@cerios/cerios-builder": minor
---

introduces a new experimental builder for TypeScript classes, refactors some core types for better modularity, and improves the organization of test files. The most significant change is the addition of CeriosClassBuilder, enabling type-safe, fluent building of actual class instances (not just plain objects), with support for decorators, methods, and prototype chains. Additionally, the codebase now separates utility types into their own module, and test files are reorganized for clarity and maintainability.
