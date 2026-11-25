import ts from "typescript-6";
import { describe, expect, it } from "vitest";

// Editor experience for the generated setters: hovering one shows the JSDoc of the property
// it sets, and Go to Definition opens that property.
//
// This runs the TypeScript 6 language service (what VS Code bundles), because TypeScript 7
// (native) has no JavaScript language-service API. TypeScript 7 itself does not show JSDoc for
// any mapped-type property yet (not even `Partial<T>`), so these docs appear only on TS <= 6.

const SOURCE = `
import { CeriosAutoBuilder, CeriosClassAutoBuilder } from "../../src/index";

interface User {
	/** USER-ID-DOC */
	id: string;
	/** USER-AGE-DOC */
	age?: number;
}
class UserBuilder extends CeriosAutoBuilder<User>() {}
new UserBuilder().id("1").age(3);

type Base = {
	/** BASE-DOC */
	baseField: string;
};
type Derived = Base & {
	/** DERIVED-DOC */
	code: string;
};
class DerivedBuilder extends CeriosAutoBuilder<Derived>() {}
new DerivedBuilder().code("c").baseField("b");

class Person {
	/** PERSON-NAME-DOC */
	name!: string;
}
class PersonBuilder extends CeriosClassAutoBuilder(Person) {}
new PersonBuilder().name("n");
`;

// A virtual file next to this test, so the relative import resolves to the real sources.
// Vitest runs from the project root.
const testDirectory = `${ts.sys.getCurrentDirectory().replace(/\\/g, "/")}/tests/index`;
const fileName = `${testDirectory}/__editor-hover__.ts`;

function createService(): ts.LanguageService {
	const options: ts.CompilerOptions = {
		strict: true,
		target: ts.ScriptTarget.ES2019,
		module: ts.ModuleKind.CommonJS,
		skipLibCheck: true,
		noEmit: true,
	};
	const host: ts.LanguageServiceHost = {
		getCompilationSettings: () => options,
		getScriptFileNames: () => [fileName],
		getScriptVersion: () => "1",
		getScriptSnapshot: (name) => {
			const text = name === fileName ? SOURCE : ts.sys.readFile(name);
			return text === undefined ? undefined : ts.ScriptSnapshot.fromString(text);
		},
		getCurrentDirectory: () => testDirectory,
		getDefaultLibFileName: (o) => ts.getDefaultLibFilePath(o),
		fileExists: (name) => name === fileName || ts.sys.fileExists(name),
		readFile: (name) => (name === fileName ? SOURCE : ts.sys.readFile(name)),
		readDirectory: (...args) => ts.sys.readDirectory(...args),
		directoryExists: (name) => ts.sys.directoryExists(name),
		getDirectories: (name) => ts.sys.getDirectories(name),
	};
	return ts.createLanguageService(host, ts.createDocumentRegistry());
}

const service = createService();

/** Position of the setter name in the first `<setterCall>` occurrence, e.g. `id("1")`. */
function positionOf(setterCall: string): number {
	const index = SOURCE.indexOf(setterCall);
	if (index < 0) {
		throw new Error(`"${setterCall}" not found in the test source`);
	}
	return index;
}

function hoverDocs(setterCall: string): string {
	const info = service.getQuickInfoAtPosition(fileName, positionOf(setterCall));
	return ts.displayPartsToString(info?.documentation);
}

function definitionText(setterCall: string): string | undefined {
	const [definition] = service.getDefinitionAtPosition(fileName, positionOf(setterCall)) ?? [];
	return definition && SOURCE.slice(definition.textSpan.start, definition.textSpan.start + definition.textSpan.length);
}

describe("editor hover on generated setters (TypeScript 6 language service)", () => {
	it("compiles the hover fixture without errors", () => {
		const diagnostics = [...service.getSyntacticDiagnostics(fileName), ...service.getSemanticDiagnostics(fileName)].map(
			(d) => ts.flattenDiagnosticMessageText(d.messageText, "\n"),
		);
		expect(diagnostics).toEqual([]);
	});

	it("shows the property's JSDoc for an interface", () => {
		expect(hoverDocs(`id("1")`)).toBe("USER-ID-DOC");
		expect(hoverDocs(`age(3)`)).toBe("USER-AGE-DOC");
	});

	it("shows the property's JSDoc for an intersection type alias, including the base part", () => {
		expect(hoverDocs(`code("c")`)).toBe("DERIVED-DOC");
		expect(hoverDocs(`baseField("b")`)).toBe("BASE-DOC");
	});

	it("shows the field's JSDoc for a class auto builder", () => {
		expect(hoverDocs(`name("n")`)).toBe("PERSON-NAME-DOC");
	});

	it("shows the readable setter return type in the hover", () => {
		const info = service.getQuickInfoAtPosition(fileName, positionOf(`id("1")`));
		expect(ts.displayPartsToString(info?.displayParts)).toContain('BuilderWithProperty<UserBuilder, User, "id">');
	});

	it("goes to the property declaration on Go to Definition", () => {
		expect(definitionText(`id("1")`)).toBe("id");
		expect(definitionText(`baseField("b")`)).toBe("baseField");
		expect(definitionText(`name("n")`)).toBe("name");
	});
});
