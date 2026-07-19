import { describe, expect, expectTypeOf, it } from "vitest";

import { CeriosAutoBuilder } from "../../src/cerios-auto-builder";
import { BuilderComposerFromFactory, BuilderWith, CeriosBuilder } from "../../src/cerios-builder";

type Address = { street: string; city: string; country: string };
type Contact = { email: string };
type Customer = {
	id: string;
	tier: string;
	address: Address;
	meta: { note: string; source: string };
};

// Every builder below carries explicit return types on purpose: writing them by hand
// with a single two-argument helper is part of what these tests cover.
class AddressBuilder extends CeriosAutoBuilder<Address>() {
	static create(): AddressBuilder {
		return new AddressBuilder({});
	}

	static createWithDefaults(): BuilderWith<AddressBuilder, "country"> {
		return AddressBuilder.create().country("NL");
	}

	static createComplete(): BuilderWith<AddressBuilder> {
		return AddressBuilder.create().country("NL").street("Main St").city("Rotterdam");
	}
}

class ContactBuilder extends CeriosAutoBuilder<Contact>() {
	static create(): ContactBuilder {
		return new ContactBuilder({});
	}
}

class CustomerBuilder extends CeriosAutoBuilder<Customer>() {
	static create(): CustomerBuilder {
		return new CustomerBuilder({});
	}

	asVip(): BuilderWith<this, "tier"> {
		return this.tier("vip");
	}

	withNote(note: string): BuilderWith<this, "meta"> {
		return this.meta({ note, source: "manual" });
	}

	// Composer methods take a distinct name and delegate to the auto setter.
	withAddress(fn: BuilderComposerFromFactory<typeof AddressBuilder.create>): BuilderWith<this, "address"> {
		return this.address(fn(AddressBuilder.create()).build());
	}

	withAddressDefaults(
		fn: BuilderComposerFromFactory<typeof AddressBuilder.createWithDefaults>,
	): BuilderWith<this, "address"> {
		return this.address(fn(AddressBuilder.createWithDefaults()).build());
	}

	withCompleteAddress(
		fn?: BuilderComposerFromFactory<typeof AddressBuilder.createComplete>,
	): BuilderWith<this, "address"> {
		const builder = AddressBuilder.createComplete();
		return this.address(fn ? fn(builder).build() : builder.build());
	}
}

describe("CeriosAutoBuilder - nested builder composition", () => {
	it("composes a nested builder that has no defaults", () => {
		const customer = CustomerBuilder.create()
			.id("1")
			.asVip()
			.withNote("hello")
			.withAddress((b) => b.street("Main St").city("Rotterdam").country("NL"))
			.build();

		expectTypeOf(customer).toEqualTypeOf<Customer>();
		expect(customer.address).toEqual({ street: "Main St", city: "Rotterdam", country: "NL" });
		expect(customer.tier).toBe("vip");
		expect(customer.meta.note).toBe("hello");
	});

	it("treats keys preset by the factory as already set", () => {
		const customer = CustomerBuilder.create()
			.id("1")
			.asVip()
			.withNote("n")
			// `country` is preset by createWithDefaults and must not be required here
			.withAddressDefaults((b) => b.street("Main St").city("Rotterdam"))
			.build();

		expect(customer.address.country).toBe("NL");
	});

	it("makes the callback optional when the factory presets everything", () => {
		const customer = CustomerBuilder.create().id("1").asVip().withNote("n").withCompleteAddress().build();
		expect(customer.address).toEqual({ street: "Main St", city: "Rotterdam", country: "NL" });

		const overridden = CustomerBuilder.create()
			.id("1")
			.asVip()
			.withNote("n")
			.withCompleteAddress((b) => b.city("Amsterdam"))
			.build();
		expect(overridden.address.city).toBe("Amsterdam");
	});

	it("rejects a callback that returns an incompletely-set child builder", () => {
		// @ts-expect-error - city and country are never set on the nested address builder
		CustomerBuilder.create().withAddress((b) => b.street("Main St"));

		// @ts-expect-error - street and city still missing even with the country default
		CustomerBuilder.create().withAddressDefaults((b) => b);

		// the compile-time gate above matches the actual runtime state
		expect(AddressBuilder.create().street("Main St").buildPartial()).toEqual({ street: "Main St" });
		expect(AddressBuilder.createWithDefaults().buildPartial()).toEqual({ country: "NL" });
	});

	it("rejects a callback that returns a builder for a different target type", () => {
		// @ts-expect-error - ContactBuilder does not build an Address
		CustomerBuilder.create().withAddress(() => ContactBuilder.create().email("a@b.c"));

		expect(ContactBuilder.create().email("a@b.c").buildPartial()).toEqual({ email: "a@b.c" });
	});

	it("still gates the parent builder until every property is set", () => {
		// @ts-expect-error - tier, address and meta are not set
		CustomerBuilder.create().id("1").build();

		// @ts-expect-error - meta is not set
		CustomerBuilder.create().id("1").asVip().withCompleteAddress().build();

		expect(Object.keys(CustomerBuilder.create().id("1").asVip().withCompleteAddress().buildPartial()).sort()).toEqual([
			"address",
			"id",
			"tier",
		]);
	});
});

describe("BuilderWith", () => {
	it("accumulates across custom methods rather than replacing prior state", () => {
		const partial = CustomerBuilder.create().id("1").asVip();

		// @ts-expect-error - address and meta still missing
		partial.build();

		expect(partial.withNote("n").withCompleteAddress().build().id).toBe("1");
	});

	it("brands the root key when a method sets a nested value", () => {
		const customer = CustomerBuilder.create().id("1").asVip().withCompleteAddress().withNote("deep").build();
		expect(customer.meta).toEqual({ note: "deep", source: "manual" });
	});

	it("still resolves for hand-written CeriosBuilder subclasses", () => {
		class PlainAddressBuilder extends CeriosBuilder<Address> {
			static create(): PlainAddressBuilder {
				return new PlainAddressBuilder({});
			}
			static createWithDefaults(): BuilderWith<PlainAddressBuilder, "country"> {
				return PlainAddressBuilder.create().country("NL");
			}
			country(value: string): BuilderWith<this, "country"> {
				return this.setProperty("country", value);
			}
			street(value: string): BuilderWith<this, "street"> {
				return this.setProperty("street", value);
			}
			city(value: string): BuilderWith<this, "city"> {
				return this.setProperty("city", value);
			}
		}

		const address = PlainAddressBuilder.createWithDefaults().street("Main St").city("Rotterdam").build();
		expect(address).toEqual({ country: "NL", street: "Main St", city: "Rotterdam" });

		// @ts-expect-error - city missing
		PlainAddressBuilder.createWithDefaults().street("Main St").build();
	});
});
