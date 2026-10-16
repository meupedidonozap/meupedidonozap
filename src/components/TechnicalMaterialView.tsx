import { FileText, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toEmbedUrl, type TechnicalMaterial } from '@/hooks/useTechnicalMaterials';

export default function TechnicalMaterialView({ material }: { material: TechnicalMaterial }) {
  return (
    <div className="space-y-4">
      {material.body && <p className="whitespace-pre-line text-sm leading-relaxed">{material.body}</p>}
      {material.media.map((m, i) => {
        if (m.type === 'video') {
          const embed = toEmbedUrl(m.url);
          const isInsta = embed?.includes('instagram.com');
          return embed ? (
            <div key={i} className="space-y-1">
              {m.label && <p className="text-sm font-medium">{m.label}</p>}
              <iframe src={embed} title={m.label || material.title} allowFullScreen loading="lazy"
                className={`w-full rounded-md border bg-muted ${isInsta ? 'mx-auto max-w-md h-[560px]' : 'aspect-video'}`}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture" />
            </div>
          ) : (
            <Button key={i} variant="outline" asChild className="w-full justify-start gap-2">
              <a href={m.url} target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4" /> {m.label || 'Assistir vídeo'}</a>
            </Button>
          );
        }
        if (m.type === 'image') {
          return (
            <figure key={i} className="space-y-1">
              <img src={m.url} alt={m.label || material.title} loading="lazy" className="w-full rounded-md border bg-white object-contain" />
              {m.label && <figcaption className="text-xs text-muted-foreground">{m.label}</figcaption>}
            </figure>
          );
        }
        return (
          <Button key={i} variant="outline" asChild className="w-full justify-start gap-2">
            <a href={m.url} target="_blank" rel="noreferrer">
              {m.type === 'pdf' ? <FileText className="h-4 w-4" /> : <ExternalLink className="h-4 w-4" />}
              {m.label || (m.type === 'pdf' ? 'Abrir PDF' : 'Abrir link')}
            </a>
          </Button>
        );
      })}
    </div>
  );
}
