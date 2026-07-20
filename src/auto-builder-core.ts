/**
 * Shared runtime and type primitives for the auto-setter builder factories
 * (`CeriosAutoBuilder` and `CeriosClassAutoBuilder`).
 *
 * @internal
 */

import type { DeepReadonly, OptionalKeys, RequiredFieldsRecord } from "./types";

/**
 * Names that are real methods/fields on the builder and therefore cannot be used
 * as bare property setters. A property whose name collides with one of these gets
 * a `${name}Prop` setter instead (e.g. a property named `build` -> `buildProp`),
 * while the real method keeps its name.
 *
 * @internal
 */
export const RESERVED_BUILDER_NAMES = [
	// Public build variants.
	"build",
	"buildWithoutRuntimeValidation",
	"buildWithoutCompileTimeValidation",
	"buildUnsafe",
	"buildPartial",
	"buildFrozen",
	"buildDeepFrozen",
	"buildSealed",
	"buildDeepSealed",
	// Public configuration and state helpers.
	"clone",
	"addValidator",
	"setRequiredFields",
	"removeOptionalProperty",
	"clearOptionalProperties",
	// Property mutators. Protected on `CeriosBuilder`, but still present on the
	// prototype chain, so the proxy would return the real method instead of a setter.
	"setProperty",
	"setProperties",
	"setNestedProperty",
	"addToArrayProperty",
	// Internal helpers. Private in TypeScript, ordinary members at runtime.
	// `createBuilder`, `getClassConstructor` and `instantiate` exist only on
	// `CeriosClassBuilder`, `snapshot` only on `CeriosBuilder`, but both builders share this
	// list so the two stay symmetric. Deep clone/freeze/seal are module functions, not
	// members, so they are deliberately absent.
	"createBuilder",
	"instantiateBuilder",
	"getClassConstructor",
	"getRequiredTemplate",
	"validateRequiredFields",
	"runValidators",
	"assertValid",
	"instantiate",
	"snapshot",
	// Backing fields.
	"_actual",
	"_requiredFields",
	"_validators",
	"_classConstructor",
	// `Object.prototype`, reachable through the prototype chain on every instance.
	"constructor",
	"hasOwnProperty",
	"isPrototypeOf",
	"propertyIsEnumerable",
	"toLocaleString",
	"toString",
	"valueOf",
	// `__proto__` is deliberately NOT reserved. Reserving it generated a `__proto__Prop`
	// setter that mapped straight back to the `__proto__` key, which re-parented the built
	// object. It is rejected outright by `assertSafeKey` instead, and the proxy's
	// `prop in target` fallback still keeps the real accessor reachable.
	"__defineGetter__",
	"__defineSetter__",
	"__lookupGetter__",
	"__lookupSetter__",
	// Not real members: intercepted by the proxy so `await builder` resolves with the
	// builder and `JSON.stringify(builder)` does not pick up a setter function.
	"then",
	"toJSON",
] as const;

/**
 * Union of the reserved builder member names.
 * @internal
 */
export type ReservedBuilderName = (typeof RESERVED_BUILDER_NAMES)[number];

/**
 * Maps a property key to its auto-setter method name.
 * Reserved names get a `Prop` suffix; a literal `${Reserved}Prop` key is excluded
 * (no setter) so the suffix scheme stays unambiguous.
 *
 * @internal
 */
export type SetterName<K extends string> = K extends ReservedBuilderName
	? `${K}Prop`
	: K extends `${ReservedBuilderName}Prop`
		? never
		: K;

const RESERVED_SET: ReadonlySet<string> = new Set(RESERVED_BUILDER_NAMES);

/**
 * Resolves an auto-setter method name back to the property key it sets.
 * `buildProp` -> `build` (reserved); everything else is identity.
 * @internal
 */
function setterNameToKey(name: string): string {
	if (name.endsWith("Prop")) {
		const base = name.slice(0, -4);
		if (RESERVED_SET.has(base)) {
			return base;
		}
	}
	return name;
}

