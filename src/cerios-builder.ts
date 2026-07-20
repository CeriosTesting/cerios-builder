// oxlint-disable typescript/no-deprecated
import {
	assertSafeKey,
	assertSafePath,
	deepClone,
	deepHarden,
	pickRequiredRoots,
	toRequiredPaths,
} from "./auto-builder-core";
import { CeriosBuilderError, runValidatorsAgainst } from "./builder-error";
import {
	BuilderTargetMarker,
	DeepReadonly,
	RequiredFieldsRecord,
	RequiredKeys,
	TargetOfMarker,
	UnionToIntersection,
} from "./types";

/**
 * Unique symbol used internally to brand types and track which properties have been set in the builder's type.
 *
 * @internal
 */
declare const __brand: unique symbol;

/**
 * Internal brand for builder type-state tracking.
 * Prefer helper aliases like `BuilderStep` in public APIs.
 * @internal
 */
export type InternalBuilderBrand<T> = { [__brand]: T };

/**
 * Type utility for branding builder types with information about which properties have been set.
 * This is used to enforce compile-time safety for required fields in the builder pattern.
 *
 * @deprecated Prefer `BuilderStep`, `BuilderPreset`, `BuilderComposer`, or `BuilderComposerFromFactory` in user-facing APIs.
 * This type remains exported for backward compatibility.
 *
 * @template T - The type representing the set of properties that have been set
 * @internal
 */
export type CeriosBrand<T> = InternalBuilderBrand<T>;

/**
 * The `this` constraint gating the compile-time-validated build variants.
 *
 * Normally the accumulated {@link InternalBuilderBrand} must cover every required key of T.
 * When T has no required keys there is nothing to track, so the gate dissolves to `unknown`
 * and `build()` is callable on a fresh builder — an all-optional type no longer needs a
 * throwaway setter call (or a `buildUnsafe()` fallback) before it can build.
 *
 * @template T - The type being built
 */
export type BuildGate<T> = [RequiredKeys<T>] extends [never] ? unknown : InternalBuilderBrand<T>;

type RootFromPath<P extends string> = P extends `${infer K}.${string}` ? K : P;

type StepKey<T extends object, S extends keyof T | Path<T>> = S extends keyof T
	? S
	: Extract<RootFromPath<S & string>, keyof T>;

/**
 * Helper type for fluent builder methods that set one root property.
 * This keeps method signatures short while preserving compile-time field tracking.
 * Supports both root keys ("name") and dot-notation paths ("address.street").
 *
 * @template B - The current builder instance type (usually `this`)
 * @template T - The target object type being built
 * @template S - A root key or path in T
 */
export type BuilderStep<B, T extends object, S extends keyof T | Path<T>> = B &
	InternalBuilderBrand<Pick<T, StepKey<T, S>>>;

/**
 * Brands T's writable state one key at a time and intersects the results, matching the shape
 * that chaining single-key `BuilderStep` applications actually produces - rather than one
 * `Pick` over the whole key union. The two are structurally equivalent for concrete types, but
 * not always provably assignable to each other when compared against an unresolved polymorphic
 * `this`, which is what `BuilderWith` is typically instantiated with. Used by `BuilderWith`
 * only - `BuilderStep` keeps the plain single-`Pick` formula above, since user code overrides
 * it with a still-generic key parameter (`BuilderStep<this, T, K>`) far more often than with an
 * explicit key union, and the plain formula is the one that stays comparable against a
 * deferred `K`.
 * @internal
 */
type BuilderWithBrand<T extends object, K extends keyof T> = [K] extends [never]
	? InternalBuilderBrand<Pick<T, never>>
	: UnionToIntersection<K extends unknown ? InternalBuilderBrand<Pick<T, K>> : never>;

/**
 * Helper type for factory methods that return a preconfigured builder state.
 * Useful for methods like `createWithDefaults()` where you want an explicit return type
 * without losing compile-time tracking of which fields are already set.
 *
 * @template B - The builder instance type
 * @template T - The target object type being built
 * @template S - A root key or path (or union) already configured by the factory
 */
export type BuilderPreset<B, T extends object, S extends keyof T | Path<T>> = BuilderStep<B, T, S>;

