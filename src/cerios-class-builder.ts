// oxlint-disable typescript/no-deprecated
import type { DeepReadonly } from "./types";

/**
 * Type representing a class constructor that can be instantiated with optional partial data.
 * @template T - The type that the constructor creates
 */
export type ClassConstructor<T> = new (data?: Partial<T>) => T;

/**
 * Helper to extract only data properties (exclude methods) from a class type.
 * This allows compile-time validation to work properly with classes.
 */
type DataPropertiesOnly<T> = {
	[K in keyof T as T[K] extends (...args: unknown[]) => unknown ? never : K]: T[K];
};

/**
 * Internal brand for class-builder type-state tracking.
 * Prefer helper aliases like `ClassBuilderStep` in public APIs.
 */
type InternalClassBrand<T> = {
	readonly __classBuilderBrand: T;
};

/**
 * Brand type specifically for class builders that only tracks data properties.
 *
 * @deprecated Prefer `ClassBuilderStep`, `ClassBuilderPreset`, `ClassBuilderComposer`,
 * or `ClassBuilderComposerFromFactory` in user-facing APIs.
 * This type remains exported for backward compatibility.
 */
export type CeriosClassBrand<T> = InternalClassBrand<T>;

type RootFromPath<P extends string> = P extends `${infer K}.${string}` ? K : P;

type ClassStepKey<T extends object, S extends keyof T | ClassPath<T>> = S extends keyof T
	? Extract<S, keyof DataPropertiesOnly<T>>
	: Extract<RootFromPath<S & string>, keyof DataPropertiesOnly<T>>;

/**
 * Helper type for fluent class-builder methods.
 * Supports both direct data-property keys ("name") and nested paths ("address.city").
 *
 * @template B - The current builder instance type (usually `this`)
 * @template T - The class type being built
 * @template S - A data-property key or class path
 */
export type ClassBuilderStep<B, T extends object, S extends keyof T | ClassPath<T>> = B &
	InternalClassBrand<Pick<DataPropertiesOnly<T>, ClassStepKey<T, S>>>;

/**
 * Helper type for factory methods that return a preconfigured class-builder state.
 *
 * @template B - The class-builder instance type
 * @template T - The class type being built
 * @template S - A data-property key or class path (or union) configured by the factory
 */
export type ClassBuilderPreset<
	B,
	T extends object,
	S extends keyof DataPropertiesOnly<T> | ClassPath<T>,
> = ClassBuilderStep<B, T, S>;

/**
 * Helper type for callback-based class-builder composition APIs.
 *
 * @template B - The class-builder instance type
 * @template T - The class type being built
 * @template Preset - Optional preset key/path union already configured before callback execution
 */
export type ClassBuilderComposer<
	B,
	T extends object,
	Preset extends keyof DataPropertiesOnly<T> | ClassPath<T> = never,
> = (
	builder: [Preset] extends [never] ? B : ClassBuilderPreset<B, T, Preset>,
) => ClassBuilderPreset<B, T, keyof DataPropertiesOnly<T>>;

type ClassBuilderBaseFromFactoryReturn<R> = R extends (infer B) & InternalClassBrand<unknown> ? B : R;

type ClassBuilderTargetFromFactoryReturn<R> =
	ClassBuilderBaseFromFactoryReturn<R> extends CeriosClassBuilder<infer T> ? T : never;

/**
 * Helper type for composition callbacks based on a class-builder factory method.
 *
 * This infers both the callback input type (including presets/defaults) and the
 * fully-buildable output type directly from the factory return type.
 *
 * @template F - A class-builder factory function type (for example: `typeof MyBuilder.createWithDefaults`)
 */
export type ClassBuilderComposerFromFactory<F extends (...args: never[]) => unknown> = (
	builder: ReturnType<F>,
) => ClassBuilderPreset<
	ClassBuilderBaseFromFactoryReturn<ReturnType<F>>,
	ClassBuilderTargetFromFactoryReturn<ReturnType<F>>,
	keyof DataPropertiesOnly<ClassBuilderTargetFromFactoryReturn<ReturnType<F>>>
>;