/**
 * Deep clone helper for seeding builders from existing objects/instances, and for `clone()`.
 *
 * The single implementation for both base builders and both auto builders. It is
 * cycle-safe, and preserves the built-in types a plain key-walk destroys: `new Date(0)`
 * used to clone to `{}`, and self-referencing data threw a `RangeError`.
 *
 * The prototype is preserved, so a nested class instance stays an instance of its class.
 * Flattening it to a plain object loses every method on it, which matters as soon as a
 * nested builder contributes a real instance to the parent's state.
 *
 * @param obj - The value to clone
 * @param seen - Cycle-tracking map; callers do not pass this
 * @internal
 */
export function deepClone<V>(obj: V, seen: WeakMap<object, unknown> = new WeakMap()): V {
	if (obj === null || typeof obj !== "object") {
		return obj;
	}

	const existing = seen.get(obj);
	if (existing !== undefined) {
		return existing as V;
	}

	if (obj instanceof Date) {
		return new Date(obj.getTime()) as unknown as V;
	}
	if (obj instanceof RegExp) {
		return new RegExp(obj.source, obj.flags) as unknown as V;
	}

	if (Array.isArray(obj)) {
		const cloned: unknown[] = [];
		seen.set(obj, cloned);
		for (const item of obj) {
			cloned.push(deepClone(item, seen));
		}
		return cloned as unknown as V;
	}
	if (obj instanceof Map) {
		const cloned = new Map<unknown, unknown>();
		seen.set(obj, cloned);
		for (const [key, value] of obj) {
			cloned.set(deepClone(key, seen), deepClone(value, seen));
		}
		return cloned as unknown as V;
	}
	if (obj instanceof Set) {
		const cloned = new Set<unknown>();
		seen.set(obj, cloned);
		for (const value of obj) {
			cloned.add(deepClone(value, seen));
		}
		return cloned as unknown as V;
	}

	const cloned = Object.create(Object.getPrototypeOf(obj) as object | null) as Record<string, unknown>;
	seen.set(obj, cloned);
	for (const key of Object.keys(obj)) {
		// defineProperty, not assignment: an own key literally named `__proto__` (which
		// JSON.parse produces) would otherwise hit Object.prototype's setter and vanish.
		Object.defineProperty(cloned, key, {
			value: deepClone((obj as Record<string, unknown>)[key], seen),
			writable: true,
			enumerable: true,
			configurable: true,
		});
	}
	return cloned as V;
}

/**
 * Recursively freezes or seals a value and everything reachable from it.
 *
 * One implementation for both operations and both builders. The `seen` set makes it
 * cycle-safe - `buildDeepFrozen()` on self-referencing data previously threw a
 * `RangeError`. Functions are not traversed: walking into a function would freeze its
 * `prototype`, which may be an object the caller does not own.
 *
 * @internal
 */
export function deepHarden<V>(obj: V, mode: "freeze" | "seal", seen: WeakSet<object> = new WeakSet()): V {
	if (obj === null || typeof obj !== "object" || seen.has(obj)) {
		return obj;
	}
	seen.add(obj);

	for (const key of Object.getOwnPropertyNames(obj)) {
		const descriptor = Object.getOwnPropertyDescriptor(obj, key);
		// Getters are left alone; reading one here could run arbitrary user code.
		if (descriptor && "value" in descriptor) {
			deepHarden(descriptor.value, mode, seen);
		}
	}

	return mode === "freeze" ? Object.freeze(obj) : Object.seal(obj);
}

/**
 * Builds the copy-on-write successor of an auto builder without invoking any constructor.
 *
 * Copy-on-write cannot call the subclass constructor: users write `constructor(data?)`,
 * which has no way to receive the base class's internal argument shape. But creating a bare
 * object off the prototype and assigning only the internal fields silently discards every
 * other field the subclass declared - and because the discarded name is then absent from
 * the target, the proxy hands back an auto-setter function for it, so `this.cache` reads as
 * a function rather than `undefined`. Carrying the source's own properties over first fixes
 * both halves of that.
 *
 * Subclass fields are carried **shallowly**: forks share the same field references, so a
 * `Map` held in a field is shared between every builder forked from it. That matches how
 * copy-on-write already treats nested data.
 *
 * @param source - The builder being forked. This is the Proxy; `Reflect.*` forwards to the
 * target, and copying descriptors preserves getters and non-enumerable fields.
 * @param internals - The internal fields to overwrite after the carry-over
 * @internal
 */
