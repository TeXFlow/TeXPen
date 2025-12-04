import {
  Pattern, State, Log, Ignore, Verbatim, Indent, Args,
  VERBATIMS_BEGIN, VERBATIMS_END, ENV_BEGIN, ENV_END, DOC_BEGIN, DOC_END,
  OPENS, CLOSES, ITEM, RE_SPLITTING_SHARED_LINE, RE_SPLITTING_SHARED_LINE_CAPTURE,
  RE_NEWLINES, LINE_END, COMMENT_LINE_START, TEXT_LINE_START
} from './models';

export function findCommentIndex(line: string, pattern: Pattern): number | null {
  if (!pattern.contains_comment) return null;

  let inCommand = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === "\\") {
      inCommand = true;
    } else if (inCommand && !/[a-zA-Z]/.test(c)) {
      inCommand = false;
    } else if (c === "%" && !inCommand) {
      return i;
    }
  }
  return null;
}

export function containsIgnoreSkip(line: string): boolean {
  return line.endsWith("% tex-fmt: skip");
}

export function containsIgnoreBegin(line: string): boolean {
  return line.endsWith("% tex-fmt: off");
}

export function containsIgnoreEnd(line: string): boolean {
  return line.endsWith("% tex-fmt: on");
}

export function getIgnore(line: string, state: State, logs: Log[], file: string, warn: boolean): Ignore {
  const skip = containsIgnoreSkip(line);
  const begin = containsIgnoreBegin(line);
  const end = containsIgnoreEnd(line);

  let actual: boolean;
  let visual: boolean;

  if (skip) {
    actual = state.ignore.actual;
    visual = true;
  } else if (begin) {
    actual = true;
    visual = true;
    if (warn && state.ignore.actual) {
      logs.push({
        level: "WARN",
        file,
        message: "Cannot begin ignore block:",
        linum_new: state.linum_new,
        linum_old: state.linum_old,
        line
      });
    }
  } else if (end) {
    actual = false;
    visual = true;
    if (warn && !state.ignore.actual) {
      logs.push({
        level: "WARN",
        file,
        message: "No ignore block to end.",
        linum_new: state.linum_new,
        linum_old: state.linum_old,
        line
      });
    }
  } else {
    actual = state.ignore.actual;
    visual = state.ignore.actual;
  }

  return new Ignore(actual, visual);
}

export function getVerbatimDiff(line: string, pattern: Pattern): number {
  if (pattern.contains_env_begin && VERBATIMS_BEGIN.some(r => line.includes(r))) {
    return 1;
  } else if (pattern.contains_env_end && VERBATIMS_END.some(r => line.includes(r))) {
    return -1;
  } else {
    return 0;
  }
}

export function getVerbatim(line: string, state: State, logs: Log[], file: string, warn: boolean, pattern: Pattern): Verbatim {
  const diff = getVerbatimDiff(line, pattern);
  const actual = state.verbatim.actual + diff;
  const visual = actual > 0 || state.verbatim.actual > 0;

  if (warn && actual < 0) {
    logs.push({
      level: "WARN",
      file,
      message: "Verbatim count is negative.",
      linum_new: state.linum_new,
      linum_old: state.linum_old,
      line
    });
  }

  return new Verbatim(actual, visual);
}

export function getDiff(line: string, pattern: Pattern, listsBegin: string[], listsEnd: string[]): number {
  let diff = 0;

  // Other environments get single indents
  if (pattern.contains_env_begin && line.includes(ENV_BEGIN)) {
    // Documents get no global indentation
    if (line.includes(DOC_BEGIN)) {
      return 0;
    }
    diff += 1;
    diff += listsBegin.some(r => line.includes(r)) ? 1 : 0;
  } else if (pattern.contains_env_end && line.includes(ENV_END)) {
    // Documents get no global indentation
    if (line.includes(DOC_END)) {
      return 0;
    }
    diff -= 1;
    diff -= listsEnd.some(r => line.includes(r)) ? 1 : 0;
  }

  // Indent for delimiters
  for (const c of line) {
    if (OPENS.includes(c)) {
      diff += 1;
    } else if (CLOSES.includes(c)) {
      diff -= 1;
    }
  }

  return diff;
}

export function getBack(line: string, pattern: Pattern, state: State, listsEnd: string[]): number {
  // Only need to dedent if indentation is present
  if (state.indent.actual === 0) {
    return 0;
  }

  if (pattern.contains_env_end && line.includes(ENV_END)) {
    // Documents get no global indentation
    if (line.includes(DOC_END)) {
      return 0;
    }
    // List environments get double indents for indenting items
    for (const r of listsEnd) {
      if (line.includes(r)) {
        return 2;
      }
    }
    return 1;
  }

  // Items get dedented
  if (pattern.contains_item && line.includes(ITEM)) {
    return 1;
  }

  return 0;
}

export function getIndent(
  line: string,
  prevIndent: Indent,
  pattern: Pattern,
  state: State,
  listsBegin: string[],
  listsEnd: string[]
): Indent {
  const diff = getDiff(line, pattern, listsBegin, listsEnd);
  const back = getBack(line, pattern, state, listsEnd);

  const actual = prevIndent.actual + diff;
  const visual = Math.max(0, prevIndent.actual - back);

  return new Indent(actual, visual);
}