/**
 * Helper type for callback-based builder composition APIs.
 *
 * Input builder:
 * - If `Preset` is omitted, callback receives the base builder `B`.
 * - If `Preset` is provided, callback receives a preconfigured builder state.
 *
 * Output builder:
 * - Callback must return a fully buildable state for `T`.
 *
 * @template B - The builder instance type
 * @template T - The target object type being built
 * @template Preset - Optional preset key/path union already configured before callback execution
 */
export type BuilderComposer<B, T extends object, Preset extends keyof T | Path<T> = never> = (
	builder: [Preset] extends [never] ? B : BuilderPreset<B, T, Preset>,
) => BuilderPreset<B, T, keyof T>;

/**
 * Extracts the target type built by any builder type.
 *
 * Hand-written builders are matched nominally against `CeriosBuilder`. Auto builders
 * (`CeriosAutoBuilder<T>()`) declare their instance type as `AutoBuilderApi<T> & AutoSetters<T>`,
 * which is not assignable to `CeriosBuilder<T>` (its `protected _actual` only matches when it
 * originates from the same declaration), so they are matched structurally on `buildUnsafe`.
 *
 * @internal
 */
type BuilderTargetOf<B> =
	B extends CeriosBuilder<infer T> ? T : B extends { buildUnsafe(): infer T } ? (T extends object ? T : never) : never;

/**
 * The return type of a builder factory or custom builder method, expressed in terms of
 * the builder itself. Prefer this over `BuilderStep`/`BuilderPreset` in your own code:
 * the target type is derived from the builder, so you only name the builder and the
 * keys the method sets.
 *
 * Works for both hand-written `CeriosBuilder` subclasses and `CeriosAutoBuilder` subclasses.
 *
 * Use root keys only. A method that sets a nested path brands the *root* key, so a
 * method calling `setNestedProperty("meta.note", ...)` returns `BuilderWith<this, "meta">`.
 *
 * @template B - The builder type (a concrete builder class, or `this` inside a method)
 * @template S - The keys this method sets. Omit to mean "every key" (fully buildable).
 *
 * @example
 * ```typescript
 * class AddressBuilder extends CeriosAutoBuilder<Address>() {
 *   static create(): AddressBuilder { return new AddressBuilder({}); }
 *   static createWithDefaults(): BuilderWith<AddressBuilder, "country"> {
 *     return AddressBuilder.create().country("NL");
 *   }
 *   static createComplete(): BuilderWith<AddressBuilder> { ... }
 *
 *   inRotterdam(): BuilderWith<this, "city"> { return this.city("Rotterdam"); }
 * }
 * ```
 */
export type BuilderWith<
	B extends BuilderTargetMarker<object>,
	S extends keyof TargetOfMarker<B> = keyof TargetOfMarker<B>,
> = B & BuilderWithBrand<TargetOfMarker<B>, S>;

type BuilderBaseFromFactoryReturn<R> = R extends (infer B) & InternalBuilderBrand<unknown> ? B : R;

type BuilderTargetFromFactoryReturn<R> = BuilderTargetOf<BuilderBaseFromFactoryReturn<R>>;

/**
 * Helper type for composition callbacks based on a builder factory method.
 *
 * This infers both the callback input type (including presets/defaults) and the
 * fully-buildable output type directly from the factory return type. The factory may
 * belong to a hand-written `CeriosBuilder` subclass or a `CeriosAutoBuilder` subclass.
 *
 * @template F - A builder factory function type (for example: `typeof MyBuilder.createWithDefaults`)
 */
export type BuilderComposerFromFactory<F extends (...args: never[]) => unknown> = (
	builder: ReturnType<F>,
) => BuilderPreset<
	BuilderBaseFromFactoryReturn<ReturnType<F>>,
	BuilderTargetFromFactoryReturn<ReturnType<F>>,
	keyof BuilderTargetFromFactoryReturn<ReturnType<F>>
>;

/**
 * Helper type to represent a path through an object structure
 * Handles optional properties by unwrapping them with NonNullable
 */
type PathImpl<T, K extends keyof T = keyof T> = K extends string | number
	? NonNullable<T[K]> extends object
		? NonNullable<T[K]> extends Array<unknown>
			? K
			: K | `${K}.${PathImpl<NonNullable<T[K]>> & string}`
		: K
	: never;

export type Path<T> = PathImpl<T>;

/**
 * Helper type to get the value at a specific path, handling optional properties
 */
