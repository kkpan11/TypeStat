import enquirer from "enquirer";
import * as fs from "node:fs/promises";

const prompt = enquirer.prompt;

import { ProjectDescription } from "../initializeProject/shared.js";

export interface InitializeSourcesSettings {
	fromJavaScript: boolean;
	project: ProjectDescription;
}

const everything = "everything";
const other = "other";

export const initializeSources = async (
	settings: InitializeSourcesSettings,
) => {
	const completion = settings.fromJavaScript
		? "/**/*.{js,jsx}"
		: "/**/*.{ts,tsx}";
	const builtIn = await initializeBuiltInSources(completion);

	if (builtIn === other) {
		return await getCustomSources(completion);
	}

	if (builtIn === everything) {
		return undefined;
	}

	if (settings.project.created) {
		await fs.writeFile(
			settings.project.filePath,
			JSON.stringify(
				{
					...JSON.parse(
						(await fs.readFile(settings.project.filePath)).toString(),
					),
					include: [
						builtIn
							.replace(/\*\.\{(?:j|t)s,(?:j|t)sx\}/, "")
							.replace(/\/\*\*\/$/, ""),
					],
				},
				null,
				4,
			),
		);
	}

	return builtIn;
};

const initializeBuiltInSources = async (completion: string) => {
	const choices = [
		{
			message: "everything in my tsconfig.json",
			name: everything,
		},
		`lib${completion}`,
		`src${completion}`,
		other,
	];

	const { sourceFiles } = await prompt<{ sourceFiles: string }>([
		{
			choices,
			initial: choices.length - 1,
			message: "Which glob matches files you'd like to convert?",
			name: "sourceFiles",
			type: "select",
		},
	]);

	return sourceFiles;
};

const getCustomSources = async (completion: string) => {
	const { sourceFiles } = await prompt<{ sourceFiles: string }>([
		{
			initial: `src${completion}`,
			message: "Which files would you like to convert?",
			name: "sourceFiles",
			type: "text",
		},
	]);

	return sourceFiles;
};