export function calculateIndent(
  line: string,
  state: State,
  logs: Log[],
  file: string,
  args: Args,
  pattern: Pattern,
  listsBegin: string[],
  listsEnd: string[]
): Indent {
  const indent = getIndent(line, state.indent, pattern, state, listsBegin, listsEnd);

  // Update the state
  state.indent = indent;

  // Record the last line with zero indent
  if (indent.visual === 0) {
    state.linum_last_zero_indent = state.linum_new;
  }

  return indent;
}

export function applyIndent(line: string, indent: Indent, args: Args, indentChar: string): string {
  if (!line.trim()) {
    return "";
  }

  const indentStr = indentChar.repeat(indent.visual * args.tabsize);
  return indentStr + line.trimStart();
}

export function needsWrap(line: string, indentLength: number, args: Args): boolean {
  return args.wrap && (line.length + indentLength > args.wraplen);
}

export function findWrapPoint(line: string, indentLength: number, args: Args): number | null {
  let wrapPoint: number | null = null;
  let afterChar = false;
  let prevChar: string | null = null;

  let lineWidth = 0;
  const wrapBoundary = args.wrapmin - indentLength;

  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    lineWidth += 1;
    if (lineWidth > wrapBoundary && wrapPoint !== null) {
      break;
    }
    if (c === " " && prevChar !== "\\") {
      if (afterChar) {
        wrapPoint = i;
      }
    } else if (c !== "%") {
      afterChar = true;
    }
    prevChar = c;
  }

  return wrapPoint;
}

export function applyWrap(
  line: string,
  indentLength: number,
  state: State,
  file: string,
  args: Args,
  logs: Log[],
  pattern: Pattern
): [string, string, string] | null {
  if (args.verbosity >= 3) {
    logs.push({
      level: "TRACE",
      file,
      message: "Wrapping long line.",
      linum_new: state.linum_new,
      linum_old: state.linum_old,
      line
    });
  }

  const wrapPoint = findWrapPoint(line, indentLength, args);
  const commentIndex = findCommentIndex(line, pattern);

  if (wrapPoint === null || wrapPoint > args.wraplen) {
    logs.push({
      level: "WARN",
      file,
      message: "Line cannot be wrapped.",
      linum_new: state.linum_new,
      linum_old: state.linum_old,
      line
    });
    return null;
  }

  const thisLine = line.substring(0, wrapPoint);
  let nextLineStart: string;

  if (commentIndex !== null && wrapPoint > commentIndex) {
    nextLineStart = COMMENT_LINE_START;
  } else {
    nextLineStart = TEXT_LINE_START;
  }

  const nextLine = line.substring(wrapPoint + 1);

  return [thisLine, nextLineStart, nextLine];
}

export function needsSplit(line: string, pattern: Pattern): boolean {
  const containsSplittableEnv = pattern.contains_splitting && RE_SPLITTING_SHARED_LINE.test(line);

  if (containsSplittableEnv) {
    const commentIndex = findCommentIndex(line, pattern);
    if (commentIndex === null) {
      return true;
    }

    const match = RE_SPLITTING_SHARED_LINE_CAPTURE.exec(line);
    // In JS, match.groups contains named groups
    if (match && match.groups && match.groups.env) {
      // We need the start index of 'env' group. 
      // JS RegExp doesn't give group indices directly unless 'd' flag is used (ES2022).
      // But we can infer it from 'prev' length.
      const envStartIndex = match.groups.prev.length;

      if (envStartIndex > commentIndex) {
        return false;
      } else {
        return true;
      }
    }
    return true;
  } else {
    return false;
  }
}

export function splitLine(line: string, state: State, file: string, args: Args, logs: Log[]): [string, string] {
  const match = RE_SPLITTING_SHARED_LINE_CAPTURE.exec(line);
  if (!match || !match.groups) {
    return [line, ""];
  }

  const prev = match.groups.prev;
  const rest = match.groups.env;

  if (args.verbosity >= 3) {
    logs.push({
      level: "TRACE",
      file,
      message: "Placing environment on new line.",
      linum_new: state.linum_new,
      linum_old: state.linum_old,
      line
    });
  }

  return [prev, rest];
}

export function setIgnoreAndReport(
  line: string,
  tempState: State,
  logs: Log[],
  file: string,
  pattern: Pattern
): boolean {
  tempState.ignore = getIgnore(line, tempState, logs, file, true);
  tempState.verbatim = getVerbatim(line, tempState, logs, file, true, pattern);

  return tempState.verbatim.visual || tempState.ignore.visual;
}

export function cleanText(text: string, args: Args): string {
  // Remove extra newlines
  text = text.replace(RE_NEWLINES, `${LINE_END}${LINE_END}`);

  // Remove tabs if they shouldn't be used
  if (args.tabchar !== "\t") {
    text = text.replace(/\t/g, " ".repeat(args.tabsize));
  }

  // Remove trailing spaces
  // Note: JS replace with global flag replaces all occurrences
  // We need to be careful with RE_TRAIL as it matches " +\\n"
  text = text.replace(/ +\n/g, LINE_END);

  return text;
}

export function removeTrailingSpaces(text: string): string {
  return text.replace(/ +\n/g, LINE_END);
}

export function removeTrailingBlankLines(text: string): string {
  return text.trimEnd() + LINE_END;
}

export function indentsReturnToZero(state: State): boolean {
  return state.indent.actual === 0;
}