export type PathValue<T, P> = P extends keyof T
	? T[P]
	: P extends `${infer K}.${infer Rest}`
		? K extends keyof T
			? PathValue<NonNullable<T[K]>, Rest>
			: never
		: never;

/**
 * Type-safe template for defining required fields using an array of paths.
 * Simply list the paths that are required.
 */
export type RequiredFieldsTemplate<T> = ReadonlyArray<Path<T>>;

/**
 * Abstract base class for creating type-safe builders with automatic property setters and compile-time validation of required fields.
 *
 * This class is intended to be extended by concrete builder implementations for your own types.
 * It provides utility methods for setting properties and building the final object, ensuring that all required fields are set at compile time.
 *
 * Example usage:
 * ```typescript
 * interface MyType { foo: string; bar: number[]; }
 * class MyTypeBuilder extends CeriosBuilder<MyType> {
 *   static requiredTemplate: RequiredFieldsTemplate<MyType> = ['foo'];
 *   setFoo(value: string) { return this.setProperty('foo', value); }
 *   addBar(value: number) { return this.addToArrayProperty('bar', value); }
 * }
 * // Usage:
 * const obj = new MyTypeBuilder({})
 *   .setFoo('hello')
 *   .addBar(42)
 *   .buildSafe(); // Validates that 'foo' is set
 * ```
 *
 * @template T - The complete type being built
 */
/**
 * Merged declaration giving every `CeriosBuilder` the phantom target marker, so
 * `BuilderWith<this, K>` can resolve what the builder builds. Adds no runtime members.
 */
// oxlint-disable-next-line typescript/no-unsafe-declaration-merging -- phantom type-only marker, no runtime members
export interface CeriosBuilder<T extends object> extends BuilderTargetMarker<T> {}

/**
 * @deprecated Will be removed in the next major version. Migrate to `CeriosAutoBuilder<T>()`,
 * which generates every setter automatically with the same compile-time safety — see
 * MIGRATION.md for a per-feature guide (including how a director replaces `setNestedProperty`).
 */
export abstract class CeriosBuilder<T extends object> {
	/**
	 * Template defining which fields are required for this builder.
	 * Subclasses should override this to specify their required fields as an array of paths.
	 * The template is type-safe - only valid paths from type T can be used.
	 *
	 * @deprecated Prefer passing required fields via subclass constructor through `super(data, requiredFields)`
	 * or setting them at runtime with `setRequiredFields()`.
	 */
	static requiredTemplate?: ReadonlyArray<string>;

	/**
	 * Instance-level required fields that can be populated dynamically.
	 * This allows adding required fields at runtime via the setRequiredFields method.
	 * @private
	 */
	private _requiredFields: Set<string> = new Set();

	/**
	 * Custom validators that run during build.
	 * @private
	 */
	private _validators: Array<(obj: Partial<T>) => boolean | string> = [];

	/**
	 * Sets the required fields for this builder instance.
	 * This allows you to dynamically define which fields are required.
	 *
	 * @param fields - Array of dot-notation paths to required fields
	 * @returns The builder instance for chaining
	 *
	 * @example
	 * ```typescript
	 * const builder = new MyBuilder({})
	 *   .setRequiredFields(['path.to.field1', 'path.to.field2'])
	 *   .setField1('value1')
	 *   .setField2('value2')
	 *   .buildSafe();
	 * ```
	 */
	setRequiredFields(fields: ReadonlyArray<Path<T>> | RequiredFieldsRecord<T>): this {
		// Copy-on-write like every other method here (and like
		// CeriosClassBuilder.setRequiredFields), so a forked builder cannot retroactively
		// change the required fields of the builder it was forked from.
		return this.instantiateBuilder(
			this._actual,
			toRequiredPaths(fields) as RequiredFieldsTemplate<T>,
			this._validators,
		);
	}

	/**
	 * Adds a custom validator function that will be executed during build.
	 * Validators can return true for valid, false for invalid, or a string error message.
	 * Multiple validators can be added and all will be checked.
	 *
	 * @param validator - Function that validates the partial object
	 * @returns The builder instance for chaining
	 *
	 * @example
	 * ```typescript
	 * const builder = new MyBuilder({})
	 *   .addValidator(obj => obj.age ? obj.age >= 18 : 'Age must be 18 or older')
	 *   .addValidator(obj => obj.email?.includes('@') || 'Invalid email format')
	 *   .setAge(20)
	 *   .setEmail('user@example.com')
	 *   .build();
	 * ```
	 */
	addValidator(validator: (obj: Partial<T>) => boolean | string): this {
		return this.instantiateBuilder(this._actual, this._requiredFields, [...this._validators, validator]);
	}

