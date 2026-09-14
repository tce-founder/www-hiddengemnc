import type { ReactNode } from 'react';

/** Standard title block at the top of an interior page. */
export function PageHeader({
  eyebrow,
  title,
  children,
}: {
  eyebrow?: string;
  title: string;
  children?: ReactNode;
}) {
  return (
    <section className="border-b bg-secondary/40">
      <div className="mx-auto max-w-3xl px-6 py-16 text-center md:py-20">
        {eyebrow && (
          <p className="mb-3 text-xs font-semibold tracking-[0.2em] text-muted-foreground uppercase">
            {eyebrow}
          </p>
        )}
        <h1 className="text-4xl font-semibold md:text-5xl">{title}</h1>
        {children && <div className="mt-5 text-lg text-muted-foreground">{children}</div>}
      </div>
    </section>
  );
}