/**
 * Helper type to represent a path through an object structure for class properties.
 * Only considers data properties (excludes methods).
 * Handles optional properties by unwrapping them with NonNullable.
 * @internal
 */
type PathImpl<T, K extends keyof DataPropertiesOnly<T> = keyof DataPropertiesOnly<T>> = K extends string | number
	? NonNullable<DataPropertiesOnly<T>[K]> extends object
		? NonNullable<DataPropertiesOnly<T>[K]> extends Array<unknown>
			? K
			: K | `${K}.${PathImpl<NonNullable<DataPropertiesOnly<T>[K]>> & string}`
		: K
	: never;

/**
 * Type representing valid dot-notation paths through class data properties.
 * @template T - The class type
 */
export type ClassPath<T> = PathImpl<T>;

/**
 * Helper type to get the value at a specific path in a class, handling optional properties.
 * Only considers data properties (excludes methods).
 * @template T - The class type
 * @template P - The path string
 * @internal
 */
type ClassPathValue<T, P> = P extends keyof DataPropertiesOnly<T>
	? DataPropertiesOnly<T>[P]
	: P extends `${infer K}.${infer Rest}`
		? K extends keyof DataPropertiesOnly<T>
			? ClassPathValue<NonNullable<DataPropertiesOnly<T>[K]>, Rest>
			: never
		: never;

/**
 * Type-safe builder specifically designed for classes.
 * This builder automatically instantiates the target class and provides:
 * - Compile-time validation that works with class methods
 * - Automatic runtime validation of nested class instances
 * - Preservation of decorators and class methods
 *
 * Example usage:
 * ```typescript
 * class Person {
 *   name!: string;
 *   age!: number;
 *   email?: string;
 *
 *   constructor(data?: Partial<Person>) {
 *     if (data) Object.assign(this, data);
 *   }
 *
 *   greet() { return `Hello, I'm ${this.name}`; }
 * }
 *
 * const builder = new CeriosClassBuilder(Person);
 * const person = builder
 *   .setProperty('name', 'John')
 *   .setProperty('age', 30)
 *   .build();
 * ```
 *
 * @template T - The class type being built
 */
export class CeriosClassBuilder<T extends object> {
	/**
	 * Optional static template defining which data properties are required.
	 * Subclasses can set this to specify required fields, which will be preserved
	 * when calling clearOptionalProperties().
	 *
	 * @deprecated Prefer passing required fields via subclass constructor and `super(...)`
	 * or setting them at runtime with `setRequiredFields()`.
	 *
	 * @example
	 * ```typescript
	 * class PersonBuilder extends CeriosClassBuilder<Person> {
	 *   static requiredDataProperties = ['name', 'age'] as const;
	 * }
	 * ```
	 */
	static requiredDataProperties?: ReadonlyArray<string>;

	/**
	 * The class constructor to instantiate when building.
	 * @private
	 */
	private readonly _classConstructor: ClassConstructor<T>;

	/**
	 * The current partial state of the object being built.
	 * @private
	 */
	protected readonly _actual: Partial<T>;

	/**
	 * Custom validators that run during build.
	 * @private
	 */
	private _validators: Array<(obj: Partial<T>) => boolean | string> = [];

	/**
	 * Instance-level required fields that can be populated dynamically.
	 * This allows adding required fields at runtime via the setRequiredFields method.
	 * @private
	 */
	private _requiredFields: Set<string> = new Set();

	/**
	 * Creates a new class builder instance.
	 * @param classConstructor - The class constructor to use for building
	 * @param data - Optional initial data
	 * @param _validators - Optional array of validators to preserve across instances
	 * @param _requiredFields - Optional required fields to preserve across instances
	 */
	protected constructor(
		classConstructor: ClassConstructor<T>,
		data: Partial<T> = {},
		_validators?: Array<(obj: Partial<T>) => boolean | string>,
		_requiredFields?: ReadonlyArray<ClassPath<T>> | Set<string>,
	) {
		this._classConstructor = classConstructor;
		this._actual = data;
		if (_validators) {
			this._validators = [..._validators];
		}
		if (_requiredFields) {
			this._requiredFields =
				_requiredFields instanceof Set ? new Set(_requiredFields) : new Set([..._requiredFields] as string[]);
		}
	}

