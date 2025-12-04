
// Constants
export const LINE_END = "\n";
export const ITEM = "\\item";
export const DOC_BEGIN = "\\begin{document}";
export const DOC_END = "\\end{document}";
export const ENV_BEGIN = "\\begin{";
export const ENV_END = "\\end{";
export const TEXT_LINE_START = "";
export const COMMENT_LINE_START = "% ";

// Opening and closing delimiters
export const OPENS = ["{", "(", "["];
export const CLOSES = ["}", ")", "]"];

// Names of LaTeX verbatim environments
export const VERBATIMS = ["verbatim", "Verbatim", "lstlisting", "minted", "comment"];
export const VERBATIMS_BEGIN = VERBATIMS.map(v => `\\begin{${v}}`);
export const VERBATIMS_END = VERBATIMS.map(v => `\\end{${v}}`);

// Regex patterns for sectioning commands
export const SPLITTING = [
  "\\\\begin\\{",
  "\\\\end\\{",
  "\\\\item(?:$|[^a-zA-Z])",
  "\\\\(?:sub){0,2}section\\*?\\{",
  "\\\\chapter\\*?\\{",
  "\\\\part\\*?\\{",
];

// Compiled regexes
export const SPLITTING_STRING = `(${SPLITTING.join('|')})`;
export const RE_SPLITTING = new RegExp(SPLITTING_STRING);
export const RE_SPLITTING_SHARED_LINE = new RegExp(`.*${SPLITTING_STRING}.*`);
export const RE_SPLITTING_SHARED_LINE_CAPTURE = new RegExp(`(?<prev>.*?)(?<env>${SPLITTING_STRING}.*)`);

export const RE_NEWLINES = new RegExp(`${LINE_END}${LINE_END}(${LINE_END})+`, 'g');
export const RE_TRAIL = new RegExp(` +${LINE_END}`, 'g'); // Note: JS RegExp for multiline might need flags

export interface Args {
  tabchar: string;
  tabsize: number;
  wrap: boolean;
  wraplen: number;
  wrapmin: number;
  lists: string[];
  verbosity: number;
}

export const DEFAULT_ARGS: Args = {
  tabchar: " ",
  tabsize: 4,
  wrap: false,
  wraplen: 80,
  wrapmin: 40,
  lists: [],
  verbosity: 0
};

export class Ignore {
  constructor(public actual: boolean = false, public visual: boolean = false) { }
  static new() { return new Ignore(false, false); }
}

export class Verbatim {
  constructor(public actual: number = 0, public visual: boolean = false) { }
  static new() { return new Verbatim(0, false); }
}

export class Indent {
  constructor(public actual: number = 0, public visual: number = 0) { }
  static new() { return new Indent(0, 0); }
}

export class State {
  linum_old: number = 1;
  linum_new: number = 1;
  ignore: Ignore;
  indent: Indent;
  verbatim: Verbatim;
  linum_last_zero_indent: number = 1;

  constructor(init?: Partial<State>) {
    this.linum_old = init?.linum_old ?? 1;
    this.linum_new = init?.linum_new ?? 1;
    this.ignore = init?.ignore ?? Ignore.new();
    this.indent = init?.indent ?? Indent.new();
    this.verbatim = init?.verbatim ?? Verbatim.new();
    this.linum_last_zero_indent = init?.linum_last_zero_indent ?? 1;
  }
}

export class Pattern {
  constructor(
    public contains_env_begin: boolean = false,
    public contains_env_end: boolean = false,
    public contains_item: boolean = false,
    public contains_splitting: boolean = false,
    public contains_comment: boolean = false
  ) { }

  static new(s: string): Pattern {
    if (RE_SPLITTING.test(s)) {
      return new Pattern(
        s.includes(ENV_BEGIN),
        s.includes(ENV_END),
        s.includes(ITEM),
        true,
        s.includes("%")
      );
    } else {
      return new Pattern(
        false,
        false,
        false,
        false,
        s.includes("%")
      );
    }
  }
}

export interface Log {
  level: string;
  file: string;
  message: string;
  linum_new?: number;
  linum_old?: number;
  line?: string;
}
