import { describe, expect, it } from "vitest";

import { CeriosClassAutoBuilder } from "../../src/cerios-class-auto-builder";

class Doc {
	title!: string;
	body?: string;

	constructor(data?: Partial<Doc>) {
		if (data) {
			Object.assign(this, data);
		}
	}
}

// Same contract as the object auto builder: copy-on-write bypasses the subclass
// constructor, so it must carry the subclass's own fields across itself.
class TrackingBuilder extends CeriosClassAutoBuilder(Doc) {
	log: string[] = [];

	static create(): TrackingBuilder {
		return new TrackingBuilder();
	}

	track(message: string): this {
		this.log.push(message);
		return this;
	}
}

describe("CeriosClassAutoBuilder - subclass instance state across copy-on-write", () => {
	it("keeps a subclass field after a setter call", () => {
		const forked = TrackingBuilder.create().title("t");

		expect(Array.isArray(forked.log)).toBe(true);
	});

	it("does not shadow a subclass field with an auto setter", () => {
		expect(typeof TrackingBuilder.create().title("t").log).not.toBe("function");
	});

	it("leaves subclass methods usable after a setter call", () => {
		const forked = TrackingBuilder.create().title("t").track("set title");

		expect(forked.log).toEqual(["set title"]);
	});

	it("keeps subclass fields through clone()", () => {
		expect(Array.isArray(TrackingBuilder.create().title("t").clone().log)).toBe(true);
	});

	it("keeps subclass fields through setRequiredFields() and removeOptionalProperty()", () => {
		const configured = TrackingBuilder.create().setRequiredFields(["title"]).title("t").body("b");

		expect(Array.isArray(configured.log)).toBe(true);
		expect(Array.isArray(configured.removeOptionalProperty("body").log)).toBe(true);
	});

	it("carries subclass reference fields shallowly - every fork shares one instance", () => {
		// Copy-on-write carries subclass fields by reference, deliberately: only the target
		// data is deep-cloned. A mutable field like an array is therefore aliased across
		// forks; per-fork state belongs in the target data, not in builder fields.
		const original = TrackingBuilder.create().track("created");
		const forked = original.title("t");

		expect(forked.log).toBe(original.log);
		forked.track("forked");
		expect(original.log).toEqual(["created", "forked"]);

		// clone() deep-clones only the target data; subclass fields stay shared too.
		expect(original.clone().log).toBe(original.log);
	});

	it("still builds a real class instance", () => {
		expect(TrackingBuilder.create().title("t").build()).toBeInstanceOf(Doc);
	});
});