	/**
	 * Gets the class constructor for this builder.
	 * @private
	 */
	private getClassConstructor(): ClassConstructor<T> {
		return this._classConstructor;
	}

	/**
	 * Creates a new instance of the builder with updated data.
	 * Subclasses can override this to return the correct subclass type.
	 * @private
	 */
	private createBuilder(data: Partial<T>): this {
		const BuilderClass = this.constructor as new (
			classConstructor: ClassConstructor<T>,
			data: Partial<T>,
			validators?: Array<(obj: Partial<T>) => boolean | string>,
			requiredFields?: ReadonlyArray<ClassPath<T>> | Set<string>,
		) => this;
		return new BuilderClass(this._classConstructor, data, this._validators, this._requiredFields);
	}

	/**
	 * Sets a property value and returns a new builder instance with updated type state.
	 * @template K - The property key being set
	 * @param key - The property key to set
	 * @param value - The value to assign to the property
	 * @returns A new builder instance with the property set
	 * @protected
	 */
	protected setProperty<K extends keyof DataPropertiesOnly<T>>(
		key: K,
		value: DataPropertiesOnly<T>[K],
	): ClassBuilderStep<this, T, K>;
	/**
	 * Fallback overload for generic subclass scenarios where TypeScript cannot
	 * resolve `keyof DataPropertiesOnly<T>` from a literal key.
	 * This keeps fluent APIs ergonomic in shared generic base builders.
	 * @protected
	 */
	protected setProperty<K extends keyof T & string>(key: K, value: T[K]): ClassBuilderStep<this, T, K>;
	protected setProperty<K extends keyof DataPropertiesOnly<T>>(
		key: K,
		value: DataPropertiesOnly<T>[K],
	): ClassBuilderStep<this, T, K>;
	protected setProperty<K extends keyof T & string>(key: K, value: T[K]): ClassBuilderStep<this, T, K> {
		const newBuilder = this.createBuilder({
			...this._actual,
			[key]: value,
		} as Partial<T>);
		return newBuilder as ClassBuilderStep<this, T, K>;
	}

	/**
	 * Sets multiple properties at once.
	 * @template K - The property keys being set
	 * @param props - Object with properties to set
	 * @returns A new builder instance with the properties set
	 * @protected
	 */
	protected setProperties<K extends keyof DataPropertiesOnly<T>>(
		props: Pick<DataPropertiesOnly<T>, K>,
	): ClassBuilderStep<this, T, K> {
		const newBuilder = this.createBuilder({
			...this._actual,
			...props,
		} as Partial<T>);
		return newBuilder as ClassBuilderStep<this, T, K>;
	}

	/**
	 * Sets a deeply nested property value and returns a new builder instance with updated type state.
	 * This method uses dot notation to set nested properties in a type-safe way.
	 * Only supports data properties (excludes methods).
	 *
	 * @template P - The property path (e.g., "address.city")
	 * @param path - The dot-notation path to the property
	 * @param value - The value to assign to the nested property
	 * @returns A new builder instance with the nested property set
	 * @protected
	 *
	 * @example
	 * ```typescript
	 * class Address {
	 *   street!: string;
	 *   city!: string;
	 * }
	 * class Person {
	 *   name!: string;
	 *   address!: Address;
	 * }
	 * const builder = new CeriosClassBuilder(Person);
	 * const person = builder
	 *   .setNestedProperty('address.city', 'New York')
	 *   .build();
	 * ```
	 */
	protected setNestedProperty<P extends ClassPath<T>>(
		path: P,
		value: ClassPathValue<T, P>,
	): ClassBuilderStep<this, T, P> {
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

		const newBuilder = this.createBuilder(newActual);
		return newBuilder as ClassBuilderStep<this, T, P>;
	}

