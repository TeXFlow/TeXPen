import {
  DEFAULT_ARGS, Args, Log, State, Pattern, Ignore, Indent, Verbatim,
  LINE_END
} from './models';
import {
  cleanText, setIgnoreAndReport, needsSplit, splitLine, calculateIndent,
  needsWrap, applyWrap, applyIndent, indentsReturnToZero, removeTrailingSpaces,
  removeTrailingBlankLines
} from './utils';

export function formatLatex(text: string): string {
  const args = DEFAULT_ARGS;
  const file = "input.tex";
  const [formattedText] = _formatLatex(text, file, args);
  return formattedText.trim();
}

function _formatLatex(oldText: string, file: string, args: Args): [string, Log[]] {
  const logs: Log[] = [];
  logs.push({ level: "INFO", file, message: "Formatting started." });

  oldText = cleanText(oldText, args);
  const oldLines = oldText.split('\n').map((line, index) => ({ linumOld: index + 1, line }));

  // Initialize
  let state = new State();
  const queue: { linumOld: number, line: string }[] = [];
  let newText = "";

  const indentChar = args.tabchar === "\t" ? "\t" : " ";
  const listsBegin = args.lists.map(l => `\\begin{${l}}`);
  const listsEnd = args.lists.map(l => `\\end{${l}}`);

  while (true) {
    let currentItem: { linumOld: number, line: string } | undefined;

    if (queue.length > 0) {
      currentItem = queue.shift();
    } else if (oldLines.length > 0) {
      currentItem = oldLines.shift();
    } else {
      break;
    }

    if (!currentItem) break;

    let { linumOld, line } = currentItem;
    const pattern = Pattern.new(line);

    const tempState = new State({
      linum_old: linumOld,
      linum_new: state.linum_new,
      ignore: new Ignore(state.ignore.actual, state.ignore.visual),
      indent: new Indent(state.indent.actual, state.indent.visual),
      verbatim: new Verbatim(state.verbatim.actual, state.verbatim.visual),
      linum_last_zero_indent: state.linum_last_zero_indent
    });

    if (!setIgnoreAndReport(line, tempState, logs, file, pattern)) {
      if (needsSplit(line, pattern)) {
        const [thisLine, nextLine] = splitLine(line, tempState, file, args, logs);
        // Only add to queue if nextLine is non-empty and different from original line
        if (nextLine && nextLine.trim() && nextLine !== line) {
          queue.unshift({ linumOld, line: nextLine });
        }
        line = thisLine;
      }

      const indent = calculateIndent(line, tempState, logs, file, args, pattern, listsBegin, listsEnd);
      const indentLength = indent.visual * args.tabsize;

      if (needsWrap(line.trimStart(), indentLength, args)) {
        const wrappedLines = applyWrap(line.trimStart(), indentLength, tempState, file, args, logs, pattern);
        if (wrappedLines) {
          const [thisLine, nextLineStart, nextLine] = wrappedLines;
          // Python does: queue.insert(0, next_line) then queue.insert(0, this_line)
          // So this_line ends up first. With unshift, we need to add in reverse order:
          queue.unshift({ linumOld, line: thisLine });
          queue.unshift({ linumOld, line: nextLineStart + nextLine });
          continue;
        }
      }

      line = applyIndent(line, indent, args, indentChar);
    }

    state = tempState;
    newText += line + LINE_END;
    state.linum_new += 1;
  }

  if (!indentsReturnToZero(state)) {
    const msg = `Indent does not return to zero. Last non-indented line is line ${state.linum_last_zero_indent}`;
    logs.push({ level: "WARN", file, message: msg });
  }

  newText = removeTrailingSpaces(newText);
  newText = removeTrailingBlankLines(newText);
  logs.push({ level: "INFO", file, message: "Formatting complete." });

  return [newText, logs];
}
