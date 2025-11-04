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
 * @template T - The type representing the set of properties that have been set
 * @internal
 */
export type CeriosBrand<T> = { [__brand]: T };

/**
 * Helper type to represent a path through an object structure
 * Handles optional properties by unwrapping them with NonNullable
 */
type PathImpl<T, K extends keyof T = keyof T> = K extends string | number
	? NonNullable<T[K]> extends Record<string, any>
		? NonNullable<T[K]> extends Array<any>
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
 * Recursively makes all properties readonly for deep immutability.
 * Handles arrays, objects, and primitive types.
 *
 * @template T - The type to make deeply readonly
 */
export type DeepReadonly<T> = T extends (infer R)[]
	? DeepReadonlyArray<R>
	: T extends (...args: any[]) => any
		? T
		: T extends object
			? DeepReadonlyObject<T>
			: T;

/**
 * Helper type for deep readonly arrays
 * @internal
 */
interface DeepReadonlyArray<T> extends ReadonlyArray<DeepReadonly<T>> {}

/**
 * Helper type for deep readonly objects
 * @internal
 */
type DeepReadonlyObject<T> = {
	readonly [P in keyof T]: DeepReadonly<T[P]>;
};

/**
 * Cache the root key extraction to avoid repeated computation
 * Handles optional properties by ensuring the key is valid for T
 * @internal
 */
type RootKey<P extends string, T = any> = P extends `${infer K}.${string}`
	? K extends keyof T
		? K
		: never
	: P extends keyof T
		? P
		: never;

/**
 * Recursively freezes an object and all its nested properties.
 * @param obj - The object to freeze
 * @returns The frozen object
 * @internal
 */
function deepFreeze<T>(obj: T): T {
	// Retrieve the property names defined on obj
	Object.getOwnPropertyNames(obj).forEach(prop => {
		const value = (obj as any)[prop];

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
	Object.getOwnPropertyNames(obj).forEach(prop => {
		const value = (obj as any)[prop];

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
	 */
	static requiredTemplate?: ReadonlyArray<string>;

	/**
	 * Instance-level required fields that can be populated dynamically.
	 * This allows adding required fields at runtime via the setRequiredFields method.
	 * @private
	 */
	private _requiredFields: Set<string> = new Set();

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
	 * Gets the combined required fields from both the static template and instance-level fields.
	 * @private
	 */
	private getRequiredTemplate(): ReadonlyArray<string> {
		const ctor = this.constructor as typeof CeriosBuilder;
		const staticFields = ctor.requiredTemplate || [];
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
			let current: any = this._actual;

			for (let i = 0; i < keys.length; i++) {
				const key = keys[i];
				if (current === null || current === undefined || !(key in current)) {
					missing.push(path);
					break;
				}
				current = current[key];
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
	 * Creates a new builder instance. Intended to be called by subclasses.
	 *
	 * @param _actual - The current partial state of the object being built
	 * @param _requiredFields - Optional array of required field paths to preserve across instances
	 * @protected
	 */
	protected constructor(
		protected readonly _actual: Partial<T>,
		_requiredFields?: RequiredFieldsTemplate<T>
	) {
		if (_requiredFields) {
			this._requiredFields = new Set([..._requiredFields] as string[]);
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
	protected setProperty<K extends keyof T>(key: K, value: T[K]): this & CeriosBrand<Pick<T, K>> {
		const BuilderClass = this.constructor as new (data: any, requiredFields?: RequiredFieldsTemplate<T>) => any;
		return new BuilderClass(
			{
				...this._actual,
				[key]: value,
			},
			Array.from(this._requiredFields) as unknown as RequiredFieldsTemplate<T>
		) as this & CeriosBrand<Pick<T, K>>;
	}

	/**
	 * Sets multiple property values at once and returns a new builder instance with updated type state.
	 * @param props - An object with one or more properties to set.
	 * @returns A new builder instance with the properties set and type state updated.
	 * @protected
	 */
	protected setProperties<K extends keyof T>(props: Pick<T, K>): this & CeriosBrand<Pick<T, K>> {
		const BuilderClass = this.constructor as new (data: any, requiredFields?: RequiredFieldsTemplate<T>) => any;
		return new BuilderClass(
			{
				...this._actual,
				...props,
			},
			Array.from(this._requiredFields) as unknown as RequiredFieldsTemplate<T>
		) as this & CeriosBrand<Pick<T, K>>;
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
	protected setNestedProperty<P extends Path<T>>(
		path: P,
		value: PathValue<T, P>
	): this & CeriosBrand<Pick<T, RootKey<P & string, T> extends never ? keyof T : RootKey<P & string, T>>> {
		const BuilderClass = this.constructor as new (data: any, requiredFields?: RequiredFieldsTemplate<T>) => any;
		const keys = (path as string).split(".");
		const newActual = this.deepClone(this._actual);

		let current: any = newActual;
		for (let i = 0; i < keys.length - 1; i++) {
			const key = keys[i];
			if (!(key in current) || typeof current[key] !== "object" || current[key] === null) {
				current[key] = {};
			} else {
				current[key] = this.deepClone(current[key]);
			}
			current = current[key];
		}

		current[keys[keys.length - 1]] = value;

		return new BuilderClass(
			newActual,
			Array.from(this._requiredFields) as unknown as RequiredFieldsTemplate<T>
		) as this & CeriosBrand<Pick<T, RootKey<P & string, T> extends never ? keyof T : RootKey<P & string, T>>>;
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
			return obj.map(item => this.deepClone(item)) as any;
		}
		const cloned: any = {};
		const hasOwn = Object.prototype.hasOwnProperty;
		for (const key in obj) {
			if (hasOwn.call(obj, key)) {
				cloned[key] = this.deepClone(obj[key]);
			}
		}
		return cloned;
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
		K extends { [P in keyof T]: NonNullable<T[P]> extends Array<any> ? P : never }[keyof T],
		V extends T[K] extends Array<infer U> ? U : T[K] extends Array<infer U> | undefined ? U : never,
	>(key: K, value: V): this & CeriosBrand<Pick<T, K>> {
		const BuilderClass = this.constructor as new (data: any, requiredFields?: RequiredFieldsTemplate<T>) => any;
		const currentArray = (this._actual[key] as Array<V> | undefined) ?? [];
		return new BuilderClass(
			{
				...this._actual,
				[key]: [...currentArray, value],
			},
			Array.from(this._requiredFields) as unknown as RequiredFieldsTemplate<T>
		) as this & CeriosBrand<Pick<T, K>>;
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
		return this._actual as Partial<T>;
	}

	/**
	 * @deprecated Use build() instead. buildSafe() is now an alias for build().
	 * Builds the final object with runtime validation using the requiredTemplate.
	 * This method validates that all fields in the requiredTemplate array are present.
	 *
	 * @returns The fully built object of type T
	 * @throws {Error} If any required field is missing at runtime
	 */
	buildSafe(): T {
		return this.buildWithoutCompileTimeValidation();
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

		return deepSeal(this._actual as T);
	}
}
