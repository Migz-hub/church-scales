export function Logo({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const text = size === "sm" ? "text-base" : size === "lg" ? "text-2xl" : "text-lg";
  return (
    <div className="flex items-center gap-2">
      <span className={`${text} font-semibold tracking-tight`}>
        Church<span className="text-primary">Escales</span>
      </span>
    </div>
  );
}