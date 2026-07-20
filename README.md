# @cerios/cerios-builder

A TypeScript builder pattern library with **compile-time type safety** and **zero boilerplate**. Extend an auto builder and you get an automatic, fully typed setter for every property — and `build()` is a compile error until every required property has been set.

## 🚀 Features

- **Zero Boilerplate**: `CeriosAutoBuilder<T>()` / `CeriosClassAutoBuilder(Class)` generate every setter — no hand-written wrappers
- **Type-Safe Building**: Compile-time validation ensures all required properties are set before `build()` compiles
- **Class Support**: Build real class instances — methods, getters, decorators, and prototype chains preserved
- **Flexible Runtime Validation**: Required-field checks and custom validators, independent of the compile-time tracking
- **Immutability Options**: Frozen or sealed results, shallow or deep
- **Composable**: Nested-builder callbacks and the director pattern for deep structures
- **Immutable Builders**: Every setter is copy-on-write — forked builders never affect each other
- **TypeScript First**: Built with TypeScript, for TypeScript

## 📦 Installation

```bash
npm install @cerios/cerios-builder
```

dev install

```bash
npm install --save-dev @cerios/cerios-builder
```

## 🎯 Quick Start

```typescript
import { CeriosAutoBuilder } from "@cerios/cerios-builder";

// 1. Define your type
type User = {
	id: string;
	name: string;
	email: string;
	role: string;
	age?: number;
};

// 2. Extend the auto builder - every property gets a setter automatically
class UserBuilder extends CeriosAutoBuilder<User>() {
	static create(): UserBuilder {
		return new UserBuilder({});
	}

	// Custom logic is an ordinary method delegating to a generated setter
	asAdmin() {
		return this.role("admin");
	}
}

// 3. Build - all required properties enforced at compile time
const user = UserBuilder.create().id("1").name("Alice").email("a@b.io").asAdmin().build();

// ❌ Compile error - email and role are not set:
// UserBuilder.create().id("1").name("Alice").build();

// ✅ Optional properties can be omitted (age is optional)
```

Every property becomes a bare setter (`id`, `name`, …). Custom methods use those setters on `this` and mix freely into the chain, each contributing to the compile-time required-field tracking. If the type has **no** required properties at all, `build()` is available immediately.

## 🧩 Building Classes: `CeriosClassAutoBuilder`

