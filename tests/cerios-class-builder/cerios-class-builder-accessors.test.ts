// oxlint-disable typescript/no-deprecated -- exercises the deprecated manual builder until its removal
import { describe, expect, it } from "vitest";

import { CeriosBuilderError } from "../../src/builder-error";
import { CeriosClassBuilder, ClassBuilderStep, ClassConstructor } from "../../src/cerios-class-builder";

class User {
	firstName!: string;
	lastName!: string;

	constructor(data?: Partial<User>) {
		if (data) {
			Object.assign(this, data);
		}
	}

	get displayName(): string {
		return `${this.firstName} ${this.lastName}`;
	}
}

class UserBuilder extends CeriosClassBuilder<User> {
	constructor(
		classConstructor: ClassConstructor<User> = User,
		data: Partial<User> = {},
		validators?: Array<(obj: Partial<User>) => boolean | string>,
		requiredFields?: Set<string>,
	) {
		super(classConstructor, data, validators, requiredFields);
	}

	firstName(value: string): ClassBuilderStep<this, User, "firstName"> {
		return this.setProperty("firstName", value);
	}

	lastName(value: string): ClassBuilderStep<this, User, "lastName"> {
		return this.setProperty("lastName", value);
	}

	displayName(value: string): ClassBuilderStep<this, User, "displayName"> {
		return this.setProperty("displayName", value);
	}
}

describe("CeriosClassBuilder - getter-only accessors", () => {
	it("throws a CeriosBuilderError when setProperty targets a getter-only accessor", () => {
		expect(() => new UserBuilder().displayName("Jane Doe")).toThrow(CeriosBuilderError);
		expect(() => new UserBuilder().displayName("Jane Doe")).toThrow(/"displayName" is a getter-only accessor on User/);
	});

	it("throws the same error when seed data contains a getter-only key", () => {
		class SeededBuilder extends CeriosClassBuilder<User> {
			constructor(data?: Partial<User>) {
				super(User, data);
			}
		}

		expect(() => new SeededBuilder({ displayName: "Jane Doe" })).toThrow(/getter-only accessor/);
	});

	it("builds normally when the getter-only accessor is never set", () => {
		const user = new UserBuilder().firstName("Jane").lastName("Doe").build();

		expect(user).toBeInstanceOf(User);
		expect(user.displayName).toBe("Jane Doe");
	});
});