export function createBuilderCopy<S extends object>(source: S, internals: Record<string, unknown>): S {
	const copy = Object.create(Object.getPrototypeOf(source) as object) as Record<string, unknown>;
	for (const key of Reflect.ownKeys(source)) {
		const descriptor = Reflect.getOwnPropertyDescriptor(source, key);
		if (descriptor) {
			Object.defineProperty(copy, key, descriptor);
		}
	}
	Object.assign(copy, internals);
	return copy as S;
}

/**
 * Proxy handler shared by both auto builders. Real members always win; any other
 * accessed name becomes a bare property setter that delegates to the inherited
 * (hidden) `setProperty`, so copy-on-write re-proxies through `this.constructor`.
 * @internal
 */
export const autoSetterHandler: ProxyHandler<object> = {
	get(target, prop, receiver) {
		// Symbols (Symbol.toPrimitive, Symbol.iterator, inspection hooks, ...) forward to the target.
		if (typeof prop === "symbol") {
			return Reflect.get(target, prop, receiver);
		}
		// Reserved names are checked before `prop in target` so this branch stays the single
		// source of truth: a name is reserved because the list says so, not because it happens
		// to resolve on the prototype chain today. `SetterName` is derived from the same list,
		// so the generated types and this runtime can never disagree. `then`/`toJSON` are the
		// two entries with no backing member; `Reflect.get` returns undefined for them, which
		// is exactly what makes `await builder` resolve and `JSON.stringify` skip them.
		// `auto-builder-core-reserved-names.test.ts` fails if a member escapes the list.
		if (RESERVED_SET.has(prop)) {
			return Reflect.get(target, prop, receiver);
		}
		// Subclass custom methods and own fields are not reserved but must still win.
		if (prop in target) {
			return Reflect.get(target, prop, receiver);
		}
		const key = setterNameToKey(prop);
		return (value: unknown) =>
			(receiver as { setProperty(k: PropertyKey, v: unknown): unknown }).setProperty(key, value);
	},
};

/**
 * Options accepted by an auto builder's constructor.
 *
 * The two base builders take `requiredFields` and `validators` in opposite positional
 * order (`CeriosBuilder` is `(data, requiredFields, validators)`, `CeriosClassBuilder` is
 * `(classConstructor, data, validators, requiredFields)`). Naming them removes that trap
 * and lets both auto builders expose one identical constructor shape.
 *
 * @template T - The type being built
 * @template P - The valid required-field path type for this builder
 */
export type BuilderInit<T extends object, P, Data extends object = T> = {
	requiredFields?: ReadonlyArray<P> | RequiredFieldsRecord<Data>;
	validators?: Array<(obj: Partial<T>) => boolean | string>;
};

/**
 * The return type of a base-builder function: the concrete builder TBuilder extended with
 * the shared-logic class instance TShared.
 *
 * A class declared inside a generic function keeps its base type at the *constraint* of
 * the type parameter - the concrete builder's own setters and statics would vanish from
 * the returned type without this annotation. The instance intersection puts
 * `InstanceType<TBuilder>` first so that where a property setter exists on both sides
 * (base view and derived builder), calls resolve to the derived flavor and brand the
 * derived type's build gate.
 *
 * @example
 * ```typescript
 * function BasePostRequestBuilder<TBuilder extends AutoBuilderBase<BasePostRequest>>(Builder: TBuilder) {
 *   abstract class PostRequestBuilder extends Builder {
 *     addTag(tag: string) {
 *       return this.tags([...(this.buildPartial().tags ?? []), tag]);
 *     }
 *   }
 *   return PostRequestBuilder as BuilderExtension<TBuilder, PostRequestBuilder>;
 * }
 * ```
 *
 * @template TBuilder - The concrete auto-builder constructor being extended
 * @template TShared - The instance type of the shared-logic class
 */
