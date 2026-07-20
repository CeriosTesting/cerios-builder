# Migrating to the Auto Builders

`CeriosBuilder` and `CeriosClassBuilder` are **deprecated** and will be **removed in the next major version**. Their replacements are the auto builder factories:

| Deprecated                              | Replacement                                 |
| --------------------------------------- | ------------------------------------------- |
| `class B extends CeriosBuilder<T>`      | `class B extends CeriosAutoBuilder<T>()`    |
| `class B extends CeriosClassBuilder<T>` | `class B extends CeriosClassAutoBuilder(T)` |

The auto builders keep the complete compile-time guarantee — `build()` does not compile until every required property is set — but generate every setter for you. This guide shows the before/after for each feature.

## 1. Basic builder: drop the setter wrappers

**Before** — every property needs a hand-written `setProperty` wrapper:

```typescript
class UserBuilder extends CeriosBuilder<User> {
	static create() {
		return new UserBuilder({});
	}

	id(value: string) {
		return this.setProperty("id", value);
	}

	name(value: string) {
		return this.setProperty("name", value);
	}

	email(value: string) {
		return this.setProperty("email", value);
	}
}
```

**After** — the setters are generated; only real logic remains:

```typescript
class UserBuilder extends CeriosAutoBuilder<User>() {
	static create(): UserBuilder {
		return new UserBuilder({});
	}
}

const user = UserBuilder.create().id("1").name("Alice").email("a@b.io").build();
```

Note the `()` — `CeriosAutoBuilder<User>()` is a factory call that returns the base class.

## 2. Class builder: drop the constructor plumbing

**Before** — the subclass constructor forwards the class constructor (and, if it wants `setRequiredFields`/`addValidator` to survive copy-on-write, the whole internal 4-argument shape):

```typescript
class PersonBuilder extends CeriosClassBuilder<Person> {
	constructor(classConstructor: ClassConstructor<Person> = Person, data: Partial<Person> = {}) {
		super(classConstructor, data);
	}

	static create() {
		return new PersonBuilder(Person);
	}

	name(value: string) {
		return this.setProperty("name", value);
	}
}
```

**After** — the class is passed once, to the factory; the constructor is just `(data?, init?)`:

```typescript
class PersonBuilder extends CeriosClassAutoBuilder(Person) {
	static create(): PersonBuilder {
		return new PersonBuilder();
	}
}

const person = PersonBuilder.create().name("Alice").age(30).build();
person.greet(); // real instance - methods, getters, and decorators preserved
```

Methods are excluded from the generated setters and from the required-property check automatically.

## 3. Custom fluent methods

Custom methods carry over unchanged — they are ordinary class methods that delegate to the generated setters. Leave the return type to inference, or use `BuilderWith` (`ClassBuilderWith` for classes) if your lint requires explicit return types:

```typescript
class UserBuilder extends CeriosAutoBuilder<User>() {
	static create(): UserBuilder {
		return new UserBuilder({});
	}

	asAdmin(): BuilderWith<this, "role"> {
		return this.role("admin");
	}
}
```

`BuilderWith<this, "role">` replaces the longer `BuilderStep<this, User, "role">` — the built type is derived from the builder, so you never repeat it. Always use `this`, not the class name, so previously set keys are preserved.

**A custom method cannot reuse a property's exact name** — the method would shadow the generated setter it needs to call. Give it a distinct name:

```typescript
// Before (hand-written): name(value) { return this.setProperty("name", value.trim()); }
// After:
trimmedName(value: string): BuilderWith<this, "name"> {
	return this.name(value.trim());
}
```

## 4. `static requiredTemplate` / `requiredDataProperties` → constructor options

Runtime validation of required fields moves from the deprecated statics to the constructor options (or `setRequiredFields()`), identical on both auto builders:

```typescript
class UserBuilder extends CeriosAutoBuilder<User>() {
	constructor(data?: Partial<User>) {
		super(data, {
			requiredFields: { id: true, name: true, email: true },
			validators: [(u): boolean | string => (u.email?.includes("@") ? true : "Invalid email")],
		});
	}

	static create(): UserBuilder {
		return new UserBuilder();
	}
}
```

Prefer the exhaustive **record form** (`{ id: true, ... }`): adding a required property to `User` then fails to compile here, so runtime validation cannot silently fall behind. The **array form** (`["id", "name", "email"]`) is still available and is the one to use for nested dot-notation paths (`"order.details.customerId"`).

The options object is the exported `BuilderInit` type, should you need to name it — for example to build the `init` argument up front before passing it to `super()`.

## 5. `setNestedProperty` → a director composing multiple builders

The dot-path helper is deliberately **not** part of the auto builders. Instead of one builder writing deep paths into one big object, give each level its own small builder and put the assembly recipe in a **director**:

```typescript
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
}
```

Compared to `setNestedProperty("Order.Details.ShippingAddress.Street", ...)`:

