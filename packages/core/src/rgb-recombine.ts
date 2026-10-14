// Channel masks keep their displaced alpha, so adding RGB also adds coverage
// three times. Preserve the premultiplied RGB sum but use the greatest channel
// alpha. Keeping displaced coverage (rather than SourceAlpha) lets fringes
// extend beyond the source silhouette without making its soft edges opaque.
const ALPHA_AS_GRAY = '0 0 0 1 0  0 0 0 1 0  0 0 0 1 0  0 0 0 0 1';

export function recombineRgb(result = 'lensResult'): string {
  return (
    `<feComposite in="dispR" in2="dispG" operator="arithmetic" k1="0" k2="1" k3="1" k4="0" result="rgbRG"></feComposite>` +
    `<feComposite in="rgbRG" in2="dispB" operator="arithmetic" k1="0" k2="1" k3="1" k4="0" result="rgbSum"></feComposite>` +
    `<feColorMatrix in="dispR" type="matrix" values="${ALPHA_AS_GRAY}" result="alphaR"></feColorMatrix>` +
    `<feColorMatrix in="dispG" type="matrix" values="${ALPHA_AS_GRAY}" result="alphaG"></feColorMatrix>` +
    `<feColorMatrix in="dispB" type="matrix" values="${ALPHA_AS_GRAY}" result="alphaB"></feColorMatrix>` +
    `<feBlend in="alphaR" in2="alphaG" mode="lighten" result="alphaRG"></feBlend>` +
    `<feBlend in="alphaRG" in2="alphaB" mode="lighten" result="alphaMax"></feBlend>` +
    `<feColorMatrix in="rgbSum" type="matrix" values="${ALPHA_AS_GRAY}" result="alphaSum"></feColorMatrix>` +
    `<feBlend in="alphaSum" in2="alphaMax" mode="difference" result="alphaExcess"></feBlend>` +
    `<feColorMatrix in="alphaExcess" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  1 0 0 0 0" result="excessMask"></feColorMatrix>` +
    `<feComposite in="rgbSum" in2="excessMask" operator="arithmetic" k1="0" k2="1" k3="-1" k4="0" result="${result}"></feComposite>`
  );
}
