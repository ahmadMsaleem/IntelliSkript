import { NestHierarchy } from '../Nesting/NestHierarchy';
import { PatternData } from '../PatternTree';
export class SkriptPatternMatchHierarchy extends NestHierarchy<SkriptPatternMatchHierarchy>{
	matchedPattern?: PatternData;
	constructor(start?: number, end?: number, matchedPattern?: PatternData) {
		super(start, end);
		this.matchedPattern = matchedPattern;
	}
}