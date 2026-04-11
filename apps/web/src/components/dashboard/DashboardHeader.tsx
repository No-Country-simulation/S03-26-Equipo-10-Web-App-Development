interface DashboardHeaderProps {
  title: string;
  description?: string;
  children?: React.ReactNode;
}

export function DashboardHeader({ title, description, children }: DashboardHeaderProps) {
  return (
    <div className="mb-10 flex flex-col gap-4 border-b border-foreground/10 pb-8 md:flex-row md:items-end md:justify-between">
      <div>
        <h1 className="font-caption text-3xl font-light italic text-foreground md:text-4xl">
          {title}
        </h1>
        {description && (
          <p className="mt-2 max-w-xl font-body text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {children && <div className="flex items-center gap-3">{children}</div>}
    </div>
  );
}
