import { cn } from "@/lib/utils";

type PageCardProps = {
  label?: string;
  title?: string;
  children: React.ReactNode;
  className?: string;
  headerAction?: React.ReactNode;
};

export function PageCard({
  label,
  title,
  children,
  className,
  headerAction,
}: PageCardProps) {
  return (
    <div
      className={cn(
        "bg-white rounded-xl shadow-sm border border-gray-100 p-5",
        className
      )}
    >
      {(label || title || headerAction) && (
        <div className="flex items-start justify-between mb-4">
          <div>
            {label && (
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                {label}
              </p>
            )}
            {title && (
              <h3 className="text-lg font-semibold text-gray-900 mt-1">
                {title}
              </h3>
            )}
          </div>
          {headerAction && <div>{headerAction}</div>}
        </div>
      )}
      {children}
    </div>
  );
}