	/**
	 * Gets the combined required fields from both the static template and instance-level fields.
	 * @private
	 */
	private getRequiredTemplate(): ReadonlyArray<string> {
		const ctor = this.constructor as typeof CeriosBuilder;
		const staticFields = ctor.requiredTemplate ?? [];

		// Short-circuit the common cases: merging allocates four objects, and one side is
		// almost always empty. Matches CeriosClassBuilder.getRequiredTemplate.
		if (this._requiredFields.size === 0) {
			return staticFields;
		}
		if (staticFields.length === 0) {
			return [...this._requiredFields];
		}
		return [...new Set([...staticFields, ...this._requiredFields])];
	}

	/**
	 * Validates that all fields in the required template have been set.
	 * @private
	 */
	private validateRequiredFields(): string[] {
		const requiredPaths = this.getRequiredTemplate();
		const missing: string[] = [];
		// Mirrors `missing` so the duplicate check below is O(1) instead of a linear scan.
		const seen = new Set<string>();

		for (const path of requiredPaths) {
			const keys = path.split(".");
			let current: unknown = this._actual;

			for (let i = 0; i < keys.length; i++) {
				const key = keys[i];
				if (current === null || current === undefined || typeof current !== "object" || !(key in current)) {
					missing.push(path);
					seen.add(path);
					break;
				}
				current = (current as Record<string, unknown>)[key];
			}

			// Check if the final value is null or undefined
			if (current === null || current === undefined) {
				if (!seen.has(path)) {
					missing.push(path);
					seen.add(path);
				}
			}
		}

		return missing;
	}

	/**
	 * Runs all custom validators and returns any error messages.
	 * @private
	 */
	private runValidators(): string[] {
		return runValidatorsAgainst(this._validators, this._actual);
	}

	/**
	 * Removes an optional property from the builder.
	 * Only works with optional properties (those that can be undefined).
	 *
	 * @template K - The optional property key to remove
	 * @param key - The property key to remove
	 * @returns A new builder instance without the specified property
	 *
	 * @example
	 * ```typescript
	 * const builder = new MyBuilder()
	 *   .setName('John')
	 *   .setEmail('john@example.com')
	 *   .removeOptionalProperty('email');
	 * // Email is now removed from the builder
	 * ```
	 */
	removeOptionalProperty<K extends import("./types").OptionalKeys<T>>(key: K): this {
		const newData = { ...this._actual };
		delete newData[key];
		return this.instantiateBuilder(newData, this._requiredFields, this._validators);
	}

	/**
	 * Clears all optional properties from the builder, keeping only required ones.
	 * Properties in the required template and those marked as required are preserved.
	 *
	 * @returns A new builder instance with only required properties
	 *
	 * @example
	 * ```typescript
	 * const builder = new MyBuilder()
	 *   .setName('John')      // required
	 *   .setAge(30)           // required
	 *   .setEmail('john@example.com')  // optional
	 *   .setPhone('555-1234')          // optional
	 *   .clearOptionalProperties();
	 * // Only name and age remain
	 * ```
	 */
	clearOptionalProperties(): this {
		// Keep only properties in the required template; a nested path keeps its root object.
		const newData = pickRequiredRoots(this._actual, this.getRequiredTemplate());

		return this.instantiateBuilder(newData, this._requiredFields, this._validators);
	}

	/**
	 * Creates a new builder instance. Intended to be called by subclasses.
	 *
	 * @param _actual - The current partial state of the object being built
	 * @param _requiredFields - Optional array of required field paths to preserve across instances
	 * @param _validators - Optional array of validators to preserve across instances
	 * @protected
	 */
	protected constructor(
		protected readonly _actual: Partial<T>,
		_requiredFields?: RequiredFieldsTemplate<T>,
		_validators?: Array<(obj: Partial<T>) => boolean | string>,
	) {
		if (_requiredFields) {
			this._requiredFields = new Set([..._requiredFields] as string[]);
		}
		if (_validators) {
			this._validators = [..._validators];
		}
	}

