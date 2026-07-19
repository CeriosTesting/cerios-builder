import { describe, expect, expectTypeOf, it } from "vitest";

import { CeriosClassBuilder, ClassBuilderStep } from "../../src/cerios-class-builder";

// Regression: DataPropertiesOnly must strip methods that take parameters, not only
// zero-arg methods. Before the `(...args: never[]) => unknown` fix, a parameterized
// method survived the filter and made build() impossible to satisfy.
class Account {
	id!: string;
	balance!: number;

	constructor(data?: Partial<Account>) {
		if (data) {
			Object.assign(this, data);
		}
	}

	deposit(amount: number): void {
		this.balance += amount;
	}

	describe(prefix: string, suffix: string): string {
		return `${prefix}${this.id}${suffix}`;
	}
}

class AccountBuilder extends CeriosClassBuilder<Account> {
	static create(): AccountBuilder {
		return new AccountBuilder(Account);
	}

	id(value: string): ClassBuilderStep<this, Account, "id"> {
		return this.setProperty("id", value);
	}

	balance(value: number): ClassBuilderStep<this, Account, "balance"> {
		return this.setProperty("balance", value);
	}
}

describe("CeriosClassBuilder - parameterized methods are excluded from data properties", () => {
	it("allows build() with only the data properties set", () => {
		const account = AccountBuilder.create().id("a-1").balance(100).build();

		expect(account).toBeInstanceOf(Account);
		expect(account.id).toBe("a-1");
		expect(account.balance).toBe(100);
		expectTypeOf(account).toEqualTypeOf<Account>();

		account.deposit(50);
		expect(account.balance).toBe(150);
		expect(account.describe("[", "]")).toBe("[a-1]");
	});
});
