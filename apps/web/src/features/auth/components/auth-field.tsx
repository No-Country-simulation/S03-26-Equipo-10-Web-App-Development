import { forwardRef, type ComponentProps } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type Props = ComponentProps<typeof Input> & {
  id: string;
  label: string;
  help?: string;
  error?: string;
  serverErrorId?: string;
};
export const AuthField = forwardRef<HTMLInputElement, Props>(function AuthField(
  { id, label, help, error, serverErrorId, ...props },
  ref,
) {
  const description =
    [help && `${id}-help`, error && `${id}-error`, serverErrorId]
      .filter(Boolean)
      .join(' ') || undefined;
  return (
    <div className="grid gap-2">
      <Label
        htmlFor={id}
        className="font-body text-sm font-medium text-foreground"
      >
        {label}
      </Label>
      <Input
        {...props}
        ref={ref}
        id={id}
        aria-describedby={description}
        aria-invalid={error ? true : undefined}
        className="h-12 transition-none border-foreground/20 bg-transparent font-body text-sm placeholder:text-muted-foreground focus-visible:ring-primary"
      />
      {help && (
        <p
          id={`${id}-help`}
          className="font-body text-sm text-muted-foreground"
        >
          {help}
        </p>
      )}
      {error && (
        <p
          id={`${id}-error`}
          role="alert"
          className="font-body text-sm text-destructive"
        >
          {error}
        </p>
      )}
    </div>
  );
});
