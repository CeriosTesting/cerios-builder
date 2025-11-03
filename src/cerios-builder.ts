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
 */
type PathImpl<T, K extends keyof T = keyof T> = K extends string | number
	? T[K] extends Record<string, any>
		? T[K] extends Array<any>
			? K
			: K | `${K}.${PathImpl<T[K]> & string}`
		: K
	: never;

export type Path<T> = PathImpl<T>;

type PathValue<T, P> = P extends keyof T
	? T[P]
	: P extends `${infer K}.${infer Rest}`
		? K extends keyof T
			? PathValue<T[K], Rest>
			: never
		: never;

/**
 * Type-safe template for defining required fields using an array of paths.
 * Simply list the paths that are required.
 */
export type RequiredFieldsTemplate<T> = ReadonlyArray<Path<T>>;

/**
 * Cache the root key extraction to avoid repeated computation
 * @internal
 */
type RootKey<P extends string> = P extends `${infer K}.${string}` ? K : P;

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
	): this & CeriosBrand<Pick<T, Extract<RootKey<P & string>, keyof T>>> {
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
		) as this & CeriosBrand<Pick<T, Extract<RootKey<P & string>, keyof T>>>;
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
	 * Builds the final object. This method uses TypeScript's contextual typing to ensure
	 * all required fields are set before allowing build() to be called.
	 *
	 * The type constraint checks that all required properties are present.
	 *
	 * @returns The fully built object of type T
	 * @throws {TypeError} If called without all required fields set (compile-time error)
	 */
	build(this: this & CeriosBrand<T>): T {
		return this._actual as T;
	}

	/**
	 * Builds the final object with runtime validation using the requiredTemplate.
	 * This method validates that all fields in the requiredTemplate array are present.
	 *
	 * @returns The fully built object of type T
	 * @throws {Error} If any required field is missing at runtime
	 *
	 * @example
	 * ```typescript
	 * class MyBuilder extends CeriosBuilder<MyType> {
	 *   static requiredTemplate: RequiredFieldsTemplate<MyType> = [
	 *     'path.to.field1',
	 *     'path.to.field2'
	 *   ];
	 * }
	 *
	 * const obj = new MyBuilder({})
	 *   .setRequiredField1("value1")
	 *   .setRequiredField2("value2")
	 *   .buildSafe(); // Validates that both required fields are present
	 * ```
	 */
	buildSafe(): T {
		const missing = this.validateRequiredFields();

		if (missing.length > 0) {
			throw new Error(`Missing required fields: ${missing.join(", ")}. Please set these fields before calling build.`);
		}

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
}
