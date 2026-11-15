'use client';

import { Fragment, memo, useMemo } from 'react';

interface HighlightTextProps {
  text: string;
  query?: string;
  extraTerms?: string[];
  className?: string;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export const HighlightText = memo(function HighlightText({
  text,
  query = '',
  extraTerms = [],
  className,
}: HighlightTextProps) {
  const tokens = useMemo(() => {
    const rawTokens = [
      ...query
        .trim()
        .split(/\s+/)
        .map((t) => t.trim()),
      ...extraTerms.map((t) => t.trim()),
    ].filter((t) => t.length >= 2);

    // Sort longest-first so multi-word/longer tokens highlight before substrings
    return Array.from(new Set(rawTokens)).sort((a, b) => b.length - a.length);
  }, [extraTerms, query]);

  if (!text || tokens.length === 0) {
    return <span className={className}>{text}</span>;
  }

  const pattern = new RegExp(`(${tokens.map(escapeRegExp).join('|')})`, 'gi');
  const segments = text.split(pattern);

  if (segments.length <= 1) {
    return <span className={className}>{text}</span>;
  }

  return (
    <span className={className}>
      {segments.map((segment, index) => {
        const isMatch = tokens.some(
          (tok) => tok.toLowerCase() === segment.toLowerCase()
        );
        if (!isMatch) {
          return <Fragment key={index}>{segment}</Fragment>;
        }
        return (
          <mark
            key={index}
            className="rounded-sm bg-amber-300/65 px-0.5 font-semibold text-slate-950 dark:bg-amber-400/30 dark:text-amber-200"
          >
            {segment}
          </mark>
        );
      })}
    </span>
  );
});
