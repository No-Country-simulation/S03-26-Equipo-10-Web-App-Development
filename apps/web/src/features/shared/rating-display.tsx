import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';
export function RatingDisplay({
  rating,
  className,
}: {
  rating: number;
  className?: string;
}) {
  return (
    <span
      role="img"
      aria-label={`${rating} de 5 estrellas`}
      className={cn('inline-flex flex-wrap items-center gap-2', className)}
    >
      <span aria-hidden="true" className="inline-flex gap-1">
        {Array.from({ length: 5 }, (_, index) => (
          <Star
            key={index}
            className={cn(
              'h-4 w-4',
              index < rating
                ? 'fill-primary text-primary'
                : 'text-muted-foreground',
            )}
          />
        ))}
      </span>
      <span aria-hidden="true" className="font-body text-sm text-foreground">
        {rating} de 5
      </span>
    </span>
  );
}
