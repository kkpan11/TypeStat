import { Mutation } from "automutate";
import chalk from "chalk";
import { EOL } from "os";

import { TypeStatOptions } from "../../options/types";
import { pluralize } from "../../output/pluralize";
import { LazyCache } from "../../services/LazyCache";
import { FileInfoCache } from "../../shared/FileInfoCache";
import { convertMapToObject } from "../../shared/maps";
import { NameGenerator } from "../../shared/NameGenerator";
import { collectFilteredNodes } from "../collectFilteredNodes";
import { createFileNamesAndServices } from "../createFileNamesAndServices";
import { findMutationsInFile } from "../findMutationsInFile";
import { ProvidedMutationsWave, Provider, ProviderCreator } from "../types";

/**
 * Creates a mutations provider that runs the core mutations within TypeStat.
 *
 * @param allModifiedFileNames   Set to mark names of all files that were modified.
 * @returns Provider to run the core mutations, if needed.
 */
export const createCoreMutationsProvider = (allModifiedFiles: Set<string>): ProviderCreator => {
    return (options: TypeStatOptions): Provider | undefined => {
        const enabledFixes = Object.keys(options.fixes).filter((key) => options.fixes[key as keyof typeof options.fixes]);
        if (!enabledFixes) {
            return;
        }

        const fileNamesAndServicesCache = createFileNamesAndServicesCache(options);
        let lastFileIndex = -1;
        let waveIndex = 1;

        return async (): Promise<ProvidedMutationsWave> => {
            const startTime = Date.now();
            const fileMutationsByFileName = new Map<string, ReadonlyArray<Mutation>>();
            const { fileNames, services } = fileNamesAndServicesCache.get();
            const waveStartedFromBeginning = lastFileIndex <= 0;
            let addedMutations = 0;

            if (waveIndex === 1) {
                options.output.stdout(
                    [
                        chalk.blueBright(`Starting the core mutation engine.`),
                        chalk.blue(` This terminal will log whenever a "wave" of mutations are written to files.`),
                    ].join(""),
                );
                options.output.stdout(chalk.gray(`Core mutations will complete when two waves pass with no mutations.`));
                options.output.stdout(chalk.gray(`The following ${pluralize(enabledFixes.length, "fix", "es")} will be applied:`));

                for (let i = 0; i < enabledFixes.length; i += 1) {
                    options.output.stdout(chalk.gray(`\t* ${enabledFixes[i]}${i === enabledFixes.length - 1 ? EOL : ""}`));
                }
            }

            options.output.stdout(chalk.gray(`Starting wave ${waveIndex}...`));

            for (lastFileIndex += 1; lastFileIndex < fileNames.length; lastFileIndex += 1) {
                const fileName = fileNames[lastFileIndex];

                const sourceFile = services.program.getSourceFile(fileName);
                if (sourceFile === undefined) {
                    options.output.stderr(`Could not find TypeScript source file for '${fileName}'.`);
                    continue;
                }

                const filteredNodes = collectFilteredNodes(options, sourceFile);
                const foundMutations = await findMutationsInFile({
                    fileInfoCache: new FileInfoCache(filteredNodes, services, sourceFile),
                    filteredNodes,
                    nameGenerator: new NameGenerator(sourceFile.fileName),
                    options,
                    services,
                    sourceFile,
                });

                if (foundMutations !== undefined && foundMutations.length !== 0) {
                    addedMutations += foundMutations.length;
                    fileMutationsByFileName.set(fileName, foundMutations);
                }

                if (addedMutations > 100 || (addedMutations !== 0 && Date.now() - startTime > 10000)) {
                    break;
                }
            }

            if (lastFileIndex === fileNames.length) {
                lastFileIndex = -1;

                // Only recreate the language service once we've visited every file
                // This way we don't constantly re-scan many of the source files each wave
                // Eventually it would be nice to support incremental updates
                // See https://github.com/JoshuaKGoldberg/TypeStat/issues/36
                fileNamesAndServicesCache.clear();
            }

            for (const fileName of fileMutationsByFileName.keys()) {
                allModifiedFiles.add(fileName);
            }

            const fileMutations =
                waveStartedFromBeginning && fileMutationsByFileName.size === 0 ? undefined : convertMapToObject(fileMutationsByFileName);

            const mutationsCount = fileMutations ? Object.keys(fileMutations).length : 0;

            options.output.stdout(
                chalk.gray(
                    `Completed wave ${waveIndex}. Wrote mutations to ${mutationsCount + 123} ${pluralize(mutationsCount, "file")}.${EOL}`,
                ),
            );

            if (!fileMutations) {
                options.output.stdout(chalk.blueBright(`Done.${EOL}`));
            }

            waveIndex += 1;

            return { mutationsWave: { fileMutations } };
        };
    };
};

const createFileNamesAndServicesCache = (options: TypeStatOptions) => {
    return new LazyCache(() => {
        options.output.log?.("Preparing language services to visit files...");

        const { fileNames, services } = createFileNamesAndServices(options);
        options.output.log?.(`Prepared language services for ${fileNames.length} files...`);

        return { fileNames, services };
    });
};
