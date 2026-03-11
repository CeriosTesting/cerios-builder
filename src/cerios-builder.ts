// oxlint-disable typescript/no-deprecated
import { DeepReadonly } from "./types";

/**
 * Unique symbol used internally to brand types and track which properties have been set in the builder's type.
 *
 * @internal
 */
declare const __brand: unique symbol;

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
export type CeriosBrand<T> = { [__brand]: T };

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
export type BuilderStep<B, T extends object, S extends keyof T | Path<T>> = B & CeriosBrand<Pick<T, StepKey<T, S>>>;

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

type BuilderBaseFromFactoryReturn<R> = R extends (infer B) & CeriosBrand<unknown> ? B : R;

type BuilderTargetFromFactoryReturn<R> = BuilderBaseFromFactoryReturn<R> extends CeriosBuilder<infer T> ? T : never;

/**
 * Helper type for composition callbacks based on a builder factory method.
 *
 * This infers both the callback input type (including presets/defaults) and the
 * fully-buildable output type directly from the factory return type.
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
type PathValue<T, P> = P extends keyof T
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
 * Recursively freezes an object and all its nested properties.
 * @param obj - The object to freeze
 * @returns The frozen object
 * @internal
 */
function deepFreeze<T>(obj: T): T {
	// Retrieve the property names defined on obj
	Object.getOwnPropertyNames(obj).forEach((prop) => {
		const value = (obj as Record<string, unknown>)[prop];

		// Freeze properties before freezing self
		if (value !== null && (typeof value === "object" || typeof value === "function")) {
			deepFreeze(value);
		}
	});

	return Object.freeze(obj);
}

/**
 * Recursively seals an object and all its nested properties.
 * @param obj - The object to seal
 * @returns The sealed object
 * @internal
 */
