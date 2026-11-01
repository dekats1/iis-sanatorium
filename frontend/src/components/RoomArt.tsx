import { useId, useState, type ImgHTMLAttributes, type ReactElement } from 'react';

/* Палитры иллюстраций (данные рисунка, а не цвета интерфейса). */
const PALETTES: [string, string, string][] = [
  ['#0E7490', '#67C5D8', '#E6F6F9'],
  ['#15803D', '#7DD3A0', '#E9F8EF'],
  ['#4F5D75', '#A9B8D0', '#EEF2F8'],
  ['#0F766E', '#5EC4B6', '#E4F6F3'],
  ['#9A5B13', '#E7B976', '#FBF1E1'],
  ['#1D6F8B', '#8EC9E0', '#EAF5FA'],
];

const SKY_TOP = '#BFE6F2';
const SKY_BOTTOM = '#F4FBFD';
const SUN = '#FFF7D6';
const WHITE = '#FFFFFF';
const LEAF = '#15803D';

export type RoomArtVariant = 'bedroom' | 'living' | 'bathroom' | 'view';

/** Порядок совпадает с подписями галереи: интерьер, мебель, санузел, вид из окна. */
export const ROOM_ART_VARIANTS: RoomArtVariant[] = ['bedroom', 'living', 'bathroom', 'view'];

const VARIANT_LABELS: Record<RoomArtVariant, string> = {
  bedroom: 'Иллюстрация номера: спальня',
  living: 'Иллюстрация номера: гостиная зона',
  bathroom: 'Иллюстрация номера: ванная комната',
  view: 'Иллюстрация номера: вид из окна',
};

/** Офлайн-источник фото: `art:<categoryId>:<index>`. */
export const ART_PREFIX = 'art:';

export function parseArtSrc(src: string): { seed: number; variant: RoomArtVariant } | null {
  if (!src.startsWith(ART_PREFIX)) return null;
  const [, seedRaw, indexRaw] = src.split(':');
  const seed = Number(seedRaw) || 0;
  const index = Math.abs(Number(indexRaw) || 0);
  return { seed, variant: ROOM_ART_VARIANTS[index % ROOM_ART_VARIANTS.length] };
}

type Pal = { dark: string; mid: string; light: string; id: string };

function Bedroom({ dark, mid, light, id }: Pal) {
  return (
    <>
      <rect width="400" height="260" fill={`url(#${id}-wall)`} />
      <rect y="196" width="400" height="64" fill={dark} opacity="0.22" />
      <rect x="236" y="36" width="116" height="104" rx="8" fill={`url(#${id}-win)`} stroke={dark} strokeWidth="5" />
      <path d="M236 120 L270 88 L300 112 L322 94 L352 124 V140 H236Z" fill={mid} opacity="0.55" />
      <circle cx="326" cy="62" r="11" fill={SUN} />
      <path d="M294 36v104M236 88h116" stroke={dark} strokeWidth="3" />
      <rect x="44" y="132" width="164" height="22" rx="6" fill={dark} />
      <rect x="44" y="108" width="14" height="86" rx="5" fill={dark} />
      <rect x="198" y="144" width="12" height="50" rx="4" fill={dark} />
      <rect x="58" y="116" width="140" height="30" rx="10" fill={WHITE} opacity="0.95" />
      <rect x="64" y="118" width="46" height="18" rx="8" fill={light} stroke={mid} strokeWidth="2" />
      <rect x="58" y="136" width="140" height="22" rx="8" fill={mid} />
      <rect x="226" y="164" width="38" height="30" rx="4" fill={dark} opacity="0.85" />
      <circle cx="245" cy="148" r="12" fill={SUN} opacity="0.9" />
      <path d="M345 196c-6-22-4-36 8-52 4 18 6 34-8 52zM345 196c-14-14-22-26-20-42 14 10 20 26 20 42z" fill={LEAF} opacity="0.85" />
      <rect x="333" y="190" width="24" height="26" rx="5" fill={dark} />
    </>
  );
}

