import { Toaster as Sonner, type ToasterProps } from 'sonner';

/** Toast container. Trigger toasts anywhere with `import { toast } from 'sonner'`. */
function Toaster(props: ToasterProps) {
  return (
    <Sonner
      position="top-center"
      richColors
      closeButton
      style={
        {
          '--normal-bg': 'var(--popover)',
          '--normal-text': 'var(--popover-foreground)',
          '--normal-border': 'var(--border)',
        } as React.CSSProperties
      }
      {...props}
    />
  );
}

export { Toaster };
