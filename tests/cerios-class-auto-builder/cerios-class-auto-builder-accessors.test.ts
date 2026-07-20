import { describe, expect, it } from "vitest";

import { CeriosBuilderError } from "../../src/builder-error";
import { CeriosClassAutoBuilder } from "../../src/cerios-class-auto-builder";

// Getter-only accessor: computed from data properties, no backing storage.
class User {
	firstName!: string;
	lastName!: string;

	get displayName(): string {
		return `${this.firstName} ${this.lastName}`;
	}
}

class UserBuilder extends CeriosClassAutoBuilder(User) {
	static create(): UserBuilder {
		return new UserBuilder();
	}
}

// No constructor assignment, so build() takes the post-construction assignment path -
// the path where a getter-only key in the state used to throw a bare TypeError.
class Report {
	title!: string;

	get heading(): string {
		return `Report: ${this.title}`;
	}
}

// Getter/setter pair: writable through the accessor, so the builder may set it.
class Temperature {
	celsius!: number;

	constructor(data?: Partial<Temperature>) {
		if (data) {
			Object.assign(this, data);
		}
	}

	get fahrenheit(): number {
		return this.celsius * 1.8 + 32;
	}

	set fahrenheit(value: number) {
		this.celsius = (value - 32) / 1.8;
	}
}

describe("CeriosClassAutoBuilder - getter-only accessors", () => {
	it("generates no setter for a getter-only accessor and guards untyped access at runtime", () => {
		// A getter-only accessor is `readonly` at the type level, so no setter is generated -
		// the compiler catches the misuse first. The runtime guard remains for untyped access
		// (types are erased at runtime, so the proxy cannot see `readonly`).
		expect(() =>
			// @ts-expect-error - displayName is a getter-only accessor, no setter exists
			UserBuilder.create().displayName("Jane Doe"),
		).toThrow(CeriosBuilderError);
		expect(() =>
			// @ts-expect-error - displayName is a getter-only accessor, no setter exists
			UserBuilder.create().displayName("Jane Doe"),
		).toThrow(/"displayName" is a getter-only accessor on User/);
	});

	it("throws the same error when seed data contains a getter-only key", () => {
		expect(() => new UserBuilder({ displayName: "Jane Doe" })).toThrow(CeriosBuilderError);
		expect(() => new UserBuilder({ displayName: "Jane Doe" })).toThrow(/getter-only accessor/);
	});

	it("builds normally when the getter-only accessor is never set", () => {
		const user = UserBuilder.create().firstName("Jane").lastName("Doe").build();

		expect(user).toBeInstanceOf(User);
		expect(user.displayName).toBe("Jane Doe");
	});

	it("builds through the post-construction assignment path without touching the accessor", () => {
		class ReportBuilder extends CeriosClassAutoBuilder(Report) {
			static create(): ReportBuilder {
				return new ReportBuilder();
			}
		}

		const report = ReportBuilder.create().title("Q3").build();

		expect(report).toBeInstanceOf(Report);
		expect(report.title).toBe("Q3");
		expect(report.heading).toBe("Report: Q3");
	});

	it("allows setting a getter/setter accessor pair and routes the value through the setter", () => {
		class TemperatureBuilder extends CeriosClassAutoBuilder(Temperature) {
			static create(): TemperatureBuilder {
				return new TemperatureBuilder();
			}
		}

		const temperature = TemperatureBuilder.create().celsius(0).fahrenheit(212).build();

		expect(temperature.celsius).toBe(100);
		expect(temperature.fahrenheit).toBe(212);
	});

	it("rejects a getter-only accessor inherited from a base class", () => {
		class Admin extends User {
			level!: number;
		}

		class AdminBuilder extends CeriosClassAutoBuilder(Admin) {
			static create(): AdminBuilder {
				return new AdminBuilder();
			}
		}

		expect(() =>
			// @ts-expect-error - displayName is an inherited getter-only accessor, no setter exists
			AdminBuilder.create().displayName("Root"),
		).toThrow(/getter-only accessor on Admin/);
	});

	it("allows a derived class that redeclares an inherited getter-only accessor with a setter", () => {
		class NamedUser extends User {
			private _override?: string;

			override get displayName(): string {
				return this._override ?? `${this.firstName} ${this.lastName}`;
			}

			override set displayName(value: string) {
				this._override = value;
			}
		}

		class NamedUserBuilder extends CeriosClassAutoBuilder(NamedUser) {
			static create(): NamedUserBuilder {
				return new NamedUserBuilder();
			}
		}

		const user = NamedUserBuilder.create().firstName("Jane").lastName("Doe").displayName("JD").build();

		expect(user.displayName).toBe("JD");
	});

	it("keeps rejecting getter-only accessors on copy-on-write forks", () => {
		const forked = UserBuilder.create().firstName("Jane").clone().lastName("Doe");

		// @ts-expect-error - displayName is a getter-only accessor, no setter exists
		expect(() => forked.displayName("Jane Doe")).toThrow(/getter-only accessor/);
		expect(forked.build().displayName).toBe("Jane Doe");
	});
});
