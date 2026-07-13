interface Props {
  count?: number;
}

/** Esqueleto con shimmer que replica la silueta de las tarjetas del catálogo. */
export default function CardSkeleton({ count = 6 }: Props) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          className="flex flex-col overflow-hidden rounded-2xl border border-border bg-card"
          aria-hidden="true"
        >
          <div className="shimmer aspect-4/5" />
          <div className="flex flex-col gap-2.5 p-4">
            <div className="shimmer h-4 w-3/4 rounded-full" />
            <div className="shimmer h-3.5 w-1/3 rounded-full" />
            <div className="shimmer h-3 w-full rounded-full" />
            <div className="shimmer h-3 w-1/2 rounded-full" />
          </div>
        </div>
      ))}
    </>
  );
}
