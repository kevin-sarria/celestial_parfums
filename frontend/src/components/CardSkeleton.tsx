import './CardSkeleton.css';

interface Props {
  count?: number;
}

export default function CardSkeleton({ count = 6 }: Props) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="skeleton-card" aria-hidden="true">
          <div className="skeleton-img skeleton-shimmer" />
          <div className="skeleton-body">
            <div className="skeleton-line skeleton-line--title skeleton-shimmer" />
            <div className="skeleton-line skeleton-line--text skeleton-shimmer" />
            <div className="skeleton-line skeleton-line--short skeleton-shimmer" />
          </div>
        </div>
      ))}
    </>
  );
}