	/**
	 * Sets a property value and returns a new builder instance with updated type state.
	 * This method is intended to be wrapped by concrete builder methods in subclasses.
	 *
	 * @template K - The property key being set
	 * @param key - The property key to set
	 * @param value - The value to assign to the property
	 * @returns A new builder instance with the property set and type state updated
	 * @protected
	 */
	protected setProperty<K extends keyof T>(key: K, value: T[K]): BuilderStep<this, T, K> {
		assertSafeKey(key);
		return this.instantiateBuilder(
			{
				...this._actual,
				[key]: value,
			},
			this._requiredFields,
			this._validators,
		) as BuilderStep<this, T, K>;
	}

	/**
	 * Sets multiple property values at once and returns a new builder instance with updated type state.
	 * @param props - An object with one or more properties to set.
	 * @returns A new builder instance with the properties set and type state updated.
	 * @protected
	 */
	protected setProperties<K extends keyof T>(props: Pick<T, K>): BuilderStep<this, T, K> {
		Object.keys(props).forEach(assertSafeKey);
		return this.instantiateBuilder(
			{
				...this._actual,
				...props,
			},
			this._requiredFields,
			this._validators,
		) as BuilderStep<this, T, K>;
	}

	/**
	 * Sets a deeply nested property value and returns a new builder instance with updated type state.
	 * This method uses dot notation to set nested properties in a type-safe way.
	 *
	 * @template P - The property path (e.g., "parent.child.grandchild")
	 * @param path - The dot-notation path to the property
	 * @param value - The value to assign to the nested property
	 * @returns A new builder instance with the nested property set
	 * @protected
	 *
	 * @example
	 * ```typescript
	 * builder.setNestedProperty('Order.Details.CustomerId', 'value')
	 * ```
	 */
	protected setNestedProperty<P extends Path<T>>(path: P, value: PathValue<T, P>): BuilderStep<this, T, P> {
		assertSafePath(path as string);
		const keys = (path as string).split(".");
		const newActual = deepClone(this._actual);

		let current = newActual as Record<string, unknown>;
		for (let i = 0; i < keys.length - 1; i++) {
			const key = keys[i];
			const existing = current[key];
			if (!(key in current) || typeof existing !== "object" || existing === null) {
				current[key] = {};
			}
			// No clone here: `newActual` is already a fresh deep clone, so `existing` is
			// private to this builder. Re-cloning made the cost O(depth x size).
			current = current[key] as Record<string, unknown>;
		}

		current[keys[keys.length - 1]] = value;

		return this.instantiateBuilder(newActual, this._requiredFields, this._validators) as BuilderStep<this, T, P>;
	}

	/**
	 * Adds a value to an array property and returns a new builder instance with updated type state.
	 * This method is intended to be wrapped by concrete builder methods in subclasses for array properties.
	 *
	 * @template K - The property key (must be an array property)
	 * @template V - The type of the array element
	 * @param key - The array property key to add to
	 * @param value - The value to add to the array
	 * @returns A new builder instance with the array property updated and type state updated
	 * @protected
	 */
	protected addToArrayProperty<
		K extends { [P in keyof T]: NonNullable<T[P]> extends Array<unknown> ? P : never }[keyof T],
		V extends (T[K] extends Array<infer U> ? U : T[K] extends Array<infer U> | undefined ? U : never),
	>(key: K, value: V): BuilderStep<this, T, K> {
		assertSafeKey(key);
		const currentArray = (this._actual[key] as Array<V> | undefined) ?? [];
		return this.instantiateBuilder(
			{
				...this._actual,
				[key]: [...currentArray, value],
			},
			this._requiredFields,
			this._validators,
		) as BuilderStep<this, T, K>;
	}

	/**
	 * Builds the final object with both compile-time and runtime validation.
	 * This is the recommended and safest way to build objects.
	 *
	 * - Compile-time: TypeScript enforces all required properties are set
	 * - Runtime: Validates all fields in the requiredTemplate
	 *
	 * @returns The fully built object of type T
	 * @throws {Error} If any required field is missing at runtime
	 */
	build(this: this & BuildGate<T>): T {
		this.assertValid("build");

		return this.snapshot();
	}

	/**
	 * Builds the final object with only compile-time validation, skipping runtime checks.
	 * Use this when you want TypeScript safety but need to skip runtime validation for performance.
	 *
	 * - Compile-time: TypeScript enforces all required properties are set
	 * - Runtime: No validation
	 *
	 * @returns The fully built object of type T
	 */
	buildWithoutRuntimeValidation(this: this & BuildGate<T>): T {
		return this.snapshot();
	}

