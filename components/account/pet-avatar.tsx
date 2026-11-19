import { SPECIES_LABEL } from '@/lib/club/pet-math';

const EMOJI: Record<string, string> = {
  DOG: '🐕', CAT: '🐈', BIRD: '🦜', RABBIT: '🐇', FISH: '🐠', REPTILE: '🦎', RODENT: '🐹', OTHER: '🐾',
};

/** Pet photo when there is one, otherwise a species avatar. Fixed size, so it never shifts the layout. */
export function PetAvatar({ name, species, photoUrl, size = 64 }: { name: string; species: string; photoUrl?: string | null; size?: number }) {
  const style = { width: size, height: size };
  if (photoUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={photoUrl} alt={`عکس ${name}`} style={style} className="shrink-0 rounded-2xl border border-border object-cover" />;
  }
  return (
    <span
      role="img"
      aria-label={SPECIES_LABEL[species] ?? 'حیوان خانگی'}
      style={{ ...style, fontSize: size * 0.5 }}
      className="inline-flex shrink-0 items-center justify-center rounded-2xl border border-border bg-primary/10"
    >
      {EMOJI[species] ?? EMOJI.OTHER}
    </span>
  );
}
