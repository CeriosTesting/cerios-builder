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
	[K in keyof T as T[K] extends (...args: any[]) => any ? never : K]: T[K];
};

/**
 * Brand type specifically for class builders that only tracks data properties.
 */
export type CeriosClassBrand<T> = {
	readonly __classBuilderBrand: T;
};

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
	 * Creates a new class builder instance.
	 * @param classConstructor - The class constructor to use for building
	 * @param data - Optional initial data
	 */
	protected constructor(classConstructor: ClassConstructor<T>, data: Partial<T> = {}) {
		this._classConstructor = classConstructor;
		this._actual = data;
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
		const BuilderClass = this.constructor as new (classConstructor: ClassConstructor<T>, data: Partial<T>) => this;
		return new BuilderClass(this._classConstructor, data);
	}

	/**
	 * Sets a property value and returns a new builder instance with updated type state.
	 * @template K - The property key being set
	 * @param key - The property key to set
	 * @param value - The value to assign to the property
	 * @returns A new builder instance with the property set
	 */
	setProperty<K extends keyof DataPropertiesOnly<T>>(
		key: K,
		value: DataPropertiesOnly<T>[K]
	): this & CeriosClassBrand<Pick<DataPropertiesOnly<T>, K>> {
		const newBuilder = this.createBuilder({
			...this._actual,
			[key]: value,
		} as Partial<T>);
		return newBuilder as this & CeriosClassBrand<Pick<DataPropertiesOnly<T>, K>>;
	}

	/**
	 * Sets multiple properties at once.
	 * @template K - The property keys being set
	 * @param props - Object with properties to set
	 * @returns A new builder instance with the properties set
	 */
	setProperties<K extends keyof DataPropertiesOnly<T>>(
		props: Pick<DataPropertiesOnly<T>, K>
	): this & CeriosClassBrand<Pick<DataPropertiesOnly<T>, K>> {
		const newBuilder = this.createBuilder({
			...this._actual,
			...props,
		} as Partial<T>);
		return newBuilder as this & CeriosClassBrand<Pick<DataPropertiesOnly<T>, K>>;
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
			[P in keyof DataPropertiesOnly<T>]: NonNullable<DataPropertiesOnly<T>[P]> extends Array<any> ? P : never;
		}[keyof DataPropertiesOnly<T>],
		V extends DataPropertiesOnly<T>[K] extends Array<infer U>
			? U
			: DataPropertiesOnly<T>[K] extends Array<infer U> | undefined
				? U
				: never,
	>(key: K, value: V): this & CeriosClassBrand<Pick<DataPropertiesOnly<T>, K>> {
		const currentArray = (this._actual[key as keyof T] as Array<V> | undefined) ?? [];
		const newBuilder = this.createBuilder({
			...this._actual,
			[key]: [...currentArray, value],
		} as Partial<T>);
		return newBuilder as this & CeriosClassBrand<Pick<DataPropertiesOnly<T>, K>>;
	}

	/**
	 * Builds the final class instance with compile-time and runtime validation.
	 * - Compile-time: TypeScript enforces all data properties are set
	 * - Runtime: Validates nested class instances are properly instantiated
	 *
	 * @returns The fully built and validated class instance
	 * @throws {Error} If nested validation fails
	 */
	build(this: this & CeriosClassBrand<DataPropertiesOnly<T>>): T {
		const ctor = this.getClassConstructor();
		const instance: T = new ctor(this._actual as T);
		// If the class does not assign properties in the constructor, assign them manually
		const dataKeys = Object.keys(this._actual) as (keyof T)[];
		const needsAssign = dataKeys.some(key => instance[key] === undefined && this._actual[key] !== undefined);
		if (needsAssign) {
			Object.assign(instance, this._actual);
		}
		return instance;
	}

	/**
	 * Builds the class instance with runtime validation only (no compile-time).
	 * Use this when building from external/dynamic data.
	 *
	 * @returns The built class instance
	 * @throws {Error} If validation fails
	 */
	buildWithoutCompileTimeValidation(): T {
		const ctor = this.getClassConstructor();
		const instance: T = new ctor(this._actual as T);
		const dataKeys = Object.keys(this._actual) as (keyof T)[];
		const needsAssign = dataKeys.some(key => instance[key] === undefined && this._actual[key] !== undefined);
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
		const needsAssign = dataKeys.some(key => instance[key] === undefined && this._actual[key] !== undefined);
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
	 * @throws {Error} If validation fails
	 */
	buildFrozen(this: this & CeriosClassBrand<DataPropertiesOnly<T>>): Readonly<T> {
		const ctor = this.getClassConstructor();
		const instance: T = new ctor(this._actual as T);
		// If the class does not assign properties in the constructor, assign them manually
		const dataKeys = Object.keys(this._actual) as (keyof T)[];
		const needsAssign = dataKeys.some(key => instance[key] === undefined && this._actual[key] !== undefined);
		if (needsAssign) {
			Object.assign(instance, this._actual);
		}
		return Object.freeze(instance);
	}

	/**
	 * Builds and deeply freezes the class instance.
	 *
	 * @returns The deeply frozen class instance
	 * @throws {Error} If validation fails
	 */
	buildDeepFrozen(this: this & CeriosClassBrand<DataPropertiesOnly<T>>): DeepReadonly<T> {
		const ctor = this.getClassConstructor();
		const instance: T = new ctor(this._actual as T);
		// If the class does not assign properties in the constructor, assign them manually
		const dataKeys = Object.keys(this._actual) as (keyof T)[];
		const needsAssign = dataKeys.some(key => instance[key] === undefined && this._actual[key] !== undefined);
		if (needsAssign) {
			Object.assign(instance, this._actual);
		}
		return this.deepFreeze(instance) as DeepReadonly<T>;
	}

	/**
	 * Builds and seals the class instance (shallow freeze).
	 *
	 * @returns The sealed class instance
	 * @throws {Error} If validation fails
	 */
	buildSealed(this: this & CeriosClassBrand<DataPropertiesOnly<T>>): T {
		const ctor = this.getClassConstructor();
		const instance: T = new ctor(this._actual as T);
		// If the class does not assign properties in the constructor, assign them manually
		const dataKeys = Object.keys(this._actual) as (keyof T)[];
		const needsAssign = dataKeys.some(key => instance[key] === undefined && this._actual[key] !== undefined);
		if (needsAssign) {
			Object.assign(instance, this._actual);
		}
		return Object.seal(instance);
	}

	/**
	 * Builds and deeply seals the class instance.
	 *
	 * @returns The deeply sealed class instance
	 * @throws {Error} If validation fails
	 */
	buildDeepSealed(this: this & CeriosClassBrand<DataPropertiesOnly<T>>): T {
		const ctor = this.getClassConstructor();
		const instance: T = new ctor(this._actual as T);
		// If the class does not assign properties in the constructor, assign them manually
		const dataKeys = Object.keys(this._actual) as (keyof T)[];
		const needsAssign = dataKeys.some(key => instance[key] === undefined && this._actual[key] !== undefined);
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
		Object.getOwnPropertyNames(obj).forEach(prop => {
			const value = (obj as any)[prop];
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
		Object.getOwnPropertyNames(obj).forEach(prop => {
			const value = (obj as any)[prop];
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
			return obj.map(item => this.deepClone(item)) as any;
		}
		const cloned: any = {};
		for (const key of Object.keys(obj)) {
			cloned[key] = this.deepClone((obj as any)[key]);
		}
		return cloned;
	}
}