Building instantiates the real class, so methods, getters, and decorators are preserved. Setters are generated for **writable** data properties only: methods, getter-only accessors, and `readonly` fields get no setter and don't count toward the required-property check — a class's `readonly` fields are seeded through its own constructor (see [Limitations](#️-limitations)):

```typescript
import { CeriosClassAutoBuilder } from "@cerios/cerios-builder";

class Person {
	name!: string;
	age!: number;
	email?: string;

	constructor(data?: Partial<Person>) {
		if (data) Object.assign(this, data);
	}

	greet(): string {
		return `Hi, ${this.name}`;
	}
}

class PersonBuilder extends CeriosClassAutoBuilder(Person) {
	static create(): PersonBuilder {
		return new PersonBuilder();
	}
}

const person = PersonBuilder.create().name("Alice").age(30).build();
person.greet(); // "Hi, Alice"
person instanceof Person; // true
```

## ✍️ Custom Methods

### Return types

Leave the return type off and TypeScript infers it, so the brand keeps flowing and `build()` stays fully checked. If your lint requires explicit return types, use `BuilderWith<>` (`ClassBuilderWith<>` for class builders). It takes the **builder** and the **keys the method sets** — the built type is derived from the builder, so you never repeat it:

```typescript
import { BuilderWith, CeriosAutoBuilder } from "@cerios/cerios-builder";

class AddressBuilder extends CeriosAutoBuilder<Address>() {
	static create(): AddressBuilder {
		return new AddressBuilder({});
	}

	static createWithDefaults(): BuilderWith<AddressBuilder, "country"> {
		return AddressBuilder.create().country("NL");
	}

	static createComplete(): BuilderWith<AddressBuilder> {
		return AddressBuilder.create().country("NL").street("Main St").city("Rotterdam");
	}

	inRotterdam(): BuilderWith<this, "city"> {
		return this.city("Rotterdam");
	}
}
```

| What the method does            | Return type                              |
| ------------------------------- | ---------------------------------------- |
| Factory, nothing preset         | `AddressBuilder`                         |
| Factory presetting some fields  | `BuilderWith<AddressBuilder, "country">` |
| Factory presetting everything   | `BuilderWith<AddressBuilder>`            |
| Custom method setting one field | `BuilderWith<this, "city">`              |
| Custom method setting several   | `BuilderWith<this, "city" \| "street">`  |
| Class builders                  | the same, with `ClassBuilderWith<>`      |

**Instance methods must use `this`, not the class name.** `BuilderWith<this, "city">` keeps everything set earlier in the chain; naming the concrete class would discard it and `build()` would stop compiling. Returning a plain `AddressBuilder` has the same problem — always return the setter result.

### Builder fields

Fields you add to a builder subclass (a `Map` cache, a counter) survive every setter call — but they are carried **by reference**: each setter returns a copy-on-write fork, and all forks and clones share the same field instances. Only the target data is deep-cloned. Keep anything fork-specific in the target data itself; builder fields are for genuinely shared state such as memoized lookups.

### Method names

A custom method **cannot reuse a property's exact name** — the method would shadow the generated setter it needs to call. Give it a distinct name and delegate:

```typescript
trimmedName(value: string): BuilderWith<this, "name"> {
	return this.name(value.trim());
}

addTag(tag: string): BuilderWith<this, "tags"> {
	return this.tags([...(this.buildPartial().tags ?? []), tag]);
}
```

### Reserved Names and Non-Identifier Keys

- A property whose name collides with a builder method — `build`, `clone`, `then`, `toJSON`, `setRequiredFields`, `addValidator`, and the other builder members — gets a **`Prop`-suffixed** setter instead, and the real method keeps its name:

  ```typescript
  type Config = { url: string; build: number };
  class ConfigBuilder extends CeriosAutoBuilder<Config>() {
  	/* ... */
  }
  ConfigBuilder.create().url("/x").buildProp(3).build(); // buildProp sets `build`; build() still builds
  ```

- A property whose name isn't a valid identifier (for example `"content-type"`) keeps its exact name and is set with **bracket access** — fully type-safe:

  ```typescript
  builder["content-type"]("application/json");
  ```

## 🧬 Base Types and Shared Builder Logic

### Derived types just work

Setters are generated from `keyof T`, which includes everything inherited — so a builder for a derived type automatically has setters for the base properties too. No base builder is needed just to share setters:

```typescript
type BasePostRequest = { postId: string; title?: string; tags?: string[] };
type CreatePostRequest = BasePostRequest & { title: string; authorId: string };

class CreatePostRequestBuilder extends CeriosAutoBuilder<CreatePostRequest>() {}
// .postId(), .title(), .tags() and .authorId() all exist, fully typed
```

The same holds for class hierarchies: `CeriosClassAutoBuilder(Order)` where `class Order extends BaseEntity` generates setters for the inherited data properties, and building runs the real constructor chain — the result is `instanceof` both classes with all inherited methods intact.

### Sharing custom methods: the base-builder function

Custom methods you want to reuse across several derived types go in a **base-builder function**: a function constrained on `AutoBuilderBase<TBase>` (or `ClassAutoBuilderBase<TBase>` for classes) that layers the shared methods on top of each concrete auto builder. Name it after the abstract base builder class you would have written by hand — the extends clause then reads the same:

```typescript
import { AutoBuilderBase, BuilderExtension, CeriosAutoBuilder } from "@cerios/cerios-builder";

function BasePostRequestBuilder<TBuilder extends AutoBuilderBase<BasePostRequest>>(Builder: TBuilder) {
	abstract class PostRequestBuilder extends Builder {
		addTag(tag: string) {
			return this.tags([...(this.buildPartial().tags ?? []), tag]);
		}
	}
	return PostRequestBuilder as BuilderExtension<TBuilder, PostRequestBuilder>;
}

class CreatePostRequestBuilder extends BasePostRequestBuilder(CeriosAutoBuilder<CreatePostRequest>()) {
	static create(): CreatePostRequestBuilder {
		return new CreatePostRequestBuilder({}, { requiredFields: ["postId", "title", "authorId"] });
	}
}
```

Inside the function, `this` exposes a setter for every property of the base type plus the brand-free part of the build/state API: `buildPartial()`, `buildUnsafe()`, `buildWithoutCompileTimeValidation()`, `clone()`, and `addValidator()` — so shared methods can fork, validate, and build. (The compile-gated variants like `build()` need the derived builder's brand and stay derived-only.) Each derived builder keeps its own full API: all setters, per-builder required fields, and the static `from()`. Setter calls in shared methods brand the build gate like any other setter, so `create().addTag("x")` counts toward compile-time validation — and if your lint requires explicit return types, `BuilderWith<this, "tags">` (or `ClassBuilderWith<>`) works on shared methods exactly as in [Custom Methods](#-custom-methods). The `BuilderExtension<TBuilder, TShared>` return type is what keeps the derived setters and statics visible on the result — don't leave it off.

For class hierarchies the shape is identical; the base class may be abstract, because it is only used as a type:

```typescript
import { BuilderExtension, CeriosClassAutoBuilder, ClassAutoBuilderBase } from "@cerios/cerios-builder";

abstract class BaseEntity {
	id!: string;
	createdAt?: Date;
}

function BaseEntityBuilder<TBuilder extends ClassAutoBuilderBase<BaseEntity>>(Builder: TBuilder) {
	abstract class EntityBuilder extends Builder {
		createdNow() {
			return this.createdAt(new Date());
		}
	}
	return EntityBuilder as BuilderExtension<TBuilder, EntityBuilder>;
}

class OrderBuilder extends BaseEntityBuilder(CeriosClassAutoBuilder(Order)) {}
class CustomerBuilder extends BaseEntityBuilder(CeriosClassAutoBuilder(Customer)) {}
```

One nuance: when a derived type **strengthens** an optional base property to required (like `title` above), a shared method whose return type is _inferred_ brands the _base_ type's optional flavor, which doesn't count toward the derived build gate. Annotating the shared method with `BuilderWith<this, "title">` (or `ClassBuilderWith<>`) fixes this: `BuilderWith` re-resolves the brand against the concrete builder's own target at the call site, so the same call satisfies the strengthened gate. Prefer the annotation on any shared method that sets a property a derived type might strengthen.

## ✅ Required Fields and Validators

Compile-time tracking works on its own. On top of it, both auto builders accept the same constructor options for **runtime** validation, so a subclass declares everything once:

```typescript
class UserBuilder extends CeriosAutoBuilder<User>() {
	constructor(data?: Partial<User>) {
		super(data, {
			requiredFields: { id: true, name: true, email: true, role: true },
			validators: [(u): boolean | string => (u.email?.includes("@") ? true : "Invalid email")],
		});
	}

	static create(): UserBuilder {
		return new UserBuilder();
	}
}
```

### Record form vs array form

The **record form** (`{ id: true, ... }`) is exhaustive: add a required property to `User` and this line fails to compile, so runtime validation cannot silently fall behind. The **array form** is validated against your type but not checked for completeness — use it when you need nested dot-notation paths:

```typescript
super(data, {
	requiredFields: ["order.details.customerId", "order.details.shippingAddress.city"],
});
```

> Deriving the list from the type alone is not possible — types are erased before runtime, so the keys must exist as a value somewhere.

### Dynamic requirements: `setRequiredFields()`

When the list depends on data you only have at runtime:

```typescript
const builder = employee.isContractor
	? base.setRequiredFields(["id", "name", "contractEndDate"])
	: base.setRequiredFields(["id", "name", "employeeId"]);
```

`setRequiredFields()` **replaces** the instance list — the last call wins, so pass one complete list per call. It is copy-on-write like every other builder method.

### Custom validators

Validators receive the partial object and return `true` (pass), `false` (generic failure), or a `string` (failure with message):

```typescript
const user = UserBuilder.create()
	.id("1")
	.name("Bob")
	.email("bob@example.com")
	.asAdmin()
	.addValidator((obj) => (obj.age ?? 18) >= 18 || "User must be at least 18 years old")
	.addValidator((obj) => obj.email?.includes("@") || "Invalid email format")
	.build();
```

- Validators run on `build()`, `buildWithoutCompileTimeValidation()`, and the frozen/sealed variants; `buildUnsafe()` and `buildPartial()` skip them.
- Every validator runs; all failure messages are joined into a single error.
- A validator returning `false` is identified by index and function name; returning `undefined` (a forgotten `return`) or an empty string is treated as a failure, not a pass.

### Handling errors: `CeriosBuilderError`

Every validating build variant throws a `CeriosBuilderError`. It extends `Error`, and carries the failure as data:

```typescript
import { CeriosBuilderError } from "@cerios/cerios-builder";

try {
	builder.build();
} catch (error) {
	if (error instanceof CeriosBuilderError) {
		error.missingFields; // e.g. ["email", "role"] - empty if a validator failed instead
		error.validationErrors; // e.g. ["Age must be 18 or older"] - empty if fields were missing
	}
}
```

The `instanceof` check is also what makes this compile under `useUnknownInCatchVariables`.

## 🛠️ Build Methods

| Method                                | Compile-Time Check | Runtime Check | Use Case               |
| ------------------------------------- | ------------------ | ------------- | ---------------------- |
| `build()`                             | ✅                 | ✅            | Production code        |
| `buildWithoutRuntimeValidation()`     | ✅                 | ❌            | Performance-critical   |
| `buildWithoutCompileTimeValidation()` | ❌                 | ✅            | External/dynamic data  |
| `buildUnsafe()`                       | ❌                 | ❌            | Trusted scenarios only |
| `buildPartial()`                      | ❌                 | ❌            | Incomplete objects     |

```typescript
// Runtime-only validation is useful when building from external data:
function buildFromApi(data: Record<string, unknown>): User {
	let builder = UserBuilder.create();
	if (typeof data.id === "string") builder = builder.id(data.id);
	// ...
	return builder.buildWithoutCompileTimeValidation(); // throws CeriosBuilderError if incomplete
}
```

### Immutable results

Each validating build variant also has frozen and sealed versions:

| Method              | Modify Top-Level | Modify Nested | Add/Delete Properties | Returns           |
| ------------------- | ---------------- | ------------- | --------------------- | ----------------- |
| `buildFrozen()`     | ❌               | ✅            | ❌ (top level)        | `Readonly<T>`     |
| `buildDeepFrozen()` | ❌               | ❌            | ❌ (all levels)       | `DeepReadonly<T>` |
| `buildSealed()`     | ✅               | ✅            | ❌ (top level)        | `T`               |
| `buildDeepSealed()` | ✅               | ✅            | ❌ (all levels)       | `T`               |

Use **deep frozen** for configuration objects and snapshots, **deep sealed** for fixed schemas with mutable values, and the shallow variants when nested objects should stay flexible. All of them validate first and return a fresh copy — the builder itself is never frozen.

## 🏗️ Composing Nested Objects

An auto setter always replaces a **whole root property**. Deep structures are composed from small builders, in two complementary ways.

### Nested builders: callback composition

To let callers build a nested object inline, add a method taking a callback typed with `BuilderComposerFromFactory<>` (`ClassBuilderComposerFromFactory<>` for classes). It infers the callback's input **and** its required output from the child factory: the callback gets a builder with the factory's defaults already counted as set, and it will not compile unless it returns a fully-set child builder.

```typescript
import { BuilderComposerFromFactory, BuilderWith, CeriosAutoBuilder } from "@cerios/cerios-builder";

class CustomerBuilder extends CeriosAutoBuilder<Customer>() {
	static create(): CustomerBuilder {
		return new CustomerBuilder({});
	}

	withAddress(fn: BuilderComposerFromFactory<typeof AddressBuilder.createWithDefaults>): BuilderWith<this, "address"> {
		return this.address(fn(AddressBuilder.createWithDefaults()).build());
	}

	// Factory presets everything -> the callback can be optional
	withCompleteAddress(
		fn?: BuilderComposerFromFactory<typeof AddressBuilder.createComplete>,
	): BuilderWith<this, "address"> {
		const builder = AddressBuilder.createComplete();
		return this.address(fn ? fn(builder).build() : builder.build());
	}
}

const customer = CustomerBuilder.create()
	.id("1")
	.name("Alice")
	.withAddress((address) => address.street("Main St").city("Rotterdam")) // `country` already defaulted
	.build();

// Compile errors you get for free:
CustomerBuilder.create().withAddress((address) => address.street("Main St")); // city not set
CustomerBuilder.create().withAddress(() => ContactBuilder.create().email("a@b.c")); // wrong target type
```

Give the composer method a distinct name (`withAddress`) and let it delegate to the auto setter (`this.address(...)`) — that keeps the generated setter available to do the actual work.

### The Director Pattern

For deep structures — where the deprecated builders used `setNestedProperty` dot-paths — give each level its own builder and put the assembly recipe in a **director**:

```typescript
type OrderRequest = { order: { details?: OrderDetails } };

class AddressBuilder extends CeriosAutoBuilder<Address>() {
	static create(): AddressBuilder {
		return new AddressBuilder({});
	}

	static createDomestic(): BuilderWith<AddressBuilder, "country"> {
		return AddressBuilder.create().country("USA");
	}
}

class OrderDetailsBuilder extends CeriosAutoBuilder<OrderDetails>() {
	static create(): OrderDetailsBuilder {
		return new OrderDetailsBuilder({});
	}

	static createPending(): BuilderWith<OrderDetailsBuilder, "status"> {
		return OrderDetailsBuilder.create().status("pending");
	}
}

class OrderRequestBuilder extends CeriosAutoBuilder<OrderRequest>() {
	static create(): OrderRequestBuilder {
		return new OrderRequestBuilder({});
	}
}

/** One place that knows how a complete OrderRequest is put together. */
class OrderRequestDirector {
	static standardOrder(input: { customerId: string; totalAmount: number; street: string; city: string }): OrderRequest {
		const shippingAddress = AddressBuilder.createDomestic().street(input.street).city(input.city).build();

		const details = OrderDetailsBuilder.createPending()
			.customerId(input.customerId)
			.totalAmount(input.totalAmount)
			.shippingAddress(shippingAddress)
			.build();

		return OrderRequestBuilder.create().order({ details }).build();
	}

	// Callers can customise one level without the director losing control of the recipe:
	static orderShippedTo(
		input: { customerId: string; totalAmount: number },
		composeAddress: BuilderComposerFromFactory<typeof AddressBuilder.createDomestic>,
	): OrderRequest {
		const shippingAddress = composeAddress(AddressBuilder.createDomestic()).build();
		// ... assemble as above
	}
}

const order = OrderRequestDirector.standardOrder({
	customerId: "CUST-001",
	totalAmount: 299.99,
	street: "123 Main St",
	city: "New York",
});
```

Why this beats dot-path writing into one big object:

- every level is compile-time checked by its own builder — a missing `city` is a compile error, not a runtime surprise;
- each child builder is reusable on its own and in other directors;
- the director gives the recipe a name (`standardOrder`) instead of scattering path strings.

The runnable version lives in [tests/cerios-auto-builder/cerios-auto-builder-director.test.ts](tests/cerios-auto-builder/cerios-auto-builder-director.test.ts).

## 🔧 Seeding, Cloning, and Removing

```typescript
// Seed from an existing object or instance (deep-cloned; immediately buildable):
const updated = UserBuilder.from(existingUser).name("Renamed").build();

// Independent copy of a builder in progress:
const fork = builder.clone();

// Remove optional properties:
builder.removeOptionalProperty("age"); // one optional key
builder.clearOptionalProperties(); // all optional keys, required ones survive
```

Everything is copy-on-write: each call returns a new builder, and builders never share mutable state with each other or with the objects they build.

## 🧪 Testing Integration

Auto builders shine for test fixtures — defaults in factories, variation in the test:

```typescript
class ProductBuilder extends CeriosAutoBuilder<Product>() {
	static create(): ProductBuilder {
		return new ProductBuilder({});
	}

	static createValid(): BuilderWith<ProductBuilder> {
		return ProductBuilder.create().name("Widget").price(9.99).category("Tools");
	}

	asFree(): BuilderWith<this, "price"> {
		return this.price(0);
	}
}

test("free products skip payment", () => {
	const product = ProductBuilder.createValid().asFree().build();
	expect(paymentRequired(product)).toBe(false);
});
```

## ⚠️ Limitations

- Class data properties that are function-typed (e.g. `onChange: (x: number) => void`) are treated like methods and get no setter — there's no reliable way to distinguish them from methods at the type level.
- A custom method cannot have the same name as a property; use a distinct name that delegates to the generated setter (see [Method names](#method-names)).
- Inside a **generic** base builder (e.g. `class Base<T extends Shape> extends ...`), the compile-time gate cannot resolve until `T` is concrete — the same rule as for hand-written builders. To share logic across derived types, use a [base-builder function](#sharing-custom-methods-the-base-builder-function) instead.
- **`readonly` object properties keep their setters, `readonly` class fields do not.** For a plain object type there is no constructor — the builder _is_ the construction (the same reason an object literal may initialize a `readonly id`), so `CeriosAutoBuilder` generates a working setter and the built object stays `readonly`-typed. A **class** owns its `readonly` fields through its own constructor, so `CeriosClassAutoBuilder` generates no setter for them and the build gate doesn't demand them — seed them with `new Builder({ id: "1" })` or `Builder.from(instance)` instead, or enforce a genuinely required one with runtime `requiredFields`.
- **Getter-only class accessors** (`get displayName() { ... }`) are computed by the class. Because a getter without a setter is `readonly` at the type level, no setter is generated — the misuse is a **compile error**. A runtime guard also throws a clear `CeriosBuilderError` naming the accessor, for untyped access (types are erased at runtime, so the proxy cannot see `readonly`) and for seed data. Accessors with both a getter and a setter are writable and get a setter as normal.
- **Symbol-keyed properties** are outside the builder's model: setters are generated for string keys only, and state snapshots deep-clone via string keys, so a symbol-keyed value doesn't survive a build. If a required property is symbol-keyed, the compile gate cannot be satisfied — seed via `from()` or use `buildUnsafe()`.
- **Builder subclass fields are carried by reference** across the copy-on-write forks every setter creates: a `Map` or array field on your builder class is shared between all forks and clones. Only the target data is deep-cloned — keep per-fork state in the target data, not in builder fields.

## 🗑️ Deprecated: `CeriosBuilder` and `CeriosClassBuilder`

The hand-written builder base classes — where you write a `setProperty` wrapper per property — are **deprecated and will be removed in the next major version**. They still work in this release, unchanged, including `setNestedProperty` and `addToArrayProperty`.

**Migrate to the auto builders**: see **[MIGRATION.md](MIGRATION.md)** for a per-feature before/after guide, including:

- dropping setter wrappers and constructor plumbing,
- moving `static requiredTemplate` / `requiredDataProperties` to constructor options,
- replacing `setNestedProperty` with the [director pattern](#the-director-pattern),
- replacing `addToArrayProperty` with a custom method on the root setter.

## 📚 API Reference

### Factories

- `CeriosAutoBuilder<T>()` — returns an abstract base class with an auto setter per property of `T`.
- `CeriosClassAutoBuilder(Class)` — the same for a class; building instantiates `Class`. Returns the same (memoised) base class for the same `Class`, so `instanceof` works across calls.

### Constructor

Both auto builders share one constructor shape, with the options named by the exported `BuilderInit` type:

```typescript
new Builder(data?: Partial<T>, init?: BuilderInit<T>)

type BuilderInit<T> = {
	requiredFields?: ReadonlyArray<Path<T>> | RequiredFieldsRecord<T>;
	validators?: Array<(obj: Partial<T>) => boolean | string>;
};
```

### Instance methods

`build()`, `buildWithoutRuntimeValidation()`, `buildWithoutCompileTimeValidation()`, `buildUnsafe()`, `buildPartial()`, `buildFrozen()`, `buildDeepFrozen()`, `buildSealed()`, `buildDeepSealed()`, `addValidator()`, `setRequiredFields()`, `removeOptionalProperty()`, `clearOptionalProperties()`, `clone()` — see the sections above.

### Statics

- `Builder.from(instance)` — seeds a new builder from an existing object/instance (deep-cloned), immediately buildable.

### Helper types

- `BuilderWith<B, S>` / `ClassBuilderWith<B, S>` — explicit return types for factories and custom methods; `S` is the union of keys set, omit for "fully buildable".
- `AutoBuilderBase<TBase>` / `ClassAutoBuilderBase<TBase>` — constraint for [base-builder functions](#sharing-custom-methods-the-base-builder-function) sharing logic across derived types.
- `BuilderExtension<TBuilder, TShared>` — return type of a base-builder function; keeps the derived builder's setters and statics visible.
- `BuilderComposerFromFactory<F>` / `ClassBuilderComposerFromFactory<F>` — callback types for nested-builder composition, inferred from a factory.
- `BuildGate<T>` / `ClassBuildGate<T>` — the `this` constraint on the validated build variants; dissolves for all-optional types.
- `BuilderInit<T>` — the named `{ requiredFields?, validators? }` constructor-options type both auto builders accept.
- `AutoBuilderConstructor<T>` / `ClassAutoBuilderConstructor<T>` — the abstract constructor type a factory returns; name it when storing or passing a factory result.
- `AutoBuilderApi<T>` / `ClassAutoBuilderApi<T>` — the build/validate/clone instance API every auto builder exposes, without the generated setters.
- `AutoSetters<T>` / `ClassAutoSetters<T>` — the generated bare-name setters (one per property; the class variant covers **writable** data properties only — methods, getter-only accessors, and `readonly` fields are excluded).
- `DataPropertiesOnly<T>` — a class type with its methods stripped; the shape the class builders track and build from.
- `ClassConstructor<T>` — the constructor signature `CeriosClassBuilder` requires of a target class.
- `RequiredFieldsRecord<T>`, `RequiredFieldsTemplate<T>`, `Path<T>`, `ClassPath<T>`, `DeepReadonly<T>`, `OptionalKeys<T>`, `RequiredKeys<T>`, `WritableKeys<T>`.
- `BuilderStep` / `ClassBuilderStep`, `BuilderPreset` / `ClassBuilderPreset`, `BuilderComposer` / `ClassBuilderComposer` — the longer three-argument forms `BuilderWith` supersedes; still exported and supported.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

MIT © Ronald Veth - Cerios

## 🔗 Links

- [GitHub Repository](https://github.com/CeriosTesting/cerios-builder)
- [Issue Tracker](https://github.com/CeriosTesting/cerios-builder/issues)
- [NPM Package](https://www.npmjs.com/package/@cerios/cerios-builder)
- [Migration Guide](MIGRATION.md)
