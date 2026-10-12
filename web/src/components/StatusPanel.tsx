import { useEffect, useRef, type ReactNode } from 'react';

interface StatusPanelProps {
  tone: 'error' | 'empty';
  title: string;
  children: ReactNode;
  actions: ReactNode;
}

/** Error and empty states share one layout; the heading takes focus so screen readers announce the change. */
export function StatusPanel({ tone, title, children, actions }: StatusPanelProps) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus(), []);

  return (
    <section className={`panel status status-${tone}`} role={tone === 'error' ? 'alert' : undefined}>
      <h2 ref={heading} tabIndex={-1} className="panel-title">
        {title}
      </h2>
      <div className="status-body">{children}</div>
      <div className="actions">{actions}</div>
    </section>
  );
}