function deepSeal<T>(obj: T): T {
	// Retrieve the property names defined on obj
	Object.getOwnPropertyNames(obj).forEach((prop) => {
		const value = (obj as Record<string, unknown>)[prop];

		// Seal properties before sealing self
		if (value !== null && (typeof value === "object" || typeof value === "function")) {
			deepSeal(value);
		}
	});

	return Object.seal(obj);
}

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
	setRequiredFields(fields: ReadonlyArray<Path<T>>): this {
		this._requiredFields = new Set([...fields] as string[]);
		return this;
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
		const BuilderClass = this.constructor as new (
			data: Partial<T>,
			requiredFields?: RequiredFieldsTemplate<T>,
			validators?: Array<(obj: Partial<T>) => boolean | string>,
		) => this;
		return new BuilderClass(this._actual, Array.from(this._requiredFields) as unknown as RequiredFieldsTemplate<T>, [
			...this._validators,
			validator,
		]);
	}

	/**
	 * Gets the combined required fields from both the static template and instance-level fields.
	 * @private
	 */
	private getRequiredTemplate(): ReadonlyArray<string> {
		const ctor = this.constructor as typeof CeriosBuilder;
		const staticFields = ctor.requiredTemplate ?? [];
		const instanceFields = Array.from(this._requiredFields);

		// Combine and deduplicate
		return [...new Set([...staticFields, ...instanceFields])];
	}

	/**
	 * Validates that all fields in the required template have been set.
	 * @private
	 */
	private validateRequiredFields(): string[] {
		const requiredPaths = this.getRequiredTemplate();
		const missing: string[] = [];

		for (const path of requiredPaths) {
			const keys = path.split(".");
			let current: unknown = this._actual;

			for (let i = 0; i < keys.length; i++) {
				const key = keys[i];
				if (current === null || current === undefined || typeof current !== "object" || !(key in current)) {
					missing.push(path);
					break;
				}
				current = (current as Record<string, unknown>)[key];
			}

			// Check if the final value is null or undefined
			if (current === null || current === undefined) {
				if (!missing.includes(path)) {
					missing.push(path);
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
		const errors: string[] = [];

		for (const validator of this._validators) {
			const result = validator(this._actual);
			if (result === false) {
				errors.push("Validation failed");
			} else if (typeof result === "string") {
				errors.push(result);
			}
			// If result is true, validation passed
		}

		return errors;
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
		const BuilderClass = this.constructor as new (
			data: Partial<T>,
			requiredFields?: RequiredFieldsTemplate<T>,
			validators?: Array<(obj: Partial<T>) => boolean | string>,
		) => this;
		const newData = { ...this._actual };
		delete newData[key];
		return new BuilderClass(
			newData,
			Array.from(this._requiredFields) as unknown as RequiredFieldsTemplate<T>,
			this._validators,
		);
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
		const BuilderClass = this.constructor as new (
			data: Partial<T>,
			requiredFields?: RequiredFieldsTemplate<T>,
			validators?: Array<(obj: Partial<T>) => boolean | string>,
		) => this;
		const requiredPaths = this.getRequiredTemplate();
		const newData: Partial<T> = {};

		// Keep only properties that are in the required template
		for (const path of requiredPaths) {
			const keys = path.split(".");
			if (keys.length === 1) {
				const key = keys[0] as keyof T;
				if (key in this._actual) {
					newData[key] = this._actual[key];
				}
			} else {
				// For nested paths, preserve the root object if it exists
				const rootKey = keys[0] as keyof T;
				if (rootKey in this._actual && !(rootKey in newData)) {
					newData[rootKey] = this._actual[rootKey];
				}
			}
		}

		return new BuilderClass(
			newData,
			Array.from(this._requiredFields) as unknown as RequiredFieldsTemplate<T>,
			this._validators,
		);
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
		const BuilderClass = this.constructor as new (
			data: Partial<T>,
			requiredFields?: RequiredFieldsTemplate<T>,
			validators?: Array<(obj: Partial<T>) => boolean | string>,
		) => this;
		return new BuilderClass(
			{
				...this._actual,
				[key]: value,
			},
			Array.from(this._requiredFields) as unknown as RequiredFieldsTemplate<T>,
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
		const BuilderClass = this.constructor as new (
			data: Partial<T>,
			requiredFields?: RequiredFieldsTemplate<T>,
			validators?: Array<(obj: Partial<T>) => boolean | string>,
		) => this;
		return new BuilderClass(
			{
				...this._actual,
				...props,
			},
			Array.from(this._requiredFields) as unknown as RequiredFieldsTemplate<T>,
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
		const BuilderClass = this.constructor as new (
			data: Partial<T>,
			requiredFields?: RequiredFieldsTemplate<T>,
			validators?: Array<(obj: Partial<T>) => boolean | string>,
		) => this;
		const keys = (path as string).split(".");
		const newActual = this.deepClone(this._actual);

		let current = newActual as Record<string, unknown>;
		for (let i = 0; i < keys.length - 1; i++) {
			const key = keys[i];
			const existing = current[key];
			if (!(key in current) || typeof existing !== "object" || existing === null) {
				current[key] = {};
			} else {
				current[key] = this.deepClone(existing);
			}
			current = current[key] as Record<string, unknown>;
		}

		current[keys[keys.length - 1]] = value as unknown;

		return new BuilderClass(
			newActual,
			Array.from(this._requiredFields) as unknown as RequiredFieldsTemplate<T>,
			this._validators,
		) as BuilderStep<this, T, P>;
	}

	/**
	 * Deep clone helper for nested objects
	 * @private
	 */
	private deepClone<V>(obj: V): V {
		if (obj === null || typeof obj !== "object") {
			return obj;
		}
		if (Array.isArray(obj)) {
			return obj.map((item) => this.deepClone(item)) as unknown as V;
		}
		const cloned: Record<string, unknown> = {};
		for (const key in obj) {
			if (Object.prototype.hasOwnProperty.call(obj, key)) {
				cloned[key] = this.deepClone((obj as Record<string, unknown>)[key]);
			}
		}
		return cloned as V;
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
		V extends T[K] extends Array<infer U> ? U : T[K] extends Array<infer U> | undefined ? U : never,
	>(key: K, value: V): BuilderStep<this, T, K> {
		const BuilderClass = this.constructor as new (
			data: Partial<T>,
			requiredFields?: RequiredFieldsTemplate<T>,
			validators?: Array<(obj: Partial<T>) => boolean | string>,
		) => this;
		const currentArray = (this._actual[key] as Array<V> | undefined) ?? [];
		return new BuilderClass(
			{
				...this._actual,
				[key]: [...currentArray, value],
			},
			Array.from(this._requiredFields) as unknown as RequiredFieldsTemplate<T>,
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
	build(this: this & CeriosBrand<T>): T {
		const missing = this.validateRequiredFields();
		if (missing.length > 0) {
			throw new Error(`Missing required fields: ${missing.join(", ")}. Please set these fields before calling build.`);
		}

		const validationErrors = this.runValidators();
		if (validationErrors.length > 0) {
			throw new Error(`Validation failed: ${validationErrors.join("; ")}`);
		}

		return this._actual as T;
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
	buildWithoutRuntimeValidation(this: this & CeriosBrand<T>): T {
		return this._actual as T;
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
		const missing = this.validateRequiredFields();

		if (missing.length > 0) {
			throw new Error(`Missing required fields: ${missing.join(", ")}. Please set these fields before calling build.`);
		}

		const validationErrors = this.runValidators();
		if (validationErrors.length > 0) {
			throw new Error(`Validation failed: ${validationErrors.join("; ")}`);
		}

		return this._actual as T;
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
		return this._actual as T;
	}

	/**
	 * Builds a partial object, which may not have all required fields set.
	 * This is useful for scenarios where you want to inspect or validate the current state before finalizing.
	 *
	 * @returns The partially built object
	 */
	buildPartial(): Partial<T> {
		return this._actual;
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
	static from<T extends object, B extends new (data: Partial<T>) => unknown>(this: B, instance: T): InstanceType<B> {
		const clonedData = CeriosBuilder.deepCloneStatic(instance);
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
		const BuilderClass = this.constructor as new (
			data: Partial<T>,
			requiredFields?: RequiredFieldsTemplate<T>,
			validators?: Array<(obj: Partial<T>) => boolean | string>,
		) => this;
		const clonedData = this.deepClone(this._actual);
		return new BuilderClass(
			clonedData,
			Array.from(this._requiredFields) as unknown as RequiredFieldsTemplate<T>,
			this._validators,
		);
	}

	/**
	 * Static deep clone helper for the from() method.
	 * @private
	 */
	private static deepCloneStatic<V>(obj: V): V {
		if (obj === null || typeof obj !== "object") {
			return obj;
		}
		if (Array.isArray(obj)) {
			return obj.map((item) => this.deepCloneStatic(item)) as unknown as V;
		}
		const cloned: Record<string, unknown> = {};
		for (const key in obj) {
			if (Object.prototype.hasOwnProperty.call(obj, key)) {
				cloned[key] = this.deepCloneStatic((obj as Record<string, unknown>)[key]);
			}
		}
		return cloned as V;
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
	buildFrozen(this: this & CeriosBrand<T>): Readonly<T> {
		const missing = this.validateRequiredFields();
		if (missing.length > 0) {
			throw new Error(`Missing required fields: ${missing.join(", ")}. Please set these fields before calling build.`);
		}

		const validationErrors = this.runValidators();
		if (validationErrors.length > 0) {
			throw new Error(`Validation failed: ${validationErrors.join("; ")}`);
		}

		return Object.freeze(this._actual as T);
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
	buildDeepFrozen(this: this & CeriosBrand<T>): DeepReadonly<T> {
		const missing = this.validateRequiredFields();
		if (missing.length > 0) {
			throw new Error(`Missing required fields: ${missing.join(", ")}. Please set these fields before calling build.`);
		}

		const validationErrors = this.runValidators();
		if (validationErrors.length > 0) {
			throw new Error(`Validation failed: ${validationErrors.join("; ")}`);
		}

		return deepFreeze(this._actual as T) as DeepReadonly<T>;
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
	buildSealed(this: this & CeriosBrand<T>): T {
		const missing = this.validateRequiredFields();
		if (missing.length > 0) {
			throw new Error(`Missing required fields: ${missing.join(", ")}. Please set these fields before calling build.`);
		}

		const validationErrors = this.runValidators();
		if (validationErrors.length > 0) {
			throw new Error(`Validation failed: ${validationErrors.join("; ")}`);
		}

		return Object.seal(this._actual as T);
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
	buildDeepSealed(this: this & CeriosBrand<T>): T {
		const missing = this.validateRequiredFields();
		if (missing.length > 0) {
			throw new Error(`Missing required fields: ${missing.join(", ")}. Please set these fields before calling build.`);
		}

		const validationErrors = this.runValidators();
		if (validationErrors.length > 0) {
			throw new Error(`Validation failed: ${validationErrors.join("; ")}`);
		}

		return deepSeal(this._actual as T);
	}
}
