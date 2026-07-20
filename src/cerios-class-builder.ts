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
import type {
	BuilderTargetMarker,
	DeepReadonly,
	RequiredFieldsRecord,
	RequiredKeys,
	TargetOfMarker,
	WritableKeys,
} from "./types";

/**
 * Type representing a class constructor that can be instantiated with optional partial data.
 * @template T - The type that the constructor creates
 */
export type ClassConstructor<T> = new (data?: Partial<T>) => T;

/**
 * Getter-only accessor names per target class, computed once per class.
 * @internal
 */
const GETTER_ONLY_KEYS_CACHE = new WeakMap<object, ReadonlySet<string>>();

/**
 * Collects the names on the class's prototype chain that resolve to an accessor with a
 * getter but no setter. The nearest descriptor wins, so a derived class that redeclares an
 * inherited getter-only accessor as a getter/setter pair makes the name writable again.
 *
 * `DataPropertiesOnly` cannot exclude these at the type level - a getter is structurally
 * indistinguishable from a data property - so they must be caught at runtime instead.
 *
 * @internal
 */
function getterOnlyKeys(ctor: ClassConstructor<object>): ReadonlySet<string> {
	const cached = GETTER_ONLY_KEYS_CACHE.get(ctor);
	if (cached) {
		return cached;
	}
	const keys = new Set<string>();
	const seen = new Set<string>();
	let proto: object | null = ctor.prototype as object | null;
	while (proto && proto !== Object.prototype) {
		for (const name of Object.getOwnPropertyNames(proto)) {
			if (seen.has(name)) {
				continue;
			}
			seen.add(name);
			const descriptor = Object.getOwnPropertyDescriptor(proto, name);
			if (descriptor?.get && !descriptor.set) {
				keys.add(name);
			}
		}
		proto = Object.getPrototypeOf(proto) as object | null;
	}
	GETTER_ONLY_KEYS_CACHE.set(ctor, keys);
	return keys;
}

/**
 * Rejects writes to a getter-only accessor of the target class.
 *
 * Without this, the value sat in the builder state until build, where assigning it threw
 * `TypeError: Cannot set property ... which has only a getter` - far from the misuse and
 * without naming the builder as the culprit.
 *
 * @throws {CeriosBuilderError} If the key is a getter-only accessor on the target class
 * @internal
 */
function assertNotGetterOnly(ctor: ClassConstructor<object>, key: PropertyKey): void {
	if (typeof key === "string" && getterOnlyKeys(ctor).has(key)) {
		throw new CeriosBuilderError(
			`"${key}" is a getter-only accessor on ${ctor.name}; its value is computed by the class and cannot be set through the builder.`,
			[],
			[],
		);
	}
}

/**
 * Helper to extract only data properties (exclude methods) from a class type.
 * This allows compile-time validation to work properly with classes.
 * @internal
 */
export type DataPropertiesOnly<T> = {
	[K in keyof T as T[K] extends (...args: never[]) => unknown ? never : K]: T[K];
};

/**
 * Internal brand for class-builder type-state tracking.
 * Prefer helper aliases like `ClassBuilderStep` in public APIs.
 * @internal
 */
