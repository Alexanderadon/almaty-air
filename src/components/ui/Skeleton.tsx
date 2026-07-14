export interface SkeletonProps {
  /** Размеры и форма задаются снаружи, например «h-8 w-32» или «h-40 w-full». */
  className?: string;
}

/** Плейсхолдер загрузки: пульсирующий блок в цветах темы. */
export function Skeleton({ className = '' }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse rounded-lg bg-foreground/10 ${className}`}
    />
  );
}
