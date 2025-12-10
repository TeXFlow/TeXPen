import { describe, it, expect } from 'vitest';
import { formatLatex } from '../../../services/latexFormatter';

describe('LatexFormatter', () => {
  it('should format basic text correctly', () => {
    const input = "Hello world";
    const expected = "Hello world";
    expect(formatLatex(input)).toBe(expected);
  });

  it('should format itemize environment with indentation', () => {
    const input = "\\begin{itemize}\n\\item Item 1\n\\item Item 2\n\\end{itemize}";
    const expected = "\\begin{itemize}\n    \\item Item 1\n    \\item Item 2\n\\end{itemize}";
    expect(formatLatex(input)).toBe(expected);
  });

  it('should format nested environments correctly', () => {
    const input = "\\begin{document}\n\\begin{section}\nText\n\\end{section}\n\\end{document}";
    const expected = "\\begin{document}\n\\begin{section}\n    Text\n\\end{section}\n\\end{document}";
    expect(formatLatex(input)).toBe(expected);
  });

  it('should preserve long lines if wrapping is disabled (default)', () => {
    const input = "This is a very long line that should be wrapped because it exceeds the default wrap length of 80 characters. It really should be wrapped.";
    const expected = "This is a very long line that should be wrapped because it exceeds the default wrap length of 80 characters. It really should be wrapped.";
    expect(formatLatex(input)).toBe(expected);
  });
});