function Living({ dark, mid, light, id }: Pal) {
  return (
    <>
      <rect width="400" height="260" fill={`url(#${id}-wall)`} />
      <rect y="200" width="400" height="60" fill={dark} opacity="0.18" />
      {/* картины */}
      <rect x="120" y="40" width="70" height="52" rx="4" fill={WHITE} stroke={dark} strokeWidth="4" />
      <path d="M124 86 L146 62 L162 78 L172 68 L186 86Z" fill={mid} />
      <circle cx="174" cy="54" r="6" fill={SUN} stroke={mid} strokeWidth="1.5" />
      <rect x="204" y="52" width="44" height="40" rx="4" fill={WHITE} stroke={dark} strokeWidth="4" />
      <circle cx="226" cy="72" r="10" fill={light} stroke={mid} strokeWidth="3" />
      {/* диван */}
      <rect x="96" y="120" width="180" height="46" rx="14" fill={dark} />
      <rect x="84" y="140" width="28" height="52" rx="10" fill={dark} />
      <rect x="260" y="140" width="28" height="52" rx="10" fill={dark} />
      <rect x="108" y="150" width="156" height="34" rx="10" fill={mid} />
      <rect x="116" y="128" width="40" height="26" rx="8" fill={light} />
      <rect x="216" y="128" width="40" height="26" rx="8" fill={light} />
      <rect x="96" y="190" width="8" height="14" rx="2" fill={dark} />
      <rect x="268" y="190" width="8" height="14" rx="2" fill={dark} />
      {/* ковёр и столик */}
      <ellipse cx="190" cy="226" rx="128" ry="16" fill={mid} opacity="0.45" />
      <rect x="150" y="200" width="80" height="10" rx="4" fill={dark} opacity="0.9" />
      <rect x="160" y="208" width="6" height="18" rx="2" fill={dark} />
      <rect x="214" y="208" width="6" height="18" rx="2" fill={dark} />
      <rect x="176" y="190" width="18" height="10" rx="3" fill={WHITE} />
      {/* торшер */}
      <path d="M326 70 L358 70 L350 100 L334 100Z" fill={SUN} stroke={mid} strokeWidth="2" />
      <rect x="340" y="100" width="4" height="100" fill={dark} />
      <rect x="326" y="198" width="32" height="8" rx="4" fill={dark} />
      {/* растение */}
      <path d="M40 196c-6-24-2-40 10-56 4 20 4 38-10 56zM40 196c-16-14-24-28-20-46 14 12 20 28 20 46z" fill={LEAF} opacity="0.85" />
      <rect x="28" y="190" width="24" height="26" rx="5" fill={dark} />
    </>
  );
}

function Bathroom({ dark, mid, light, id }: Pal) {
  const tiles = [];
  for (let x = 0; x < 400; x += 40) tiles.push(<path key={`v${x}`} d={`M${x} 0V180`} stroke={mid} strokeWidth="1.5" opacity="0.5" />);
  for (let y = 0; y < 180; y += 36) tiles.push(<path key={`h${y}`} d={`M0 ${y}H400`} stroke={mid} strokeWidth="1.5" opacity="0.5" />);
  return (
    <>
      <rect width="400" height="260" fill={light} />
      <rect width="400" height="180" fill={`url(#${id}-wall)`} opacity="0.6" />
      {tiles}
      <rect y="180" width="400" height="80" fill={dark} opacity="0.2" />
      {/* зеркало и раковина */}
      <rect x="54" y="34" width="84" height="70" rx="34" fill={`url(#${id}-win)`} stroke={dark} strokeWidth="4" />
      <path d="M72 58 L90 44M80 72 L106 48" stroke={WHITE} strokeWidth="4" strokeLinecap="round" opacity="0.9" />
      <rect x="48" y="122" width="96" height="16" rx="6" fill={WHITE} stroke={dark} strokeWidth="3" />
      <rect x="66" y="138" width="60" height="42" rx="4" fill={dark} opacity="0.85" />
      <path d="M96 122 V110 H108" stroke={dark} strokeWidth="4" fill="none" strokeLinecap="round" />
      {/* полотенце */}
      <rect x="160" y="70" width="40" height="6" rx="3" fill={dark} />
      <rect x="166" y="76" width="28" height="56" rx="4" fill={mid} />
      <path d="M166 122h28" stroke={WHITE} strokeWidth="3" />
      {/* ванна и душ */}
      <path d="M298 26 V60" stroke={dark} strokeWidth="5" strokeLinecap="round" />
      <path d="M298 26 H336 V40" stroke={dark} strokeWidth="5" fill="none" strokeLinecap="round" />
      <ellipse cx="336" cy="44" rx="16" ry="5" fill={dark} />
      <path d="M326 54v14M336 54v18M346 54v14" stroke={mid} strokeWidth="3" strokeLinecap="round" strokeDasharray="4 6" />
      <rect x="220" y="140" width="164" height="56" rx="22" fill={WHITE} stroke={dark} strokeWidth="4" />
      <rect x="232" y="146" width="140" height="14" rx="7" fill={mid} opacity="0.55" />
      <circle cx="262" cy="140" r="7" fill={WHITE} stroke={mid} strokeWidth="2" />
      <circle cx="282" cy="134" r="5" fill={WHITE} stroke={mid} strokeWidth="2" />
      <rect x="236" y="196" width="10" height="16" rx="3" fill={dark} />
      <rect x="358" y="196" width="10" height="16" rx="3" fill={dark} />
      <rect x="216" y="226" width="84" height="12" rx="6" fill={mid} opacity="0.7" />
    </>
  );
}