- every level is compile-time checked by its own builder — a missing `city` is a compile error, not a runtime surprise;
- each child builder is reusable on its own and in other directors;
- callers can customize a level through a callback (`BuilderComposerFromFactory`) without the director losing control of the recipe.

The runnable version of this example lives in [tests/cerios-auto-builder/cerios-auto-builder-director.test.ts](tests/cerios-auto-builder/cerios-auto-builder-director.test.ts).

For a one-off small update, a custom method replacing the whole root property also works:

```typescript
inCity(city: string): BuilderWith<this, "address"> {
	const address = this.buildPartial().address ?? { street: "", city: "" };
	return this.address({ ...address, city });
}
```

## 6. `addToArrayProperty` → a custom method on the root setter

```typescript
// Before: addTag(tag: string) { return this.addToArrayProperty("tags", tag); }
// After:
addTag(tag: string): BuilderWith<this, "tags"> {
	return this.tags([...(this.buildPartial().tags ?? []), tag]);
}
```

## 7. Generic base builder classes → base-builder functions

A hand-written base builder generic over a base type cannot be ported literally: `class B<T> extends CeriosAutoBuilder<T>()` is illegal, because a base-class expression cannot reference the class's own type parameter. It also isn't needed for the setters — auto builders generate setters for inherited properties automatically, so only the **shared custom methods** still have to move. They go into a **base-builder function**, constrained on `AutoBuilderBase<TBase>` (`ClassAutoBuilderBase<TBase>` for classes) and returned as `BuilderExtension`:

```typescript
// Before: shared setters and helpers in an abstract generic base class
abstract class BasePostRequestBuilder<T extends BasePostRequest> extends CeriosBuilder<T> {
	postId(value: T["postId"]): BuilderStep<this, T, "postId"> {
		return this.setProperty("postId", value);
	}
	addTag(value: string): BuilderStep<this, T, "tags"> {
		return this.setProperty("tags", [...(this.buildPartial().tags ?? []), value] as T["tags"]);
	}
}
class CreatePostRequestBuilder extends BasePostRequestBuilder<CreatePostRequest> {
	authorId(value: string): BuilderStep<this, CreatePostRequest, "authorId"> {
		return this.setProperty("authorId", value);
	}
}

// After: setters exist automatically; only shared helpers need a home
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
		return new CreatePostRequestBuilder({}, { requiredFields: ["postId", "title", "content", "authorId"] });
	}
}
```

Keep the function's name identical to the abstract class it replaces and the extends clause stays recognizable. Each derived builder keeps its full API — all setters, its own required fields, `clone()`, static `from()` — and shared setter calls count toward the derived compile-time gate. One nuance: a shared method setting a property the derived type strengthens from optional to required brands only the base flavor; set such properties through the derived builder's own setter. See the README section [Base Types and Shared Builder Logic](README.md#-base-types-and-shared-builder-logic).

## 8. Everything that carries over unchanged

The full builder API is inherited by the auto builders — no changes needed for:

- all build variants: `build`, `buildWithoutRuntimeValidation`, `buildWithoutCompileTimeValidation`, `buildUnsafe`, `buildPartial`, `buildFrozen`, `buildDeepFrozen`, `buildSealed`, `buildDeepSealed`
- `addValidator()`, `setRequiredFields()`, `removeOptionalProperty()`, `clearOptionalProperties()`, `clone()`
- `CeriosBuilderError` with `missingFields` / `validationErrors`
- nested-builder composition with `BuilderComposerFromFactory` / `ClassBuilderComposerFromFactory`

`static from()` gets **better**: `CeriosClassAutoBuilder(...).from(instance)` takes just the instance (the deprecated `CeriosClassBuilder.from` needed the class constructor as a first argument), and the deprecated `CeriosBuilder.from()` requirement of a _public_ subclass constructor disappears.

## 9. Behavioral notes on the auto builders

- **Reserved names**: a property named like a builder method (`build`, `clone`, `then`, ...) gets a `Prop`-suffixed setter (`buildProp`); the real method keeps its name.
- **Non-identifier keys** (`"content-type"`) are set with bracket access: `builder["content-type"]("application/json")`.
- **All-optional types build immediately**: `build()` is available on a fresh builder when the type has no required properties (this also applies to the deprecated builders as of this release).
- Setters are generated by a `Proxy`; `await builder` and `JSON.stringify(builder)` behave normally.
- **The class auto builder generates setters for writable public data properties only.** Methods, getter-only accessors, and `readonly` fields get no setter — a class owns its `readonly` fields through its own constructor, so seed them with `new Builder({ id: "1" })` or `Builder.from(instance)` rather than a setter. Setting a getter-only accessor is now a compile error; a runtime `CeriosBuilderError` naming the accessor also guards untyped access and seed data (replacing the former `TypeError: Cannot set property ... which has only a getter` at build time). This runtime guard also applies to the deprecated `CeriosClassBuilder.setProperty`. Enforce a genuinely required `readonly` field with runtime `requiredFields`.
