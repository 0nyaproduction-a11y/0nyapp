type BrandNameProps = {
  className?: string;
};

export function BrandName({ className = "" }: BrandNameProps) {
  return (
    <span
      aria-label="0nya"
      className={`inline-flex items-baseline font-brand leading-none ${className}`}
    >
      <span aria-hidden="true" className="inline-flex items-baseline">
        <span className="text-teal">0</span>
        <span>nya</span>
      </span>
    </span>
  );
}