	/**
	 * Builds the final object with only runtime validation, skipping compile-time checks.
	 * Use this when building from external data where compile-time checks aren't possible.
	 *
	 * - Compile-time: No TypeScript enforcement
	 * - Runtime: Validates all fields in the requiredTemplate
	 *
	 * @returns The fully built object of type T
	 * @throws {Error} If any required field is missing at runtime
	 */
	buildWithoutCompileTimeValidation(): T {
		this.assertValid("buildWithoutCompileTimeValidation");

		return this.snapshot();
	}

	/**
	 * Builds the final object without any validation (neither compile-time nor runtime).
	 * Use this only when you're certain the object is valid and need maximum performance.
	 *
	 * - Compile-time: No TypeScript enforcement
	 * - Runtime: No validation
	 *
	 * @returns The object of type T (may be incomplete)
	 */
	buildUnsafe(): T {
		return this.snapshot();
	}

	/**
	 * Builds a partial object, which may not have all required fields set.
	 * This is useful for scenarios where you want to inspect or validate the current state before finalizing.
	 *
	 * @returns The partially built object
	 */
	/**
	 * Runs both runtime checks, throwing on the first failure.
	 *
	 * The single copy of what used to be an identical nine-line block in all six validating
	 * build variants. Centralising it is what lets the thrown error name the method the
	 * caller actually invoked instead of always saying "build".
	 *
	 * @param methodName - The build variant being run, used in the error message
	 * @throws {CeriosBuilderError} If a required field is missing or a validator fails
	 */
	private assertValid(methodName: string): void {
		const missing = this.validateRequiredFields();
		if (missing.length > 0) {
			throw new CeriosBuilderError(
				`Missing required fields: ${missing.join(", ")}. Please set these fields before calling ${methodName}.`,
				missing,
				[],
			);
		}

		const validationErrors = this.runValidators();
		if (validationErrors.length > 0) {
			throw new CeriosBuilderError(`Validation failed: ${validationErrors.join("; ")}`, [], validationErrors);
		}
	}

	/**
	 * Returns the built value as a deep copy.
	 *
	 * Every build variant goes through this. Returning `this._actual` directly - as the
	 * build methods used to - handed the caller the builder's live internal state, so
	 * mutating the result mutated the builder and every object built from it afterwards.
	 * `buildFrozen()` was worse: it froze the builder's own state in place.
	 */
	private snapshot(): T {
		return deepClone(this._actual) as T;
	}

	/**
	 * The single construction seam used by every copy-on-write method.
	 *
	 * By default this calls the subclass constructor with the internal 3-argument shape,
	 * which requires the subclass to accept and forward it. Subclasses whose constructor
	 * has a different signature - such as the auto builders, where users write
	 * `constructor(data?)` - override this to build the copy without invoking a
	 * constructor at all, so the required fields and validators cannot be lost.
	 *
	 * @param data - The state for the new builder
	 * @param requiredFields - Required field paths to carry over
	 * @param validators - Validators to carry over
	 * @returns A new builder instance of the same concrete type
	 */
	protected instantiateBuilder(
		data: Partial<T>,
		requiredFields: RequiredFieldsTemplate<T> | ReadonlySet<string>,
		validators: Array<(obj: Partial<T>) => boolean | string>,
	): this {
		const BuilderClass = this.constructor as new (
			data: Partial<T>,
			requiredFields?: RequiredFieldsTemplate<T>,
			validators?: Array<(obj: Partial<T>) => boolean | string>,
		) => this;
		// Callers pass the internal Set directly to avoid a Set -> Array -> Set round trip on
		// every setter; the constructor only needs something iterable.
		const asTemplate = (
			requiredFields instanceof Set ? [...requiredFields] : requiredFields
		) as RequiredFieldsTemplate<T>;
		return new BuilderClass(data, asTemplate, validators);
	}

	buildPartial(): Partial<T> {
		// Deep-copied, not returned live: a shallow spread still let a caller reach into a
		// nested object and mutate the builder through it.
		return deepClone(this._actual);
	}

