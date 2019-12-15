// Single value
(function() {
    type ContainedValue = { value: number };
    let value: number | null = Math.random() > 0.5 ? 0 : null;

    // Setting in an object
    const contained: ContainedValue = { value: value! };
    console.log(contained);
    
    // Passing as a function parameter
    const takesContainedValue = (arg: ContainedValue) => {};
    takesContainedValue({ value: value! });
})();

// Multiple values
(function () {
    type ContainedValues = { first: number, ok: boolean, second: string };
    let first: number | null = Math.random() > 0.5 ? 0 : null;
    let second: string | null = Math.random() > 0.5 ? "abc" : null;
    let ok: boolean = true;

    // Setting in an object
    const contained: ContainedValues = { first: first!, ok, second: second! };
    console.log(contained);

    // Passing as a function parameters
    const takesContainedValue = (arg: ContainedValues) => { };
    takesContainedValue({ first: first!, ok, second: second! });
})();
