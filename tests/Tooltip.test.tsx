// @vitest-environment jsdom
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { Tooltip } from '../components/common/Tooltip';
import { describe, it, expect } from 'vitest';

describe('Tooltip', () => {
    it('renders children correctly', () => {
        render(
            <Tooltip content="Tooltip text">
                <button>Trigger</button>
            </Tooltip>
        );
        expect(screen.getByText('Trigger')).toBeDefined();
    });

    it('renders tooltip content (hidden by default logic but present in DOM)', () => {
        render(
            <Tooltip content="Hidden Content">
                <button>Trigger</button>
            </Tooltip>
        );
        // The content is in the DOM, just hidden with CSS classes.
        // Testing-library might complain about visibility if using getByText default options,
        // but let's check it's in the document.
        expect(screen.getByText('Hidden Content')).toBeDefined();
    });

    it('applies custom width class', () => {
        const { container } = render(
            <Tooltip content="Content" width="w-96">
                <button>Trigger</button>
            </Tooltip>
        );
        // Check if w-96 class is present on the tooltip div
        // The tooltip div is the second child of the group container usually, or we can find by text
        const tooltipContent = screen.getByText('Content');
        // The parent of the text is the tooltip container div?
        // Structure: div.relative > children + div.absolute...
        const tooltipContainer = tooltipContent.closest('.absolute');
        expect(tooltipContainer?.className).toContain('w-96');
    });
});
