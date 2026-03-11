import { describe, expect, it } from "vitest";

import {
	CeriosClassBuilder,
	ClassBuilderComposerFromFactory,
	ClassBuilderPreset,
	ClassBuilderStep,
	ClassConstructor,
} from "../../src/cerios-class-builder";

class Address {
	street!: string;
	city!: string;
	country!: string;
	zipCode?: string;
}

class Customer {
	id!: string;
	name!: string;
	address!: Address;
	phoneNumber?: string;
	addressHistory?: Address[];
}

class AddressBuilder extends CeriosClassBuilder<Address> {
	constructor(classConstructor: ClassConstructor<Address> = Address, data: Partial<Address> = {}) {
		super(classConstructor, data);
	}

	static create(): AddressBuilder {
		return new AddressBuilder();
	}

	static createWithDefaults(): ClassBuilderPreset<AddressBuilder, Address, "city" | "country"> {
		return this.create().city("Othertown").country("United States");
	}

	street(value: string): ClassBuilderStep<this, Address, "street"> {
		return this.setProperty("street", value);
	}

	city(value: string): ClassBuilderStep<this, Address, "city"> {
		return this.setProperty("city", value);
	}

	country(value: string): ClassBuilderStep<this, Address, "country"> {
		return this.setProperty("country", value);
	}

	zipCode(value: string): ClassBuilderStep<this, Address, "zipCode"> {
		return this.setProperty("zipCode", value);
	}

	// Preset addresses
	asUSAddress(): ClassBuilderStep<this, Address, "country"> {
		return this.country("United States");
	}
}

class CustomerBuilder extends CeriosClassBuilder<Customer> {
	constructor(classConstructor: ClassConstructor<Customer> = Customer, data: Partial<Customer> = {}) {
		super(classConstructor, data);
	}

	static create(): CustomerBuilder {
		return new CustomerBuilder();
	}

	id(value: string): ClassBuilderStep<this, Customer, "id"> {
		return this.setProperty("id", value);
	}

	name(value: string): ClassBuilderStep<this, Customer, "name"> {
		return this.setProperty("name", value);
	}

	address(value: Address): ClassBuilderStep<this, Customer, "address"> {
		return this.setProperty("address", value);
	}

	phoneNumber(value: string): ClassBuilderStep<this, Customer, "phoneNumber"> {
		return this.setProperty("phoneNumber", value);
	}

	// Build address inline
	withAddress(
		builderFn: ClassBuilderComposerFromFactory<typeof AddressBuilder.create>,
	): ClassBuilderStep<this, Customer, "address"> {
		const address = builderFn(AddressBuilder.create()).build();
		return this.setProperty("address", address);
	}

	withAddressDefaults(
		builderFn: ClassBuilderComposerFromFactory<typeof AddressBuilder.createWithDefaults>,
	): ClassBuilderStep<this, Customer, "address"> {
		const address = builderFn(AddressBuilder.createWithDefaults()).build();
		return this.setProperty("address", address);
	}

	addAddressHistory(
		builderFn: ClassBuilderComposerFromFactory<typeof AddressBuilder.create>,
	): ClassBuilderStep<this, Customer, "addressHistory"> {
		const address = builderFn(AddressBuilder.create()).build();
		const currentHistory = this._actual.addressHistory ?? [];
		return this.setProperty("addressHistory", [...currentHistory, address]);
	}
}

describe("Cerios Class Builder Nested", () => {
	it("should build customer with all fields", () => {
		const customer = CustomerBuilder.create()
			.id("123")
			.name("John Doe")
			.withAddress((address) => address.street("123 Main St").city("Anytown").country("USA").zipCode("12345"))
			.phoneNumber("555-1234")
			.build();

		expect(customer).toEqual({
			id: "123",
			name: "John Doe",
			address: {
				street: "123 Main St",
				city: "Anytown",
				country: "USA",
				zipCode: "12345",
			},
			phoneNumber: "555-1234",
		});
	});

	it("should build customer with default address", () => {
		const customer = CustomerBuilder.create()
			.id("456")
			.name("Jane Smith")
			.withAddressDefaults((address) => address.street("456 Elm St"))
			.build();

		expect(customer).toEqual({
			id: "456",
			name: "Jane Smith",
			address: {
				street: "456 Elm St",
				city: "Othertown",
				country: "United States",
			},
		});
	});

	it("should build customer with address history", () => {
		const customer = CustomerBuilder.create()
			.id("789")
			.name("Alice Johnson")
			.withAddress((address) => address.street("789 Oak St").city("Oldtown").country("USA"))
			.addAddressHistory((address) => address.street("101 Pine St").city("Newtown").country("USA"))
			.addAddressHistory((address) => address.street("202 Maple St").city("Sometown").country("USA"))
			.build();

		expect(customer).toEqual({
			id: "789",
			name: "Alice Johnson",
			address: {
				street: "789 Oak St",
				city: "Oldtown",
				country: "USA",
			},
			addressHistory: [
				{
					street: "101 Pine St",
					city: "Newtown",
					country: "USA",
				},
				{
					street: "202 Maple St",
					city: "Sometown",
					country: "USA",
				},
			],
		});
	});
});