function WindowView({ dark, mid, light, id }: Pal) {
  return (
    <>
      <rect width="400" height="260" fill={light} />
      {/* окно */}
      <rect x="40" y="22" width="320" height="186" rx="10" fill={`url(#${id}-win)`} />
      <circle cx="292" cy="66" r="20" fill={SUN} />
      <path d="M40 150 L104 86 L146 120 L206 64 L268 124 L314 96 L360 132 V208 H40Z" fill={mid} opacity="0.7" />
      <path d="M40 170 L120 128 L190 156 L260 122 L360 162 V208 H40Z" fill={dark} opacity="0.55" />
      <rect x="40" y="176" width="320" height="32" fill={SKY_TOP} opacity="0.9" />
      <path d="M60 186h60M160 194h80M270 186h60" stroke={WHITE} strokeWidth="3" strokeLinecap="round" opacity="0.8" />
      {[70, 96, 318, 342].map((x, i) => (
        <path key={x} d={`M${x} ${178 - (i % 2) * 8} l12 -${30 + (i % 2) * 8} l12 ${30 + (i % 2) * 8}z`} fill={LEAF} opacity="0.9" />
      ))}
      <path d="M200 22 V208 M40 112 H360" stroke={dark} strokeWidth="5" />
      <rect x="40" y="22" width="320" height="186" rx="10" fill="none" stroke={dark} strokeWidth="8" />
      {/* шторы */}
      <path d="M14 10 H70 C60 80 66 160 52 230 H14Z" fill={mid} />
      <path d="M386 10 H330 C340 80 334 160 348 230 H386Z" fill={mid} />
      <rect x="6" y="6" width="388" height="8" rx="4" fill={dark} />
      {/* подоконник */}
      <rect x="28" y="208" width="344" height="14" rx="4" fill={WHITE} stroke={dark} strokeWidth="3" />
      <rect y="222" width="400" height="38" fill={dark} opacity="0.2" />
      <path d="M318 206c-4-18-2-28 6-40 4 14 4 26-6 40zM318 206c-10-10-16-20-14-32 10 8 14 20 14 32z" fill={LEAF} />
      <rect x="308" y="198" width="20" height="12" rx="3" fill={dark} />
      <rect x="92" y="196" width="34" height="12" rx="3" fill={mid} stroke={dark} strokeWidth="2" />
      <path d="M126 200 h6 a4 4 0 0 1 0 8 h-6" stroke={dark} strokeWidth="2" fill="none" />
    </>
  );
}

const SCENES: Record<RoomArtVariant, (p: Pal) => ReactElement> = {
  bedroom: Bedroom,
  living: Living,
  bathroom: Bathroom,
  view: WindowView,
};

/** Иллюстрация номера в SVG (не требует сети): спальня, гостиная, санузел или вид из окна. */
export function RoomArt({
  seed = 0,
  variant = 'bedroom',
  className = '',
  label,
}: {
  seed?: number;
  variant?: RoomArtVariant;
  className?: string;
  label?: string;
}) {
  const [dark, mid, light] = PALETTES[Math.abs(seed) % PALETTES.length];
  const id = `ra${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const Scene = SCENES[variant] ?? Bedroom;
  return (
    <svg
      className={`room-art ${className}`}
      viewBox="0 0 400 260"
      preserveAspectRatio="xMidYMid slice"
      role="img"
      aria-label={label || VARIANT_LABELS[variant]}
    >
      <defs>
        <linearGradient id={`${id}-wall`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={light} />
          <stop offset="1" stopColor={mid} stopOpacity="0.55" />
        </linearGradient>
        <linearGradient id={`${id}-win`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={SKY_TOP} />
          <stop offset="1" stopColor={SKY_BOTTOM} />
        </linearGradient>
      </defs>
      <Scene dark={dark} mid={mid} light={light} id={id} />
    </svg>
  );
}

/**
 * Фото номера. Понимает офлайн-источники `art:<categoryId>:<index>` (рисует RoomArt нужного варианта),
 * а для обычных URL при ошибке загрузки показывает иллюстрацию.
 */
export function RoomImage({ src, seed = 0, alt = '', className = '', ...rest }: ImgHTMLAttributes<HTMLImageElement> & { seed?: number }) {
  const [failed, setFailed] = useState(false);
  const art = src ? parseArtSrc(src) : null;
  if (art) return <RoomArt seed={art.seed} variant={art.variant} className={className} label={alt || undefined} />;
  if (!src || failed) return <RoomArt seed={seed} className={className} label={alt || undefined} />;
  return <img src={src} alt={alt} className={className} loading="lazy" onError={() => setFailed(true)} {...rest} />;
}
