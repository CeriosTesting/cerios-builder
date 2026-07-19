import { describe, expect, expectTypeOf, it } from "vitest";

import { BuilderExtension } from "../../src/auto-builder-core";
import { AutoBuilderBase, CeriosAutoBuilder } from "../../src/cerios-auto-builder";
import { BuilderWith } from "../../src/cerios-builder";

type BasePostRequest = {
	postId: string;
	title?: string;
	content?: string;
	tags?: string[];
};

// Derived via intersection ...
type CreatePostRequest = BasePostRequest & {
	title: string;
	content: string;
	authorId: string;
};

// ... and derived via interface extends; both shapes must flow through keyof identically.
interface PatchPostRequest extends BasePostRequest {
	patchReason: string;
	notifySubscribers?: boolean;
}

/**
 * Shared builder logic for every post-request builder, written once against the base
 * type. The standard-builder equivalent is an abstract class generic over
 * `T extends BasePostRequest`; a base-class expression cannot reference the class's own
 * type parameter, so for auto builders the shared logic lives in a base-builder function
 * applied on top of each concrete auto builder.
 */
// oxlint-disable-next-line typescript/explicit-function-return-type -- the return type names the class declared inside; BuilderExtension is applied in the return statement
function BasePostRequestBuilder<TBuilder extends AutoBuilderBase<BasePostRequest>>(Builder: TBuilder) {
	abstract class PostRequestBuilder extends Builder {
		addTag(tag: string): BuilderWith<this, "tags"> {
			return this.tags([...(this.buildPartial().tags ?? []), tag]);
		}

		generatedPostId(): BuilderWith<this, "postId"> {
			// postId is required on the base type, so this brand counts toward every
			// derived builder's build gate.
			return this.postId(`post-${this.buildPartial().title?.length ?? 0}`);
		}
	}
	return PostRequestBuilder as BuilderExtension<TBuilder, PostRequestBuilder>;
}

class CreatePostRequestBuilder extends BasePostRequestBuilder(CeriosAutoBuilder<CreatePostRequest>()) {
	static create(): CreatePostRequestBuilder {
		return new CreatePostRequestBuilder({}, { requiredFields: ["postId", "title", "content", "authorId"] });
	}
}

class PatchPostRequestBuilder extends BasePostRequestBuilder(CeriosAutoBuilder<PatchPostRequest>()) {
	static create(): PatchPostRequestBuilder {
		return new PatchPostRequestBuilder({}, { requiredFields: ["postId", "patchReason"] });
	}
}

describe("CeriosAutoBuilder - base type extension", () => {
	it("generates setters for inherited properties on a derived intersection type", () => {
		const request = CreatePostRequestBuilder.create()
			.postId("post-100")
			.title("Builder Patterns")
			.content("Compile-time safety is great.")
			.authorId("author-1")
			.addTag("typescript")
			.addTag("builders")
			.build();

		expect(request).toEqual({
			postId: "post-100",
			title: "Builder Patterns",
			content: "Compile-time safety is great.",
			authorId: "author-1",
			tags: ["typescript", "builders"],
		});
	});

	it("generates setters for inherited properties on a derived interface", () => {
		const request = PatchPostRequestBuilder.create()
			.postId("post-200")
			.patchReason("Fix typo")
			.title("Fixed title")
			.notifySubscribers(true)
			.build();

		expect(request).toEqual({
			postId: "post-200",
			patchReason: "Fix typo",
			title: "Fixed title",
			notifySubscribers: true,
		});
	});

	it("shares custom methods across derived builders and preserves the fluent API", () => {
		const request = PatchPostRequestBuilder.create()
			.title("Patched")
			.generatedPostId()
			.patchReason("Patch")
			.addTag("shared")
			.build();

		expect(request.postId).toBe("post-7");
		expect(request.patchReason).toBe("Patch");
		expect(request.tags).toEqual(["shared"]);
	});

	it("counts a shared method's setter brand toward the derived build gate", () => {
		// generatedPostId() brands postId via the base type; the gate for the derived
		// type must accept it just like a direct .postId() call.
		const request = CreatePostRequestBuilder.create().title("t").content("c").authorId("a").generatedPostId().build();

		expectTypeOf(request).toEqualTypeOf<CreatePostRequest>();
		expect(request.postId).toBe("post-1");
	});

	it("gates build() per derived type at compile time", () => {
		expect(() => {
			// @ts-expect-error - authorId (derived-only, required) not set
			return CreatePostRequestBuilder.create().postId("p").title("t").content("c").build();
		}).toThrow("Missing required fields: authorId");
		expect(() => {
			// @ts-expect-error - title (inherited, strengthened to required) not set
			return CreatePostRequestBuilder.create().postId("p").content("c").authorId("a").build();
		}).toThrow("Missing required fields: title");
		expect(() => {
			// @ts-expect-error - postId (inherited, required) not set
			return PatchPostRequestBuilder.create().patchReason("r").build();
		}).toThrow("Missing required fields: postId");

		const complete = PatchPostRequestBuilder.create().postId("p").patchReason("r");
		expectTypeOf(complete.build()).toEqualTypeOf<PatchPostRequest>();
		expect(complete.build()).toEqual({ postId: "p", patchReason: "r" });
	});

	it("validates required fields per derived builder independently at runtime", () => {
		expect(() =>
			CreatePostRequestBuilder.create()
				.postId("post-500")
				.title("Missing author")
				.content("No author yet")
				.buildWithoutCompileTimeValidation(),
		).toThrow("Missing required fields: authorId");

		expect(() => PatchPostRequestBuilder.create().postId("post-501").buildWithoutCompileTimeValidation()).toThrow(
			"Missing required fields: patchReason",
		);
	});

	it("clone preserves the concrete builder including shared methods", () => {
		const cloned = PatchPostRequestBuilder.create()
			.postId("post-400")
			.patchReason("Initial reason")
			.clone()
			.notifySubscribers(true)
			.patchReason("Updated reason")
			.addTag("cloned");

		expect(cloned.build()).toEqual({
			postId: "post-400",
			patchReason: "Updated reason",
			notifySubscribers: true,
			tags: ["cloned"],
		});
	});

	it("keeps the static from() available through the base-builder function", () => {
		const existing: CreatePostRequest = {
			postId: "post-600",
			title: "Seeded",
			content: "From an existing request",
			authorId: "author-2",
		};

		const request = CreatePostRequestBuilder.from(existing).addTag("seeded").build();

		expect(request).toEqual({ ...existing, tags: ["seeded"] });
		// The seed was deep-cloned, not aliased.
		expect(existing.tags).toBeUndefined();
	});
});
