import { Mutation } from "automutate";
import ts from "typescript";

import {
	canNodeBeFixedForNoImplicitAny,
	getNoImplicitAnyMutations,
	NoImplicitAnyNodeToBeFixed,
} from "../../../../mutations/codeFixes/noImplicitAny.js";
import {
	FileMutationsRequest,
	FileMutator,
} from "../../../../shared/fileMutator.js";
import { collectMutationsFromNodes } from "../../../collectMutationsFromNodes.js";

export const fixNoImplicitAnyPropertyDeclarations: FileMutator = (
	request: FileMutationsRequest,
): readonly Mutation[] =>
	collectMutationsFromNodes(
		request,
		isNodeNoImplicitAnyFixablePropertyDeclaration,
		getNoImplicitAnyMutations,
	);

const isNodeNoImplicitAnyFixablePropertyDeclaration = (
	node: ts.Node,
): node is NoImplicitAnyNodeToBeFixed & ts.PropertyDeclaration =>
	ts.isPropertyDeclaration(node) && canNodeBeFixedForNoImplicitAny(node);
