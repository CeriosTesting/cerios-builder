import { describe, expect, it } from "vitest";

import { BuilderStep, CeriosBuilder } from "../../src/cerios-builder";

describe("CeriosBuilder.addToArrayProperty", () => {
	type Group = {
		name: string;
		members: string[];
		tags?: string[];
	};

	class GroupBuilder extends CeriosBuilder<Group> {
		static create(): GroupBuilder {
			return new GroupBuilder({});
		}

		name(value: string): BuilderStep<this, Group, "name"> {
			return this.setProperty("name", value);
		}

		addMember(member: string): BuilderStep<this, Group, "members"> {
			return this.addToArrayProperty("members", member);
		}

		addTag(tag: string): BuilderStep<this, Group, "tags"> {
			return this.addToArrayProperty("tags", tag);
		}
	}

	it("should add a value to an empty array property", () => {
		const group = GroupBuilder.create().name("Dev Team").addMember("Alice").build();

		expect(group).toEqual({
			name: "Dev Team",
			members: ["Alice"],
		});
	});

	it("should add multiple values to an array property", () => {
		const group = GroupBuilder.create().name("QA Team").addMember("Bob").addMember("Carol").build();

		expect(group).toEqual({
			name: "QA Team",
			members: ["Bob", "Carol"],
		});
	});

	it("should add to optional array property", () => {
		const group = GroupBuilder.create().name("Ops Team").addMember("Dave").addTag("on-call").addTag("remote").build();

		expect(group).toEqual({
			name: "Ops Team",
			members: ["Dave"],
			tags: ["on-call", "remote"],
		});
	});

	it("should not mutate previous builder instances", () => {
		const builder = GroupBuilder.create().name("Design Team");
		const withAlice = builder.addMember("Alice");
		const withBob = builder.addMember("Bob");

		expect(withAlice.build()).toEqual({
			name: "Design Team",
			members: ["Alice"],
		});
		expect(withBob.build()).toEqual({
			name: "Design Team",
			members: ["Bob"],
		});
	});

	it("should allow chaining addToArrayProperty with setProperty", () => {
		const group = GroupBuilder.create().addMember("Eve").name("Security Team").build();

		expect(group).toEqual({
			name: "Security Team",
			members: ["Eve"],
		});
	});
});