	/**
	 * Creates a new builder instance from an existing object.
	 * This is useful for creating builders from existing instances to modify them.
	 *
	 * @param instance - The existing object to create a builder from
	 * @returns A new builder instance initialized with the object's data
	 *
	 * @example
	 * ```typescript
	 * const existingPerson = { name: 'John', age: 30 };
	 * const builder = MyBuilder.from(existingPerson);
	 * const updated = builder.setAge(31).build();
	 * ```
	 */
	// The brand marks every property as set, matching `AutoBuilderConstructor.from`: seeding
	// from a complete object yields a buildable builder, so callers no longer have to fall
	// back to `buildUnsafe()`.
	//
	// The subclass must declare a public constructor. TypeScript has no way to write "a
	// constructor that may be protected" in a `this` constraint, so widening to
	// `abstract new` does not help - the auto builders avoid this only because their `from`
	// is a declared type rather than a real class static.
	static from<T extends object, B extends new (data: Partial<T>) => unknown>(
		this: B,
		instance: T,
	): InstanceType<B> & InternalBuilderBrand<T>;
	static from<T extends object, B extends new (data: Partial<T>) => unknown>(this: B, instance: T): InstanceType<B> {
		const clonedData = deepClone(instance);
		return new this(clonedData) as InstanceType<B>;
	}

	/**
	 * Creates a clone of the current builder instance.
	 * The clone has the same state but is independent - changes to one won't affect the other.
	 *
	 * @returns A new builder instance with the same state
	 *
	 * @example
	 * ```typescript
	 * const builder1 = new MyBuilder({}).setName('John');
	 * const builder2 = builder1.clone();
	 * // builder2 is independent of builder1
	 * ```
	 */
	clone(): this {
		const clonedData = deepClone(this._actual);
		return this.instantiateBuilder(clonedData, this._requiredFields, this._validators);
	}

	/**
	 * Builds and freezes the final object with both compile-time and runtime validation.
	 * The returned object is shallowly frozen - top-level properties cannot be modified,
	 * but nested objects remain mutable.
	 *
	 * - Compile-time: TypeScript enforces all required properties are set
	 * - Runtime: Validates all fields in the requiredTemplate and applies Object.freeze()
	 *
	 * @returns The frozen object of type Readonly<T>
	 * @throws {Error} If any required field is missing at runtime
	 */
	buildFrozen(this: this & BuildGate<T>): Readonly<T> {
		this.assertValid("buildFrozen");

		return Object.freeze(this.snapshot());
	}

	/**
	 * Builds and deeply freezes the final object with both compile-time and runtime validation.
	 * The returned object is recursively frozen - all nested objects and arrays are also frozen.
	 *
	 * - Compile-time: TypeScript enforces all required properties are set
	 * - Runtime: Validates all fields in the requiredTemplate and recursively applies Object.freeze()
	 *
	 * @returns The deeply frozen object of type DeepReadonly<T>
	 * @throws {Error} If any required field is missing at runtime
	 */
	buildDeepFrozen(this: this & BuildGate<T>): DeepReadonly<T> {
		this.assertValid("buildDeepFrozen");

		return deepHarden(this.snapshot(), "freeze") as DeepReadonly<T>;
	}

	/**
	 * Builds and seals the final object with both compile-time and runtime validation.
	 * The returned object is shallowly sealed - properties cannot be added or removed,
	 * but existing properties can still be modified. Nested objects remain unsealed.
	 *
	 * - Compile-time: TypeScript enforces all required properties are set
	 * - Runtime: Validates all fields in the requiredTemplate and applies Object.seal()
	 *
	 * @returns The sealed object of type T
	 * @throws {Error} If any required field is missing at runtime
	 */
	buildSealed(this: this & BuildGate<T>): T {
		this.assertValid("buildSealed");

		return Object.seal(this.snapshot());
	}

	/**
	 * Builds and deeply seals the final object with both compile-time and runtime validation.
	 * The returned object is recursively sealed - properties cannot be added or removed at any level,
	 * but existing properties can still be modified.
	 *
	 * - Compile-time: TypeScript enforces all required properties are set
	 * - Runtime: Validates all fields in the requiredTemplate and recursively applies Object.seal()
	 *
	 * @returns The deeply sealed object of type T
	 * @throws {Error} If any required field is missing at runtime
	 */
	buildDeepSealed(this: this & BuildGate<T>): T {
		this.assertValid("buildDeepSealed");

		return deepHarden(this.snapshot(), "seal");
	}
}
