import { describe, expect, expectTypeOf, it } from "vitest";

import { CeriosClassAutoBuilder } from "../../src/cerios-class-auto-builder";
import { CeriosClassBuilder, ClassBuilderComposerFromFactory, ClassBuilderWith } from "../../src/cerios-class-builder";

class Person {
	name!: string;
	age!: number;
	city!: string;

	constructor(data?: Partial<Person>) {
		if (data) Object.assign(this, data);
	}

	greet(): string {
		return `Hi, ${this.name}`;
	}

	// A method with parameters - must never count as a property to set.
	describe(prefix: string): string {
		return `${prefix} ${this.name} (${this.age})`;
	}
}

class Company {
	title!: string;
	constructor(data?: Partial<Company>) {
		if (data) Object.assign(this, data);
	}
}

class Team {
	title!: string;
	lead!: Person;

	constructor(data?: Partial<Team>) {
		if (data) Object.assign(this, data);
	}

	summary(): string {
		return `${this.title} led by ${this.lead.name}`;
	}
}

class PersonBuilder extends CeriosClassAutoBuilder(Person) {
	static create(): PersonBuilder {
		return new PersonBuilder();
	}

	static createWithDefaults(): ClassBuilderWith<PersonBuilder, "city"> {
		return PersonBuilder.create().city("Rotterdam");
	}

	static createComplete(): ClassBuilderWith<PersonBuilder> {
		return PersonBuilder.create().name("Alice").age(30).city("Rotterdam");
	}
}

class CompanyBuilder extends CeriosClassAutoBuilder(Company) {
	static create(): CompanyBuilder {
		return new CompanyBuilder();
	}
}

class TeamBuilder extends CeriosClassAutoBuilder(Team) {
	static create(): TeamBuilder {
		return new TeamBuilder();
	}

	asSquad(): ClassBuilderWith<this, "title"> {
		return this.title("squad");
	}

	withLead(fn: ClassBuilderComposerFromFactory<typeof PersonBuilder.create>): ClassBuilderWith<this, "lead"> {
		return this.lead(fn(PersonBuilder.create()).build());
	}

	withLeadDefaults(
		fn: ClassBuilderComposerFromFactory<typeof PersonBuilder.createWithDefaults>,
	): ClassBuilderWith<this, "lead"> {
		return this.lead(fn(PersonBuilder.createWithDefaults()).build());
	}

	withDefaultLead(
		fn?: ClassBuilderComposerFromFactory<typeof PersonBuilder.createComplete>,
	): ClassBuilderWith<this, "lead"> {
		const builder = PersonBuilder.createComplete();
		return this.lead(fn ? fn(builder).build() : builder.build());
	}
}

describe("CeriosClassAutoBuilder - nested builder composition", () => {
	it("composes a nested class builder and preserves class methods", () => {
		const team = TeamBuilder.create()
			.asSquad()
			.withLead((b) => b.name("Alice").age(30).city("Rotterdam"))
			.build();

		expectTypeOf(team).toEqualTypeOf<Team>();
		expect(team).toBeInstanceOf(Team);
		expect(team.lead).toBeInstanceOf(Person);
		expect(team.lead.greet()).toBe("Hi, Alice");
		expect(team.summary()).toBe("squad led by Alice");
		expect(team.lead.describe("Lead:")).toBe("Lead: Alice (30)");
	});

	it("treats data properties preset by the factory as already set", () => {
		const team = TeamBuilder.create()
			.title("t")
			// `city` is preset by createWithDefaults and must not be required here
			.withLeadDefaults((b) => b.name("Bob").age(41))
			.build();

		expect(team.lead.city).toBe("Rotterdam");
		expect(team.lead).toBeInstanceOf(Person);
	});

	it("makes the callback optional when the factory presets every data property", () => {
		const team = TeamBuilder.create().title("t").withDefaultLead().build();
		expect(team.lead.greet()).toBe("Hi, Alice");

		const overridden = TeamBuilder.create()
			.title("t")
			.withDefaultLead((b) => b.name("Carol"))
			.build();
		expect(overridden.lead.name).toBe("Carol");
	});

	it("rejects a callback that returns an incompletely-set child builder", () => {
		// @ts-expect-error - age and city are never set on the nested person builder
		TeamBuilder.create().withLead((b) => b.name("Alice"));

		// @ts-expect-error - name and age still missing even with the city default
		TeamBuilder.create().withLeadDefaults((b) => b);

		// the compile-time gate above matches the actual runtime state
		expect(PersonBuilder.create().name("Alice").buildPartial()).toEqual({ name: "Alice" });
		expect(PersonBuilder.createWithDefaults().buildPartial()).toEqual({ city: "Rotterdam" });
	});

	it("rejects a callback that returns a builder for a different class", () => {
		// @ts-expect-error - CompanyBuilder does not build a Person
		TeamBuilder.create().withLead(() => CompanyBuilder.create().title("acme"));

		expect(CompanyBuilder.create().title("acme").build()).toBeInstanceOf(Company);
	});

	it("still gates the parent builder until every data property is set", () => {
		// @ts-expect-error - lead is not set
		TeamBuilder.create().asSquad().build();

		// @ts-expect-error - title is not set
		TeamBuilder.create().withDefaultLead().build();

		expect(Object.keys(TeamBuilder.create().asSquad().buildPartial())).toEqual(["title"]);
	});
});

describe("ClassBuilderWith", () => {
	it("accumulates across custom methods rather than replacing prior state", () => {
		const partial = TeamBuilder.create().asSquad();

		// @ts-expect-error - lead still missing
		partial.build();

		expect(partial.withDefaultLead().build().title).toBe("squad");
	});

	it("never requires class methods to be set", () => {
		// Person has greet() and describe(prefix) - build() is reachable with data only.
		const person = PersonBuilder.create().name("Dave").age(20).city("Utrecht").build();
		expect(person.greet()).toBe("Hi, Dave");
	});

	it("still resolves for hand-written CeriosClassBuilder subclasses", () => {
		class PlainPersonBuilder extends CeriosClassBuilder<Person> {
			static create(): PlainPersonBuilder {
				return new PlainPersonBuilder(Person);
			}
			static createWithDefaults(): ClassBuilderWith<PlainPersonBuilder, "city"> {
				return PlainPersonBuilder.create().city("Rotterdam");
			}
			name(value: string): ClassBuilderWith<this, "name"> {
				return this.setProperty("name", value);
			}
			age(value: number): ClassBuilderWith<this, "age"> {
				return this.setProperty("age", value);
			}
			city(value: string): ClassBuilderWith<this, "city"> {
				return this.setProperty("city", value);
			}
		}

		const person = PlainPersonBuilder.createWithDefaults().name("Eve").age(33).build();
		expect(person).toBeInstanceOf(Person);
		expect(person.greet()).toBe("Hi, Eve");

		// @ts-expect-error - age missing
		PlainPersonBuilder.createWithDefaults().name("Eve").build();
	});
});
