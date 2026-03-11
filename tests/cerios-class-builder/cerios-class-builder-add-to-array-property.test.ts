import { describe, expect, it } from "vitest";

import { CeriosClassBuilder, ClassBuilderStep, ClassConstructor } from "../../src/cerios-class-builder";

describe("CeriosClassBuilder.addToArrayProperty", () => {
	class Group {
		name!: string;
		members!: string[];
		tags?: string[];

		constructor(data?: Partial<Group>) {
			if (data) {
				Object.assign(this, data);
			}
		}
	}

	class GroupBuilder extends CeriosClassBuilder<Group> {
		constructor(
			classConstructor: ClassConstructor<Group> = Group,
			data: Partial<Group> = {},
			validators?: Array<(obj: Partial<Group>) => boolean | string>,
			requiredFields?: Set<string>,
		) {
			super(classConstructor, data, validators, requiredFields);
		}

		static create(): GroupBuilder {
			return new GroupBuilder();
		}

		name(value: string): ClassBuilderStep<this, Group, "name"> {
			return this.setProperty("name", value);
		}

		addMember(member: string): ClassBuilderStep<this, Group, "members"> {
			return this.addToArrayProperty("members", member);
		}

		addTag(tag: string): ClassBuilderStep<this, Group, "tags"> {
			return this.addToArrayProperty("tags", tag);
		}
	}

	it("should add a value to an empty array property", () => {
		const group = GroupBuilder.create().name("Dev Team").addMember("Alice").build();

		expect(group).toBeInstanceOf(Group);
		expect(group.name).toBe("Dev Team");
		expect(group.members).toEqual(["Alice"]);
	});

	it("should add multiple values to an array property", () => {
		const group = GroupBuilder.create().name("QA Team").addMember("Bob").addMember("Carol").build();

		expect(group).toBeInstanceOf(Group);
		expect(group.name).toBe("QA Team");
		expect(group.members).toEqual(["Bob", "Carol"]);
	});

	it("should add to optional array property", () => {
		const group = GroupBuilder.create().name("Ops Team").addMember("Dave").addTag("on-call").addTag("remote").build();

		expect(group).toBeInstanceOf(Group);
		expect(group.name).toBe("Ops Team");
		expect(group.members).toEqual(["Dave"]);
		expect(group.tags).toEqual(["on-call", "remote"]);
	});

	it("should not mutate previous builder instances", () => {
		const builder = GroupBuilder.create().name("Design Team");
		const withAlice = builder.addMember("Alice");
		const withBob = builder.addMember("Bob");

		const aliceGroup = withAlice.build();
		expect(aliceGroup).toBeInstanceOf(Group);
		expect(aliceGroup.name).toBe("Design Team");
		expect(aliceGroup.members).toEqual(["Alice"]);

		const bobGroup = withBob.build();
		expect(bobGroup).toBeInstanceOf(Group);
		expect(bobGroup.name).toBe("Design Team");
		expect(bobGroup.members).toEqual(["Bob"]);
	});

	it("should allow chaining addToArrayProperty with setProperty", () => {
		const group = GroupBuilder.create().addMember("Eve").name("Security Team").build();

		expect(group).toBeInstanceOf(Group);
		expect(group.name).toBe("Security Team");
		expect(group.members).toEqual(["Eve"]);
	});

	it("should preserve existing array values when cloning", () => {
		const builder1 = GroupBuilder.create().name("Marketing").addMember("Alice").addMember("Bob");
		const builder2 = builder1.addMember("Carol");

		const group1 = builder1.build();
		expect(group1.members).toEqual(["Alice", "Bob"]);

		const group2 = builder2.build();
		expect(group2.members).toEqual(["Alice", "Bob", "Carol"]);
	});

	it("should work with buildUnsafe", () => {
		const group = GroupBuilder.create().addMember("Alice").addTag("urgent").buildUnsafe();

		expect(group).toBeInstanceOf(Group);
		expect(group.members).toEqual(["Alice"]);
		expect(group.tags).toEqual(["urgent"]);
	});

	it("should work with buildPartial", () => {
		const partial = GroupBuilder.create().addMember("Alice").addMember("Bob").buildPartial();

		expect(partial.members).toEqual(["Alice", "Bob"]);
		expect(partial.name).toBeUndefined();
	});
});