export type InternalClassBrand<T> = {
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

/**
 * The writable data properties of T: what the gate may demand and what a builder can
 * actually assign. Getter-only accessors surface as `readonly` properties, so this view is
 * what keeps them out of the build gate — a gate demanding a computed property would make
 * the class unbuildable through the validated variants.
 * @internal
 */
type WritableDataProperties<T> = Pick<DataPropertiesOnly<T>, WritableKeys<DataPropertiesOnly<T>>>;

/**
 * The `this` constraint gating the compile-time-validated build variants.
 *
 * Normally the accumulated {@link InternalClassBrand} must cover every required *writable*
 * data property of T. Readonly-typed properties are excluded: a getter-only accessor is
 * indistinguishable from a `readonly` field at the type level, and demanding a computed
 * property would make the class unbuildable (setting it throws at runtime). When T has no
 * required writable data properties there is nothing to track, so the gate dissolves to
 * `unknown` and `build()` is callable on a fresh builder — an all-optional class no longer
 * needs a throwaway setter call before it can build.
 *
 * @template T - The class type being built
 */
export type ClassBuildGate<T> = [RequiredKeys<WritableDataProperties<T>>] extends [never]
	? unknown
	: InternalClassBrand<WritableDataProperties<T>>;

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

/**
 * Extracts the class type built by any class-builder type.
 *
 * Hand-written builders are matched nominally against `CeriosClassBuilder`. Class auto
 * builders (`CeriosClassAutoBuilder(Class)`) declare their instance type as
 * `ClassAutoBuilderApi<T> & ClassAutoSetters<T>`, which is not assignable to
 * `CeriosClassBuilder<T>` (its `protected _actual` only matches when it originates from the
 * same declaration), so they are matched structurally on `buildUnsafe`.
 *
 * @internal
 */
type ClassBuilderTargetOf<B> =
	B extends CeriosClassBuilder<infer T>
		? T
		: B extends { buildUnsafe(): infer T }
			? T extends object
				? T
				: never
			: never;

/**
 * The return type of a class-builder factory or custom method, expressed in terms of the
 * builder itself. Prefer this over `ClassBuilderStep`/`ClassBuilderPreset` in your own code:
 * the class type is derived from the builder, so you only name the builder and the data
 * properties the method sets. Class methods are never counted as properties to set.
 *
 * Works for both hand-written `CeriosClassBuilder` subclasses and `CeriosClassAutoBuilder`
 * subclasses.
 *
 * Use root data-property names only. A method that sets a nested path brands the *root*
 * property, so a method calling `setNestedProperty("address.city", ...)` returns
 * `ClassBuilderWith<this, "address">`.
 *
 * @template B - The class-builder type (a concrete builder class, or `this` inside a method)
 * @template S - The data properties this method sets. Omit to mean "every data property".
 *
 * @example
 * ```typescript
 * class PersonBuilder extends CeriosClassAutoBuilder(Person) {
 *   static create(): PersonBuilder { return new PersonBuilder(); }
 *   static createWithDefaults(): ClassBuilderWith<PersonBuilder, "age"> {
 *     return PersonBuilder.create().age(30);
 *   }
 * }
 * ```
 */
export type ClassBuilderWith<
	B extends BuilderTargetMarker<object>,
	// Constrained on `keyof TargetOfMarker<B>` rather than `keyof DataPropertiesOnly<...>`:
	// the latter is a key-remapping mapped type, which stays deferred against the
	// polymorphic `this` type and would reject valid keys in `ClassBuilderWith<this, K>`.
	// `ClassStepKey` below still narrows the brand payload to data properties only.
	S extends keyof TargetOfMarker<B> = keyof DataPropertiesOnly<TargetOfMarker<B>>,
> = B & InternalClassBrand<Pick<DataPropertiesOnly<TargetOfMarker<B>>, ClassStepKey<TargetOfMarker<B>, S>>>;

type ClassBuilderBaseFromFactoryReturn<R> = R extends (infer B) & InternalClassBrand<unknown> ? B : R;

type ClassBuilderTargetFromFactoryReturn<R> = ClassBuilderTargetOf<ClassBuilderBaseFromFactoryReturn<R>>;

/**
 * Helper type for composition callbacks based on a class-builder factory method.
 *
 * This infers both the callback input type (including presets/defaults) and the
 * fully-buildable output type directly from the factory return type. The factory may belong
 * to a hand-written `CeriosClassBuilder` subclass or a `CeriosClassAutoBuilder` subclass.
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
export type ClassPathValue<T, P> = P extends keyof DataPropertiesOnly<T>
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
/**
 * Merged declaration giving every `CeriosClassBuilder` the phantom target marker, so
 * `ClassBuilderWith<this, K>` can resolve what the builder builds. Adds no runtime members.
 */
// oxlint-disable-next-line typescript/no-unsafe-declaration-merging -- phantom type-only marker, no runtime members
export interface CeriosClassBuilder<T extends object> extends BuilderTargetMarker<T> {}

/**
 * @deprecated Will be removed in the next major version. Migrate to `CeriosClassAutoBuilder(Class)`,
 * which generates every setter automatically with the same compile-time safety — see
 * MIGRATION.md for a per-feature guide (including how a director replaces `setNestedProperty`).
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
		// Seed data bypasses `setProperty`, so it needs the same getter-only guard here.
		for (const key of Object.keys(data)) {
			assertNotGetterOnly(classConstructor, key);
		}
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
	 *
	 * Protected rather than private so `instantiateBuilder` overrides can read it from the
	 * instance instead of capturing it, which is what lets the class auto builder's runtime
	 * class hold no per-factory-call state.
	 */
	protected getClassConstructor(): ClassConstructor<T> {
		return this._classConstructor;
	}

	/**
	 * Creates a new instance of the builder with updated data.
	 * Subclasses can override this to return the correct subclass type.
	 * @private
	 */
	private createBuilder(data: Partial<T>): this {
		return this.instantiateBuilder(data, this._validators, this._requiredFields);
	}

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
	 * Instantiates the target class from the current state.
	 *
	 * The single copy of what used to be an identical eight-line block in all eight build
	 * variants. Classes that assign in their constructor need nothing further; those that
	 * do not get the data assigned afterwards, which is what the `needsAssign` check
	 * detects.
	 */
	private instantiate(): T {
		const ctor = this.getClassConstructor();
		// Cloned first: handing `this._actual` to the constructor made the built instance
		// alias the builder's own nested state, so mutating the result mutated the builder -
		// and `buildDeepFrozen()` froze the builder in place, silently dropping every later
		// write. The object builder does the same through `snapshot()`.
		const data = deepClone(this._actual);
		const instance: T = new ctor(data);

		// The write-path guards keep getter-only accessor keys out of the state; filtering
		// here as well keeps [[Set]] from ever reaching a get-only accessor (which throws a
		// bare TypeError) should a future write path miss the guard.
		const getterOnly = getterOnlyKeys(ctor);
		const dataKeys = Object.keys(data).filter((key) => !getterOnly.has(key)) as (keyof T)[];
		const needsAssign = dataKeys.some((key) => instance[key] === undefined && data[key] !== undefined);
		if (needsAssign) {
			for (const key of dataKeys) {
				(instance as Partial<T>)[key] = data[key];
			}
		}

		return instance;
	}

	/**
	 * The single construction seam used by every copy-on-write method.
	 *
	 * By default this calls the subclass constructor with the internal 4-argument shape,
	 * which requires the subclass to accept it. Subclasses whose constructor has a
	 * different signature - such as the class auto builders, where users write
	 * `constructor(data?)` - override this to build the copy without invoking a
	 * constructor at all.
	 *
	 * @param data - The state for the new builder
	 * @param validators - Validators to carry over
	 * @param requiredFields - Required fields to carry over
	 * @returns A new builder instance of the same concrete type
	 */
	protected instantiateBuilder(
		data: Partial<T>,
		validators: Array<(obj: Partial<T>) => boolean | string>,
		requiredFields: ReadonlyArray<ClassPath<T>> | Set<string>,
	): this {
		const BuilderClass = this.constructor as new (
			classConstructor: ClassConstructor<T>,
			data: Partial<T>,
			validators?: Array<(obj: Partial<T>) => boolean | string>,
			requiredFields?: ReadonlyArray<ClassPath<T>> | Set<string>,
		) => this;
		return new BuilderClass(this._classConstructor, data, validators, requiredFields);
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
		assertSafeKey(key);
		assertNotGetterOnly(this.getClassConstructor(), key);
		const newBuilder = this.createBuilder({
			...this._actual,
			[key]: value,
		});
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
		for (const key of Object.keys(props)) {
			assertSafeKey(key);
			assertNotGetterOnly(this.getClassConstructor(), key);
		}
		const newBuilder = this.createBuilder({
			...this._actual,
			...props,
		});
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
		assertSafePath(path as string);
		const keys = (path as string).split(".");
		// Only the root key lands on the target class; deeper segments live on nested values.
		assertNotGetterOnly(this.getClassConstructor(), keys[0]);
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
	setRequiredFields(fields: ReadonlyArray<ClassPath<T>> | RequiredFieldsRecord<DataPropertiesOnly<T>>): this {
		return this.instantiateBuilder(this._actual, this._validators, new Set(toRequiredPaths(fields)));
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
		return this.instantiateBuilder(this._actual, [...this._validators, validator], this._requiredFields);
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
		// Keep only properties in the required list; a nested path keeps its root object.
		return this.createBuilder(pickRequiredRoots(this._actual, this.getRequiredTemplate()));
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
		V extends (DataPropertiesOnly<T>[K] extends Array<infer U>
			? U
			: DataPropertiesOnly<T>[K] extends Array<infer U> | undefined
				? U
				: never),
	>(key: K, value: V): ClassBuilderStep<this, T, K> {
		assertSafeKey(key);
		assertNotGetterOnly(this.getClassConstructor(), key);
		const currentArray = (this._actual[key as keyof T] as Array<V> | undefined) ?? [];
		const newBuilder = this.createBuilder({
			...this._actual,
			[key]: [...currentArray, value],
		});
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
	build(this: this & ClassBuildGate<T>): T {
		this.assertValid("build");

		const instance = this.instantiate();
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
	buildWithoutRuntimeValidation(this: this & ClassBuildGate<T>): T {
		const instance = this.instantiate();
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
		this.assertValid("buildWithoutCompileTimeValidation");

		const instance = this.instantiate();
		return instance;
	}

	/**
	 * Builds the class instance without any validation.
	 * Use only when you're certain the object is valid.
	 *
	 * @returns The built class instance (may be incomplete)
	 */
	buildUnsafe(): T {
		const instance = this.instantiate();
		return instance;
	}

	/**
	 * Builds a partial object (may not have all required fields).
	 *
	 * @returns The partially built object
	 */
	buildPartial(): Partial<T> {
		// Deep-copied, not returned live: a shallow spread still let a caller reach into a
		// nested object and mutate the builder through it.
		return deepClone(this._actual);
	}

	/**
	 * Builds and freezes the class instance (shallow freeze).
	 *
	 * @returns The frozen class instance
	 * @throws {Error} If required fields are missing or validation fails
	 */
	buildFrozen(this: this & ClassBuildGate<T>): Readonly<T> {
		this.assertValid("buildFrozen");

		const instance = this.instantiate();
		return Object.freeze(instance);
	}

	/**
	 * Builds and deeply freezes the class instance.
	 *
	 * @returns The deeply frozen class instance
	 * @throws {Error} If required fields are missing or validation fails
	 */
	buildDeepFrozen(this: this & ClassBuildGate<T>): DeepReadonly<T> {
		this.assertValid("buildDeepFrozen");

		const instance = this.instantiate();
		return deepHarden(instance, "freeze") as DeepReadonly<T>;
	}

	/**
	 * Builds and seals the class instance (shallow freeze).
	 *
	 * @returns The sealed class instance
	 * @throws {Error} If required fields are missing or validation fails
	 */
	buildSealed(this: this & ClassBuildGate<T>): T {
		this.assertValid("buildSealed");

		const instance = this.instantiate();
		return Object.seal(instance);
	}

	/**
	 * Builds and deeply seals the class instance.
	 *
	 * @returns The deeply sealed class instance
	 * @throws {Error} If required fields are missing or validation fails
	 */
	buildDeepSealed(this: this & ClassBuildGate<T>): T {
		this.assertValid("buildDeepSealed");

		const instance = this.instantiate();
		return deepHarden(instance, "seal");
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
		const clonedData = deepClone(instance);
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
		const clonedData = deepClone(this._actual);
		return this.createBuilder(clonedData);
	}
}
