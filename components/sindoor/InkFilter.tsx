/**
 * The roughness every ink stroke on the walkthrough borrows.
 *
 * One `<svg>` of zero size holding one filter, mounted once per page. The
 * filter displaces a path by a band-limited noise field, which is what turns a
 * geometric circle into something that looks drawn — the same trick a pen
 * plays on a hand that cannot hold a perfect arc.
 *
 * Two details that matter more than they look:
 *
 * `baseFrequency` is deliberately anisotropic. Equal frequencies give a
 * wobble that repeats visibly along a long stroke, and a repeating hand is
 * worse than no hand at all.
 *
 * `filterUnits="userSpaceOnUse"` with a generous region, because the default
 * bounding box clips the displacement at the edge of the shape — a circle
 * roughened inside its own box comes out with four flat sides, which is the
 * one thing a hand-drawn circle never has.
 */
export default function InkFilter() {
  return (
    <svg aria-hidden width="0" height="0" style={{ position: "absolute" }}>
      <defs>
        <filter id="ink-rough" x="-20%" y="-20%" width="140%" height="140%" filterUnits="objectBoundingBox">
          <feTurbulence type="fractalNoise" baseFrequency="0.021 0.037" numOctaves="3" seed="7" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="2.4" xChannelSelector="R" yChannelSelector="G" />
        </filter>
        <filter id="ink-rough-soft" x="-20%" y="-20%" width="140%" height="140%">
          <feTurbulence type="fractalNoise" baseFrequency="0.014 0.026" numOctaves="2" seed="3" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="1.3" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </defs>
    </svg>
  );
}
