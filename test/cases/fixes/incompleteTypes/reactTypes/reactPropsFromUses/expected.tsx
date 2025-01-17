import * as React from "react";

(function () {
	interface FromUsesComponentProps {
		returnsBoolean: (() => boolean);
		takesStringCall: ((text: string) => void);
		takesNumberReturnsStringJsx: ((input: number) => string);
	}

	const useReturnsBoolean = (callback: () => boolean) => {
		return callback();
	};

	interface ReturnsStringProps {
		takeTakesNumberReturnsString: (input: number) => string;
	}

	class WithReturnsString extends React.Component<ReturnsStringProps> {}

	const useTakesString = (callback: (text: string) => void) => {
		callback("");
	};

	class FromUsesComponent extends React.Component<FromUsesComponentProps> {
		render() {
			const { returnsBoolean, takesStringCall, takesNumberReturnsStringJsx } =
				this.props;

			useReturnsBoolean(returnsBoolean);
			useTakesString(takesStringCall);

			const withReturnsString = (
// @ts-expect-error -- TODO: Cannot use JSX unless the '--jsx' flag is provided.
				<WithReturnsString
					takeTakesNumberReturnsString={takesNumberReturnsStringJsx}
				/>
			);

// @ts-expect-error -- TODO: Cannot use JSX unless the '--jsx' flag is provided.
			return <span />;
		}
	}
})();
