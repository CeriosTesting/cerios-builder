import { CeriosBuilder } from "../src/cerios-builder";

export type Person = {
	name: string;
	age: number;
	email?: string;
};

export class PersonBuilder extends CeriosBuilder<Person> {
	private constructor(data: Partial<Person>) {
		super(data);
	}

	static create() {
		return new PersonBuilder({});
	}

	name(value: string) {
		return this.setProperty("name", value);
	}

	age(value: number) {
		return this.setProperty("age", value);
	}

	email(value: string) {
		return this.setProperty("email", value);
	}

	withAdultAge() {
		return this.setProperty("age", 18);
	}
}
