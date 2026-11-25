/**
 * The error thrown by every validating build variant.
 *
 * The message text is unchanged from when these were plain `Error`s, so existing
 * string-matching callers keep working. The structured fields are the reason this type
 * exists: they let callers branch on *what* failed without parsing the message.
 *
 * @example
 * ```typescript
 * try {
 *   builder.build();
 * } catch (error) {
 *   if (error instanceof CeriosBuilderError && error.missingFields.length > 0) {
 *     promptFor(error.missingFields);
 *   }
 * }
 * ```
 */
export class CeriosBuilderError extends Error {
	/** Required field paths that were not set. Empty when a validator failed instead. */
	readonly missingFields: ReadonlyArray<string>;

	/** Messages from failed validators. Empty when required fields were missing instead. */
	readonly validationErrors: ReadonlyArray<string>;

	constructor(message: string, missingFields: ReadonlyArray<string>, validationErrors: ReadonlyArray<string>) {
		super(message);
		this.name = "CeriosBuilderError";
		this.missingFields = missingFields;
		this.validationErrors = validationErrors;
		// Required for `instanceof` to work when the package is compiled down to ES5.
		Object.setPrototypeOf(this, CeriosBuilderError.prototype);
	}
}

/**
 * Describes a validator for error messages: its index, plus its name when it has one.
 * Arrow functions assigned to a `const` are named; truly anonymous ones are not.
 */
function describeValidator(validator: unknown, index: number): string {
	const name = (validator as { name?: string }).name;
	return name ? `Validator #${index} (${name})` : `Validator #${index}`;
}

/**
 * The result of running the validators.
 * @internal
 */
export interface ValidatorFailures {
	/** One message per failing validator, in validator order. */
	readonly messages: string[];
	/** Whether any validator failed by returning `false`, i.e. without an explanation. */
	readonly anyReturnedFalse: boolean;
}

/**
 * Throws the error for required fields that are not set, or for failing validators.
 *
 * Shared by both base builders, which previously each built these messages themselves.
 *
 * The message text starts exactly as it always did, so callers matching on it keep working;
 * only a plain-language hint is appended. `missingFields` and `validationErrors` are unchanged.
 *
 * @param methodName - The build variant being run, named in the message
 * @param missing - Required field paths that are not set
 * @param validation - The validator results; only consulted when nothing is missing
 * @throws {CeriosBuilderError} If anything is missing or any validator failed
 * @internal
 */
export function throwIfInvalid(
	methodName: string,
	missing: ReadonlyArray<string>,
	validation: () => ValidatorFailures,
): void {
	if (missing.length > 0) {
		throw new CeriosBuilderError(
			`Missing required fields: ${missing.join(", ")}. Please set these fields before calling ${methodName}. ` +
				"If an incomplete object is intended (e.g. a negative test), use buildUnsafe() or buildPartial().",
			missing,
			[],
		);
	}

	const { messages, anyReturnedFalse } = validation();
	if (messages.length > 0) {
		const tip = anyReturnedFalse
			? ". Tip: return an error message string instead of false to explain what is wrong."
			: "";
		throw new CeriosBuilderError(`Validation failed: ${messages.join("; ")}${tip}`, [], messages);
	}
}

/**
 * Runs every validator and collects the failures.
 *
 * Shared by both base builders, which previously held byte-identical private copies.
 *
 * Two behaviours differ from those copies, both of which were silent failures:
 * - A validator returning `false` used to push the bare string `"Validation failed"`, so
 *   three failing validators produced `"Validation failed: Validation failed; Validation
 *   failed; Validation failed"` and you could not tell which one failed. It now names the
 *   validator.
 * - A validator returning anything other than `true`, `false`, or a non-empty string - most
 *   easily `undefined`, from a function that forgot to return - used to count as a *pass*.
 *   It is now an error, because silently accepting invalid data is the worse outcome.
 *
 * @param validators - The validators to run
 * @param actual - The current builder state to validate
 * @returns One message per failure, in validator order, and whether any returned `false`
 * @internal
 */
export function runValidatorsAgainst<T>(
	validators: ReadonlyArray<(obj: Partial<T>) => boolean | string>,
	actual: Partial<T>,
): ValidatorFailures {
	const errors: string[] = [];
	let anyReturnedFalse = false;

	for (const [index, validator] of validators.entries()) {
		const result = validator(actual);

		if (result === true) {
			continue;
		}
		if (result === false) {
			anyReturnedFalse = true;
			errors.push(`${describeValidator(validator, index)} returned false`);
			continue;
		}
		if (typeof result === "string" && result.length > 0) {
			errors.push(result);
			continue;
		}
		errors.push(
			`${describeValidator(validator, index)} returned ${result === "" ? "an empty string" : String(result)}; ` +
				"expected true, false, or a non-empty error message",
		);
	}

	return { messages: errors, anyReturnedFalse };
}
