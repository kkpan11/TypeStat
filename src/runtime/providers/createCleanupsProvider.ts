import { Mutation } from "automutate";

import { suppressRemainingTypeIssues } from "../../cleanups/builtin/suppressTypeErrors/index.js";
import { createLanguageServices } from "../../services/language.js";
import { FileInfoCache } from "../../shared/FileInfoCache.js";
import { convertMapToObject, Dictionary } from "../../shared/maps.js";
import { NameGenerator } from "../../shared/NameGenerator.js";
import { collectFilteredNodes } from "../collectFilteredNodes.js";
import { createSingleUseProvider } from "../createSingleUseProvider.js";
import { findMutationsInFile } from "../findMutationsInFile.js";

/**
 * Creates a mutations provider that applies post-fix cleanups.
 * @param allModifiedFiles Set to mark names of all files that were modified.
 * @returns Provider to apply post-fix cleanups, if needed.
 */
export const createCleanupsProvider = (allModifiedFiles: Set<string>) => {
	return createSingleUseProvider("Applying post-fix cleanups", (options) => {
		if (!Object.values(options.cleanups).filter(Boolean).length) {
			return undefined;
		}

		return () => {
			const fileMutations = new Map<string, readonly Mutation[]>();
			const services = createLanguageServices(options);

			for (const fileName of options.fileNames) {
				const sourceFile = services.program.getSourceFile(fileName);
				if (sourceFile === undefined) {
					options.output.stderr(
						`Could not find TypeScript source file for '${fileName}'.`,
					);
					continue;
				}

				const filteredNodes = collectFilteredNodes(options, sourceFile);

				const foundMutations = findMutationsInFile(
					{
						fileInfoCache: new FileInfoCache(
							filteredNodes,
							services,
							sourceFile,
						),
						filteredNodes,
						nameGenerator: new NameGenerator(sourceFile.fileName),
						options,
						services,
						sourceFile,
					},
					[["suppressTypeIssues", suppressRemainingTypeIssues]],
				);

				if (foundMutations?.length) {
					allModifiedFiles.add(fileName);
					fileMutations.set(fileName, foundMutations);
				}
			}

			return {
				mutationsWave: {
					fileMutations:
						fileMutations.size === 0
							? undefined
							: (convertMapToObject(fileMutations) as Dictionary<Mutation[]>),
				},
			};
		};
	});
};
