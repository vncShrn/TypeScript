/* @internal */
namespace ts.codefix {
    function getOpenBraceEnd(constructor: ConstructorDeclaration, sourceFile: SourceFile) {
        // First token is the open curly, this is where we want to put the 'super' call.
        return constructor.body.getFirstToken(sourceFile).getEnd();
    }

    registerCodeFix({
        errorCodes: [Diagnostics.Constructors_for_derived_classes_must_contain_a_super_call.code],
        getCodeActions: (context: CodeFixContext) => {
            const sourceFile = context.sourceFile;
            const token = getTokenAtPosition(sourceFile, context.span.start);

            if (token.kind !== SyntaxKind.ConstructorKeyword) {
                return undefined;
            }

            const newPosition = getOpenBraceEnd(<ConstructorDeclaration>token.parent, sourceFile);
            return [{
                description: getLocaleSpecificMessage(Diagnostics.Add_missing_super_call),
                changes: [{ fileName: sourceFile.fileName, textChanges: [{ newText: "super();", span: { start: newPosition, length: 0 } }] }]
            }];
        }
    });

    registerCodeFix({
        errorCodes: [Diagnostics.super_must_be_called_before_accessing_this_in_the_constructor_of_a_derived_class.code],
        getCodeActions: (context: CodeFixContext) => {
            const sourceFile = context.sourceFile;

            const token = getTokenAtPosition(sourceFile, context.span.start);
            if (token.kind !== SyntaxKind.ThisKeyword) {
                return undefined;
            }

            const constructor = getContainingFunction(token);
            const superCall = <ExpressionStatement>findSuperCall((<ConstructorDeclaration>constructor).body);
            if (!superCall) {
                return undefined;
            }

            // figure out if the this access is actuall inside the supercall
            // i.e. super(this.a), since in that case we won't suggest a fix
            if (superCall.expression && superCall.expression.kind == SyntaxKind.CallExpression) {
                const arguments = (<CallExpression>superCall.expression).arguments;
                for (let i = 0; i < arguments.length; i++) {
                    if ((<PropertyAccessExpression>arguments[i]).expression === token) {
                        return undefined;
                    }
                }
            }

            const newPosition = getOpenBraceEnd(<ConstructorDeclaration>constructor, sourceFile);
            const changes = [{
                fileName: sourceFile.fileName, textChanges: [{
                    newText: superCall.getText(sourceFile),
                    span: { start: newPosition, length: 0 }
                },
                {
                    newText: "",
                    span: { start: superCall.getStart(sourceFile), length: superCall.getWidth(sourceFile) }
                }]
            }];

            return [{
                description: getLocaleSpecificMessage(Diagnostics.Make_super_call_the_first_statement_in_the_constructor),
                changes
            }];

            function findSuperCall(n: Node): Node {
                if (n.kind === SyntaxKind.ExpressionStatement && isSuperCallExpression((<ExpressionStatement>n).expression)) {
                    return n;
                }
                if (isFunctionLike(n)) {
                    return undefined;
                }
                return forEachChild(n, findSuperCall);
            }
        }
    });
}