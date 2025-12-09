/**
 * @vitest-environment jsdom
 */
import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { TeXPenLogo } from '../components/common/TeXPenLogo';

describe('TeXPenLogo Component', () => {
    it('renders without crashing', () => {
        const { container } = render(<TeXPenLogo />);
        const svg = container.querySelector('svg');
        expect(svg).toBeInTheDocument();
    });

    it('applies custom className', () => {
        const testClass = 'test-custom-class';
        const { container } = render(<TeXPenLogo className={testClass} />);
        const svg = container.querySelector('svg');
        expect(svg).toHaveClass(testClass);
    });

    it('contains namespaced, unique IDs', () => {
        const { container } = render(<TeXPenLogo />);
        // Check for at least one of our unique IDs to ensure we didn't regress to generic ones
        const symbol = container.querySelector('#font_0_4');
        expect(symbol).toBeInTheDocument();
    });
});
