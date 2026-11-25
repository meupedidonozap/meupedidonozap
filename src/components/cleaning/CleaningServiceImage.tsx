import { useState } from "react";
import { House } from "lucide-react";

export default function CleaningServiceImage({ src, name, compact = false }: { src?: string | null; name: string; compact?: boolean }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  return <div className={compact ? "flex h-16 w-20 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted" : "flex aspect-[4/3] items-center justify-center bg-muted"}>
    {src && src !== failedUrl
      ? <img src={src} alt={name} className="h-full w-full object-contain bg-card" onError={() => setFailedUrl(src)} />
      : <House aria-label={`Serviço ${name}`} className={compact ? "h-8 w-8 text-primary" : "h-14 w-14 text-primary"} />}
  </div>;
}