export type BuilderExtension<
	// oxlint-disable-next-line typescript/no-explicit-any -- the canonical mixin constraint; `any[]` keeps every builder constructor assignable
	TBuilder extends abstract new (...args: any[]) => object,
	TShared extends object,
> = (abstract new (...args: ConstructorParameters<TBuilder>) => InstanceType<TBuilder> & TShared) & {
	[K in keyof TBuilder]: TBuilder[K];
};

/**
 * Path segments that must never be written through, because assigning to them mutates a
 * prototype rather than the object itself.
 * @internal
 */
const UNSAFE_PATH_SEGMENTS: ReadonlySet<string> = new Set(["__proto__", "constructor", "prototype"]);

/**
 * Rejects dot-notation paths that would write through a prototype.
 *
 * `setNestedProperty("__proto__.x", v)` used to walk onto the clone's prototype and assign
 * there, so the write silently vanished from the built object. It is harmless today only
 * because the clone is always a fresh literal; refusing the path keeps it that way.
 *
 * @throws {Error} If any segment of the path is `__proto__`, `constructor`, or `prototype`
 * @internal
 */
export function assertSafePath(path: string): void {
	for (const segment of path.split(".")) {
		if (UNSAFE_PATH_SEGMENTS.has(segment)) {
			throw new Error(
				`Unsafe property path "${path}": the segment "${segment}" would write through a prototype rather than the object.`,
			);
		}
	}
}

/**
 * Rejects a single property key that would write through a prototype.
 *
 * Guarding only dot-notation paths was not enough. `__proto__` was reserved, so
 * `SetterName` generated a `__proto__Prop` setter, and `setterNameToKey` mapped it straight
 * back to `__proto__`. On the class builder the resulting `Object.assign` then re-parented
 * the built instance, so it silently stopped being an instance of its own class and lost
 * every method.
 *
 * @throws {Error} If the key is `__proto__`, `constructor`, or `prototype`
 * @internal
 */
export function assertSafeKey(key: PropertyKey): void {
	// Only `__proto__` is rejected here, not the whole `UNSAFE_PATH_SEGMENTS` set.
	// `constructor` and `prototype` are ordinary writable data properties when used as a
	// single key - it is only *walking through* them that reaches a prototype, which is
	// what `assertSafePath` guards. `__proto__` is different: it has an inherited setter,
	// so assigning it re-parents the object.
	if (key === "__proto__") {
		throw new Error(`Unsafe property key "__proto__": writing it would re-parent the object.`);
	}
}

/**
 * Guards the auto-builder constructors' `init` argument.
 *
 * `setRequiredFields` accepts a bare {@link RequiredFieldsRecord}, so passing that same
 * record straight to the constructor - `new B({}, { name: true })` - is an easy mistake.
 * It structurally matches `BuilderInit`, so it used to be accepted silently and produce a
 * builder with *zero* required fields: validation then passed for every incomplete object.
 * Failing loudly is the only safe response.
 *
 * @throws {Error} If the object has keys but none of them are `BuilderInit` keys
 * @internal
 */
export function assertBuilderInit(init: object): void {
	const keys = Object.keys(init);
	if (keys.length === 0 || keys.some((key) => key === "requiredFields" || key === "validators")) {
		return;
	}
	throw new Error(
		`Invalid builder options: expected { requiredFields?, validators? } but received keys ${keys
			.map((key) => `"${key}"`)
			.join(", ")}. ` + "If you meant to declare required fields, wrap them: { requiredFields: { ... } }.",
	);
}

/**
 * Normalises the two accepted required-field shapes - an array of dot-notation paths, or
 * an exhaustive {@link RequiredFieldsRecord} - to the array of paths used internally.
 *
 * @internal
 */
export function toRequiredPaths(fields: ReadonlyArray<unknown> | object): ReadonlyArray<string> {
	return (Array.isArray(fields) ? fields : Object.keys(fields)) as ReadonlyArray<string>;
}