	/**
	 * Sets the required fields for this builder instance.
	 * This allows you to dynamically define which fields are required.
	 *
	 * @param fields - Array of dot-notation paths to required fields
	 * @returns The builder instance for chaining
	 *
	 * @example
	 * ```typescript
	 * const builder = PersonBuilder.create()
	 *   .setRequiredFields(['name', 'age'])
	 *   .setProperty('name', 'John')
	 *   .setProperty('age', 30)
	 *   .buildWithoutCompileTimeValidation();
	 * ```
	 */
	setRequiredFields(fields: ReadonlyArray<ClassPath<T>>): this {
		const BuilderClass = this.constructor as new (
			classConstructor: ClassConstructor<T>,
			data: Partial<T>,
			validators?: Array<(obj: Partial<T>) => boolean | string>,
			requiredFields?: ReadonlyArray<ClassPath<T>> | Set<string>,
		) => this;
		return new BuilderClass(this._classConstructor, this._actual, this._validators, new Set([...fields] as string[]));
	}

	/**
	 * Gets the combined required fields from both the static template and instance-level fields.
	 * If instance-level fields are set via setRequiredFields(), they are combined with static fields.
	 * @private
	 */
	private getRequiredTemplate(): ReadonlyArray<string> {
		const ctor = this.constructor as typeof CeriosClassBuilder;
		const staticFields = ctor.requiredDataProperties ?? [];
		const instanceFields = Array.from(this._requiredFields);

		// If instance fields are explicitly set and not empty, combine with static
		// Otherwise just use static fields
		if (instanceFields.length > 0) {
			return [...new Set([...staticFields, ...instanceFields])];
		}
		return staticFields;
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
	 * Adds a custom validator function that will be executed during build.
	 * Validators can return true for valid, false for invalid, or a string error message.
	 * Multiple validators can be added and all will be checked.
	 *
	 * @param validator - Function that validates the partial object
	 * @returns The builder instance for chaining
	 *
	 * @example
	 * ```typescript
	 * const builder = PersonBuilder.create()
	 *   .addValidator(obj => obj.age ? obj.age >= 18 : 'Age must be 18 or older')
	 *   .addValidator(obj => obj.email?.includes('@') || 'Invalid email format')
	 *   .setProperty('age', 20)
	 *   .setProperty('email', 'user@example.com')
	 *   .build();
	 * ```
	 */
	addValidator(validator: (obj: Partial<T>) => boolean | string): this {
		const BuilderClass = this.constructor as new (
			classConstructor: ClassConstructor<T>,
			data: Partial<T>,
			validators?: Array<(obj: Partial<T>) => boolean | string>,
			requiredFields?: ReadonlyArray<ClassPath<T>> | Set<string>,
		) => this;
		return new BuilderClass(
			this._classConstructor,
			this._actual,
			[...this._validators, validator],
			this._requiredFields,
		);
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
	 * Only works with optional data properties (those that can be undefined).
	 * Methods are automatically excluded.
	 *
	 * @template K - The optional property key to remove
	 * @param key - The property key to remove
	 * @returns A new builder instance without the specified property
	 *
	 * @example
	 * ```typescript
	 * class Person {
	 *   name!: string;
	 *   email?: string;
	 * }
	 * const builder = PersonBuilder.create()
	 *   .setProperty('name', 'John')
	 *   .setProperty('email', 'john@example.com')
	 *   .removeOptionalProperty('email');
	 * // Email is now removed from the builder
	 * ```
	 */
	removeOptionalProperty<K extends import("./types").OptionalKeys<DataPropertiesOnly<T>>>(key: K): this {
		const newData = { ...this._actual };
		delete newData[key as keyof T];
		return this.createBuilder(newData);
	}

	/**
	 * Clears all optional properties from the builder, keeping only required data properties.
	 * Uses the combined required-field template from static defaults and instance-level fields.
	 * If no required fields are configured, all properties are cleared.
	 *
	 * @returns A new builder instance with only required properties
	 *
	 * @example
	 * ```typescript
	 * class Person {
	 *   name!: string;      // required
	 *   age!: number;       // required
	 *   email?: string;     // optional
	 *   phone?: string;     // optional
	 * }
	 * class PersonBuilder extends CeriosClassBuilder<Person> {
	 *   static requiredDataProperties = ['name', 'age'] as const;
	 * }
	 * const builder = PersonBuilder.create()
	 *   .setProperty('name', 'John')
	 *   .setProperty('age', 30)
	 *   .setProperty('email', 'john@example.com')
	 *   .setProperty('phone', '555-1234')
	 *   .clearOptionalProperties();
	 * // Only name and age are preserved, email and phone are cleared
	 * ```
	 */
	clearOptionalProperties(): this {
		const requiredProps = this.getRequiredTemplate();
		const newData: Partial<T> = {};

		// Preserve only properties that are in the required list
		for (const prop of requiredProps) {
			const key = prop as keyof T;
			if (key in this._actual) {
				newData[key] = this._actual[key];
			}
		}

		return this.createBuilder(newData);
	}

	/**
	 * Adds a value to an array property.
	 * @template K - The array property key
	 * @template V - The array element type
	 * @param key - The array property key
	 * @param value - The value to add to the array
	 * @returns A new builder instance with the value added
	 */
	addToArrayProperty<
		K extends {
			[P in keyof DataPropertiesOnly<T>]: NonNullable<DataPropertiesOnly<T>[P]> extends Array<unknown> ? P : never;
		}[keyof DataPropertiesOnly<T>],
		V extends DataPropertiesOnly<T>[K] extends Array<infer U>
			? U
			: DataPropertiesOnly<T>[K] extends Array<infer U> | undefined
				? U
				: never,
	>(key: K, value: V): ClassBuilderStep<this, T, K> {
		const currentArray = (this._actual[key as keyof T] as Array<V> | undefined) ?? [];
		const newBuilder = this.createBuilder({
			...this._actual,
			[key]: [...currentArray, value],
		} as Partial<T>);
		return newBuilder as ClassBuilderStep<this, T, K>;
	}

	/**
	 * Builds the final class instance with compile-time and runtime validation.
	 * - Compile-time: TypeScript enforces all data properties are set
	 * - Runtime: Validates required fields and custom validators
	 *
	 * @returns The fully built and validated class instance
	 * @throws {Error} If required fields are missing or validation fails
	 */
	build(this: this & InternalClassBrand<DataPropertiesOnly<T>>): T {
		const missing = this.validateRequiredFields();
		if (missing.length > 0) {
			throw new Error(`Missing required fields: ${missing.join(", ")}. Please set these fields before calling build.`);
		}

		const validationErrors = this.runValidators();
		if (validationErrors.length > 0) {
			throw new Error(`Validation failed: ${validationErrors.join("; ")}`);
		}

		const ctor = this.getClassConstructor();
		const instance: T = new ctor(this._actual as T);
		// If the class does not assign properties in the constructor, assign them manually
		const dataKeys = Object.keys(this._actual) as (keyof T)[];
		const needsAssign = dataKeys.some((key) => instance[key] === undefined && this._actual[key] !== undefined);
		if (needsAssign) {
			Object.assign(instance, this._actual);
		}
		return instance;
	}

	/**
	 * Builds the final class instance with only compile-time validation, skipping runtime checks.
	 * Use this when you want TypeScript safety but need to skip runtime validation for performance.
	 *
	 * - Compile-time: TypeScript enforces all data properties are set
	 * - Runtime: No validation
	 *
	 * @returns The fully built class instance
	 */
	buildWithoutRuntimeValidation(this: this & InternalClassBrand<DataPropertiesOnly<T>>): T {
		const ctor = this.getClassConstructor();
		const instance: T = new ctor(this._actual as T);
		// If the class does not assign properties in the constructor, assign them manually
		const dataKeys = Object.keys(this._actual) as (keyof T)[];
		const needsAssign = dataKeys.some((key) => instance[key] === undefined && this._actual[key] !== undefined);
		if (needsAssign) {
			Object.assign(instance, this._actual);
		}
		return instance;
	}

	/**
	 * Builds the final class instance with only runtime validation, skipping compile-time checks.
	 * Use this when building from external data where compile-time checks aren't possible.
	 *
	 * - Compile-time: No TypeScript enforcement
	 * - Runtime: Validates required fields and custom validators
	 *
	 * @returns The fully built class instance
	 * @throws {Error} If required fields are missing or validation fails
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

		const ctor = this.getClassConstructor();
		const instance: T = new ctor(this._actual as T);
		// If the class does not assign properties in the constructor, assign them manually
		const dataKeys = Object.keys(this._actual) as (keyof T)[];
		const needsAssign = dataKeys.some((key) => instance[key] === undefined && this._actual[key] !== undefined);
		if (needsAssign) {
			Object.assign(instance, this._actual);
		}
		return instance;
	}

	/**
	 * Builds the class instance without any validation.
	 * Use only when you're certain the object is valid.
	 *
	 * @returns The built class instance (may be incomplete)
	 */
	buildUnsafe(): T {
		const ctor = this.getClassConstructor();
		const instance: T = new ctor(this._actual as T);
		const dataKeys = Object.keys(this._actual) as (keyof T)[];
		const needsAssign = dataKeys.some((key) => instance[key] === undefined && this._actual[key] !== undefined);
		if (needsAssign) {
			Object.assign(instance, this._actual);
		}
		return instance;
	}

	/**
	 * Builds a partial object (may not have all required fields).
	 *
	 * @returns The partially built object
	 */
	buildPartial(): Partial<T> {
		return { ...this._actual };
	}

	/**
	 * Builds and freezes the class instance (shallow freeze).
	 *
	 * @returns The frozen class instance
	 * @throws {Error} If required fields are missing or validation fails
	 */
	buildFrozen(this: this & InternalClassBrand<DataPropertiesOnly<T>>): Readonly<T> {
		const missing = this.validateRequiredFields();
		if (missing.length > 0) {
			throw new Error(`Missing required fields: ${missing.join(", ")}. Please set these fields before calling build.`);
		}

		const validationErrors = this.runValidators();
		if (validationErrors.length > 0) {
			throw new Error(`Validation failed: ${validationErrors.join("; ")}`);
		}

		const ctor = this.getClassConstructor();
		const instance: T = new ctor(this._actual as T);
		// If the class does not assign properties in the constructor, assign them manually
		const dataKeys = Object.keys(this._actual) as (keyof T)[];
		const needsAssign = dataKeys.some((key) => instance[key] === undefined && this._actual[key] !== undefined);
		if (needsAssign) {
			Object.assign(instance, this._actual);
		}
		return Object.freeze(instance);
	}

	/**
	 * Builds and deeply freezes the class instance.
	 *
	 * @returns The deeply frozen class instance
	 * @throws {Error} If required fields are missing or validation fails
	 */
	buildDeepFrozen(this: this & InternalClassBrand<DataPropertiesOnly<T>>): DeepReadonly<T> {
		const missing = this.validateRequiredFields();
		if (missing.length > 0) {
			throw new Error(`Missing required fields: ${missing.join(", ")}. Please set these fields before calling build.`);
		}

		const validationErrors = this.runValidators();
		if (validationErrors.length > 0) {
			throw new Error(`Validation failed: ${validationErrors.join("; ")}`);
		}

		const ctor = this.getClassConstructor();
		const instance: T = new ctor(this._actual as T);
		// If the class does not assign properties in the constructor, assign them manually
		const dataKeys = Object.keys(this._actual) as (keyof T)[];
		const needsAssign = dataKeys.some((key) => instance[key] === undefined && this._actual[key] !== undefined);
		if (needsAssign) {
			Object.assign(instance, this._actual);
		}
		return this.deepFreeze(instance) as DeepReadonly<T>;
	}

	/**
	 * Builds and seals the class instance (shallow freeze).
	 *
	 * @returns The sealed class instance
	 * @throws {Error} If required fields are missing or validation fails
	 */
	buildSealed(this: this & InternalClassBrand<DataPropertiesOnly<T>>): T {
		const missing = this.validateRequiredFields();
		if (missing.length > 0) {
			throw new Error(`Missing required fields: ${missing.join(", ")}. Please set these fields before calling build.`);
		}

		const validationErrors = this.runValidators();
		if (validationErrors.length > 0) {
			throw new Error(`Validation failed: ${validationErrors.join("; ")}`);
		}

		const ctor = this.getClassConstructor();
		const instance: T = new ctor(this._actual as T);
		// If the class does not assign properties in the constructor, assign them manually
		const dataKeys = Object.keys(this._actual) as (keyof T)[];
		const needsAssign = dataKeys.some((key) => instance[key] === undefined && this._actual[key] !== undefined);
		if (needsAssign) {
			Object.assign(instance, this._actual);
		}
		return Object.seal(instance);
	}

	/**
	 * Builds and deeply seals the class instance.
	 *
	 * @returns The deeply sealed class instance
	 * @throws {Error} If required fields are missing or validation fails
	 */
	buildDeepSealed(this: this & InternalClassBrand<DataPropertiesOnly<T>>): T {
		const missing = this.validateRequiredFields();
		if (missing.length > 0) {
			throw new Error(`Missing required fields: ${missing.join(", ")}. Please set these fields before calling build.`);
		}

		const validationErrors = this.runValidators();
		if (validationErrors.length > 0) {
			throw new Error(`Validation failed: ${validationErrors.join("; ")}`);
		}

		const ctor = this.getClassConstructor();
		const instance: T = new ctor(this._actual as T);
		// If the class does not assign properties in the constructor, assign them manually
		const dataKeys = Object.keys(this._actual) as (keyof T)[];
		const needsAssign = dataKeys.some((key) => instance[key] === undefined && this._actual[key] !== undefined);
		if (needsAssign) {
			Object.assign(instance, this._actual);
		}
		return this.deepSeal(instance);
	}

	/**
	 * Deep freeze helper.
	 * @private
	 */
	private deepFreeze<V>(obj: V): V {
		if (obj === null || typeof obj !== "object") {
			return obj;
		}
		Object.getOwnPropertyNames(obj).forEach((prop) => {
			const value = (obj as Record<string, unknown>)[prop];
			if (value !== null && (typeof value === "object" || typeof value === "function")) {
				this.deepFreeze(value);
			}
		});
		return Object.freeze(obj);
	}

	/**
	 * Deep seal helper.
	 * @private
	 */
	private deepSeal<V>(obj: V): V {
		if (obj === null || typeof obj !== "object") {
			return obj;
		}
		Object.getOwnPropertyNames(obj).forEach((prop) => {
			const value = (obj as Record<string, unknown>)[prop];
			if (value !== null && (typeof value === "object" || typeof value === "function")) {
				this.deepSeal(value);
			}
		});
		return Object.seal(obj);
	}

	/**
	 * Deep clone helper for nested objects.
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
		for (const key of Object.keys(obj)) {
			cloned[key] = this.deepClone((obj as Record<string, unknown>)[key]);
		}
		return cloned as V;
	}

	/**
	 * Creates a new builder instance from an existing class instance.
	 * This is useful for creating builders from existing instances to modify them.
	 *
	 * @param classConstructor - The class constructor to use
	 * @param instance - The existing class instance to create a builder from
	 * @returns A new builder instance initialized with the instance's data
	 *
	 * @example
	 * ```typescript
	 * const existingPerson = new Person({ name: 'John', age: 30 });
	 * const builder = PersonBuilder.from(Person, existingPerson);
	 * const updated = builder.setProperty('age', 31).build();
	 * ```
	 */
	static from<T extends object, B extends new (classConstructor: ClassConstructor<T>, data: Partial<T>) => unknown>(
		this: B,
		classConstructor: ClassConstructor<T>,
		instance: T,
	): InstanceType<B> {
		const clonedData = CeriosClassBuilder.deepCloneStatic(instance);
		return new this(classConstructor, clonedData) as InstanceType<B>;
	}

	/**
	 * Creates a clone of the current builder instance.
	 * The clone has the same state but is independent - changes to one won't affect the other.
	 *
	 * @returns A new builder instance with the same state
	 *
	 * @example
	 * ```typescript
	 * const builder1 = PersonBuilder.create().setProperty('name', 'John');
	 * const builder2 = builder1.clone();
	 * // builder2 is independent of builder1
	 * ```
	 */
	clone(): this {
		const clonedData = this.deepClone(this._actual);
		return this.createBuilder(clonedData);
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
		for (const key of Object.keys(obj)) {
			cloned[key] = this.deepCloneStatic((obj as Record<string, unknown>)[key]);
		}
		return cloned as V;
	}
}
