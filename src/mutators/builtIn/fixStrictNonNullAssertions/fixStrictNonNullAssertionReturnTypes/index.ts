import { combineMutations, Mutation } from "automutate";
import ts from "typescript";

import { isTypeFlagSetRecursively } from "../../../../mutations/collecting/flags.js";
import { createNonNullAssertion } from "../../../../mutations/typeMutating/createNonNullAssertion.js";
import {
	FileMutationsRequest,
	FileMutator,
} from "../../../../shared/fileMutator.js";
import { getVariableInitializerForExpression } from "../../../../shared/nodes.js";
import {
	FunctionLikeDeclarationWithType,
	isNodeWithType,
} from "../../../../shared/nodeTypes.js";
import { getTypeAtLocationIfNotError } from "../../../../shared/types.js";
import { collectMutationsFromNodes } from "../../../collectMutationsFromNodes.js";
import { collectReturningNodeExpressions } from "./collectReturningNodeExpressions.js";

export const fixStrictNonNullAssertionReturnTypes: FileMutator = (
	request: FileMutationsRequest,
): readonly Mutation[] =>
	collectMutationsFromNodes(
		request,
		isNodeVisitableFunctionLikeDeclaration,
		visitFunctionWithBody,
	);

const isNodeVisitableFunctionLikeDeclaration = (
	node: ts.Node,
): node is FunctionLikeDeclarationWithType =>
	ts.isFunctionLike(node) &&
	// If the node has an implicit return type, we don't need to change anything
	isNodeWithType(node);

const visitFunctionWithBody = (
	node: FunctionLikeDeclarationWithType,
	request: FileMutationsRequest,
): Mutation | undefined => {
	// Collect the type initially declared as returned and whether it contains null and/or undefined
	const declaredType = getTypeAtLocationIfNotError(request, node.type);

	// If the node's explicit return type contains 'any', we can't infer anything
	if (
		declaredType === undefined ||
		isTypeFlagSetRecursively(declaredType, ts.TypeFlags.Any)
	) {
		return undefined;
	}

	// If the type already has both null or undefined, all is well; rejoice!
	const returningNull = isTypeFlagSetRecursively(
		declaredType,
		ts.TypeFlags.Null,
	);
	const returningUndefined = isTypeFlagSetRecursively(
		declaredType,
		ts.TypeFlags.Undefined,
	);
	if (returningNull && returningUndefined) {
		return undefined;
	}

	// From now on, we only care about the two types of strict values that could be returned
	const missingReturnTypes =
		(returningNull ? 0 : ts.TypeFlags.Null) |
		(returningUndefined ? 0 : ts.TypeFlags.Undefined);

	// Collect ! additions for the return types of nodes in the function
	const returningNodeExpressions = collectReturningNodeExpressions(node);
	const mutations = collectNonNullMutations(
		request,
		node,
		missingReturnTypes,
		returningNodeExpressions,
	);

	return mutations.length === 0 ? undefined : combineMutations(...mutations);
};

const collectNonNullMutations = (
	request: FileMutationsRequest,
	functionLike: FunctionLikeDeclarationWithType,
	missingReturnTypes: ts.TypeFlags,
	expressions: readonly ts.Expression[],
): readonly Mutation[] => {
	const mutations: Mutation[] = [];

	for (const expression of expressions) {
		// If the expression doesn't return a type missing from the return, it's already safe
		const expressionType = getTypeAtLocationIfNotError(request, expression);
		if (
			expressionType === undefined ||
			!isTypeFlagSetRecursively(expressionType, missingReturnTypes)
		) {
			continue;
		}

		// If the expression is an variable declared in the parent function, add the ! to the variable
		if (ts.isIdentifier(expression)) {
			const declaringVariableInitializer = getVariableInitializerForExpression(
				request,
				expression,
				functionLike,
			);
			if (declaringVariableInitializer !== undefined) {
				mutations.push(
					createNonNullAssertion(request, declaringVariableInitializer),
				);
				continue;
			}
		}

		// Otherwise, add it at the end of the expression
		mutations.push(createNonNullAssertion(request, expression));
	}

	return mutations;
};
