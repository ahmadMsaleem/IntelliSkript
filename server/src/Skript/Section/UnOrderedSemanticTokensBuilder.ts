import { Position, SemanticTokens, SemanticTokensBuilder, SemanticTokensDelta } from 'vscode-languageserver/node';
import { TokenTypes } from '../../TokenTypes';
import { TokenModifiers } from '../../TokenModifiers';
import { TextDocument } from 'vscode-languageserver-textdocument';

export class SemanticToken {
	position: Position;
	length: number;
	type: TokenTypes;
	modifier: TokenModifiers = TokenModifiers.abstract;
	zIndex: number = 0;
	constructor(position: Position, length: number, type: TokenTypes, modifier: TokenModifiers = TokenModifiers.abstract, zIndex = 0) {
		this.position = position;
		this.length = length;
		this.type = type;
		this.modifier = modifier;
		this.zIndex = zIndex;
	}
	clone(): SemanticToken {
		return new SemanticToken(this.position, this.length, this.type, this.modifier);
	}
}

export class SemanticTokenLine {
	tokens: SemanticToken[] = [];
	fixTokens() {
		//sort from top to bottom so the top tokens get inserted first and will remain
		this.tokens = this.tokens.sort(
			(a, b) => { return b.zIndex - a.zIndex; }
		);
		let fixedTokenList: SemanticToken[] = [this.tokens[0].clone()];
		oldTokenLoop:
		for (let indexL = 1; indexL < this.tokens.length; indexL++) {
			const rightTokenLPart = this.tokens[indexL].clone();
			const endL = rightTokenLPart.position.character + rightTokenLPart.length;
			//check for overlapping tokens and split them
			for (let indexH = 0; indexH < fixedTokenList.length; indexH++) {
				const tokenH = fixedTokenList[indexH];
				const endH = fixedTokenList[indexH].position.character + fixedTokenList[indexH].length;
				//fill the gaps with this token
				if (rightTokenLPart.position.character < endH) {
					if (tokenH.position.character < endL) {//token collision (two tokens overlap)

						const lengthLeft = tokenH.position.character - rightTokenLPart.position.character;
						if (lengthLeft > 0) {
							//left part of the cut token
							const leftTokenLPart = rightTokenLPart.clone();
							leftTokenLPart.length = lengthLeft;
							indexH++;
							fixedTokenList.splice(indexH, 0, leftTokenLPart);
						}
						const lengthRight = endL - endH;
						if (lengthRight > 0) {
							//collision at right side
							if (rightTokenLPart.position.character > endH) {
								//resize token
								rightTokenLPart.position.character += rightTokenLPart.length - lengthRight;
								rightTokenLPart.length = lengthRight;
							}
						}
						else {
							continue oldTokenLoop;
						}
					}
				}
			}
			fixedTokenList.push(rightTokenLPart);
		}
		this.tokens = fixedTokenList;
	}
}
export class UnOrderedSemanticTokensBuilder {
	private _builder: SemanticTokensBuilder = new SemanticTokensBuilder();

	linkedDocument: TextDocument;

	lines: SemanticTokenLine[] = [];
	constructor(linkedDocument: TextDocument) {
		this.linkedDocument = linkedDocument;
		this.lines = new Array<SemanticTokenLine>(this.linkedDocument.getText().split("\n").length);
	}
	push(token: SemanticToken): void {
		if (token.position.line >= this.lines.length) {
			this.lines = new Array<SemanticTokenLine>(this.linkedDocument.getText().split("\n").length);
			if (token.position.line >= this.lines.length) {
				throw new Error(token.position.line + " is out of bounds of the file " + this.linkedDocument.uri + " (has " + this.lines.length + " lines )");
			}
		}
		if (this.lines[token.position.line] == undefined) {
			this.lines[token.position.line] = new SemanticTokenLine();
		}
		this.lines[token.position.line].tokens.push(token);
	}
	previousResult(id: string): void {
		this._builder.previousResult(id);
	}
	private pushSorted(): void {
		for (let i = 0; i < this.lines.length; i++) {
			if (this.lines[i]) {
				this.lines[i].fixTokens();
				//const sortedTokens = this.lines[i].tokens.sort((a, b) => {
				//	return a.position.character - b.position.character;
				//});
				////add the sorted tokens to the token map
				////may cause problems with overlapping tokens
				this.lines[i].tokens.forEach(token =>
					this._builder.push(token.position.line, token.position.character, token.length, token.type, token.modifier)
				);
			}
		}

		this.lines = [];
	}
	buildEdits(): SemanticTokens | SemanticTokensDelta {
		this.pushSorted();
		return this._builder.buildEdits();
	}
	build(): SemanticTokens {
		this.pushSorted();
		return this._builder.build();
	}
}