/**
 * The members both auto builders declare identically once their two axes of variation are
 * named: the data view (`T` itself, or `DataPropertiesOnly<T>` for classes) and the brand
 * used to gate the validated build variants.
 *
 * `setProperty`, `setNestedProperty`, and `addToArrayProperty` are deliberately **not**
 * here or anywhere on the auto-builder API: an auto builder sets a whole root property
 * through its generated setter, and anything finer-grained belongs in a custom method or
 * in a director composing multiple builders.
 *
 * @template T - The type being built
 * @template Data - The settable view of T (`T`, or `DataPropertiesOnly<T>` for classes)
 * @template Brand - The phantom brand that gates the validated build variants
 * @template PathType - The valid required-field path type for this builder
 */
export interface CommonAutoBuilderApi<T extends object, Data extends object, Brand, PathType> {
	/**
	 * Builds with compile-time and runtime validation.
	 * Only callable once every required property has been set.
	 * @throws {Error} If a required field is missing or a validator fails
	 */
	build(this: this & Brand): T;

	/**
	 * Builds with compile-time validation only, skipping runtime checks.
	 */
	buildWithoutRuntimeValidation(this: this & Brand): T;

	/**
	 * Builds with runtime validation only, skipping compile-time checks.
	 * @throws {Error} If a required field is missing or a validator fails
	 */
	buildWithoutCompileTimeValidation(): T;

	/**
	 * Builds without any validation.
	 */
	buildUnsafe(): T;

	/**
	 * Returns the current (possibly incomplete) state. No validation.
	 */
	buildPartial(): Partial<T>;

	/**
	 * Builds, validates, and shallowly freezes the result.
	 * @throws {Error} If a required field is missing or a validator fails
	 */
	buildFrozen(this: this & Brand): Readonly<T>;

	/**
	 * Builds, validates, and recursively freezes the result.
	 * @throws {Error} If a required field is missing or a validator fails
	 */
	buildDeepFrozen(this: this & Brand): DeepReadonly<T>;

	/**
	 * Builds, validates, and shallowly seals the result.
	 * @throws {Error} If a required field is missing or a validator fails
	 */
	buildSealed(this: this & Brand): T;

	/**
	 * Builds, validates, and recursively seals the result.
	 * @throws {Error} If a required field is missing or a validator fails
	 */
	buildDeepSealed(this: this & Brand): T;

	/**
	 * Creates an independent copy of the builder with deep-cloned state.
	 *
	 * Declared in the same generic-`Self` shape as the generated setters (rather than
	 * returning `this`) so the base-builder views can expose it while every derived builder
	 * stays assignable to them. `Self` infers to the receiver, so calls behave exactly as a
	 * `this` return would.
	 */
	clone<Self>(this: Self): Self;

	/**
	 * Adds a custom validator that runs during build.
	 *
	 * Generic-`Self` shaped for the same reason as {@link clone}.
	 */
	addValidator<Self>(this: Self, validator: (obj: Partial<T>) => boolean | string): Self;

	/**
	 * Sets the runtime-validated required field paths.
	 *
	 * Accepts either an array of dot-notation paths, or an exhaustive
	 * {@link RequiredFieldsRecord} that the compiler forces you to keep complete.
	 */
	setRequiredFields(fields: ReadonlyArray<PathType> | RequiredFieldsRecord<Data>): this;

	/**
	 * Removes a previously set optional property.
	 */
	removeOptionalProperty<K extends OptionalKeys<Data>>(key: K): this;

	/**
	 * Clears all optional properties, keeping the required ones.
	 */
	clearOptionalProperties(): this;
}

/**
 * Picks the properties to keep when clearing optional properties.
 *
 * A required path may be nested (`"address.city"`), in which case the whole root property
 * (`address`) is preserved - the required leaf cannot survive without it. Shared by both
 * base builders so the two cannot drift; `CeriosClassBuilder` previously treated
 * `"address.city"` as a single literal key, found no match, and dropped `address` entirely.
 *
 * @internal
 */
export function pickRequiredRoots<T extends object>(
	actual: Partial<T>,
	requiredPaths: ReadonlyArray<string>,
): Partial<T> {
	const kept: Partial<T> = {};
	for (const path of requiredPaths) {
		const rootKey = path.split(".")[0] as keyof T;
		if (rootKey in actual && !(rootKey in kept)) {
			kept[rootKey] = actual[rootKey];
		}
	}
	return kept;
}
