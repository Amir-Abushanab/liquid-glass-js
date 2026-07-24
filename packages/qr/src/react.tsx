// React binding for the Glass QR — a thin wrapper over mountGlassQR. It lives in
// the qr package (not @liquidglassjs/react) so the QR/WebGL/`qrcode` weight only
// lands in bundles that actually import it. Import from "@liquidglassjs/qr/react".
//
// SSR-safe (the ref is null on the server; the effect is client-only) and
// StrictMode-safe (the returned handle fully disposes). Re-mounts when the
// resolved option values change.

import { useEffect, useRef } from 'react';
import type { CSSProperties } from 'react';
import {
  mountGlassQR,
  type GlassQROptions,
  type GlassQRHandle,
  type GlassQRParams,
} from './GlassQR';

export interface GlassQRProps extends GlassQROptions {
  className?: string;
  style?: CSSProperties;
}

export function GlassQR({ className, style, ...opts }: GlassQRProps) {
  const ref = useRef<HTMLDivElement>(null);
  const handle = useRef<GlassQRHandle | null>(null);
  // Only the QR itself (value/size/colours) re-mounts; the refraction + animation
  // params reconfigure the live shader — no rebuild of the QR geometry + WebGL.
  const {
    value,
    size,
    errorCorrectionLevel,
    dotColor,
    backgroundColor,
    logo,
    reserveCenter,
    image,
    nonce,
    styles,
    ...params
  } = opts;
  // A `logo` Node serialises to {} here, so swapping one Node for another won't
  // re-mount — pass a markup string (or change another struct option) if it must.
  const structKey = JSON.stringify({
    value,
    size,
    errorCorrectionLevel,
    dotColor,
    backgroundColor,
    logo: typeof logo === 'object' ? true : logo,
    reserveCenter,
    image,
    nonce,
    styles,
  });
  useEffect(() => {
    if (!ref.current) return;
    const h = mountGlassQR(ref.current, opts);
    handle.current = h;
    return () => {
      h.dispose();
      handle.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-mount on the QR itself; params reconfigure below
  }, [structKey]);
  const paramsKey = JSON.stringify(params);
  useEffect(() => {
    handle.current?.reconfigure(params as Partial<GlassQRParams>);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- key captures params
  }, [paramsKey]);
  return <div ref={ref} className={className} style={style} />;
}
