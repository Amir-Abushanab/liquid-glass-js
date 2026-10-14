import { expect, test, type Page } from '@playwright/test';
import { recombineRgb } from '../packages/core/src/rgb-recombine';

const channelMasks = [
  '1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0',
  '0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0',
  '0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0',
];

function splitChannels(offsets = [0, 0, 0]): string {
  return channelMasks
    .map((values, i) => {
      const channel = ['R', 'G', 'B'][i];
      return (
        `<feOffset in="SourceGraphic" dx="${offsets[i]}" result="shift${channel}"/>` +
        `<feColorMatrix in="shift${channel}" type="matrix" values="${values}" result="disp${channel}"/>`
      );
    })
    .join('');
}

async function rasterize(page: Page, content: string, primitives: string): Promise<number[]> {
  return page.evaluate(
    async ({ content: artwork, primitives: chain }) => {
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="32">
      <defs><filter id="glass" filterUnits="userSpaceOnUse" x="0" y="0" width="64" height="32"
        color-interpolation-filters="sRGB">${chain}</filter></defs>
      <g filter="url(#glass)">${artwork}</g></svg>`;
      const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
      try {
        const image = new Image();
        image.src = url;
        await image.decode();
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 32;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(image, 0, 0);
        return Array.from(ctx.getImageData(0, 0, 64, 32).data);
      } finally {
        URL.revokeObjectURL(url);
      }
    },
    { content, primitives },
  );
}

test('zero displacement preserves translucent colors and antialiased edges', async ({ page }) => {
  const content = ['#00b9f2', '#ff9900', '#ef2280', '#222222']
    .map(
      (fill, i) =>
        `<circle cx="${8 + i * 16}" cy="16" r="6.3" fill="${fill}" opacity="${[0.25, 0.5, 0.75, 1][i]}"/>`,
    )
    .join('');
  const reference = await rasterize(page, content, '<feColorMatrix in="SourceGraphic"/>');
  const actual = await rasterize(page, content, splitChannels() + recombineRgb());
  // Straight RGB becomes unstable at tiny alpha after 8-bit premultiplication;
  // compare coverage and premultiplied colors, the quantities being recombined.
  let largestDifference = 0;
  for (let i = 0; i < actual.length; i += 4) {
    largestDifference = Math.max(largestDifference, Math.abs(actual[i + 3] - reference[i + 3]));
    for (let channel = 0; channel < 3; channel++) {
      largestDifference = Math.max(
        largestDifference,
        Math.abs(
          (actual[i + channel] * actual[i + 3]) / 255 -
            (reference[i + channel] * reference[i + 3]) / 255,
        ),
      );
    }
  }
  expect(largestDifference).toBeLessThanOrEqual(3);
});

test('chromatic fringes retain displaced coverage outside the source', async ({ page }) => {
  const pixels = await rasterize(
    page,
    '<rect x="16" y="8" width="16" height="16" fill="white" opacity="0.4"/>',
    splitChannels([-4, 0, 4]) + recombineRgb('refr'),
  );
  for (const [x, color] of [
    [14, [255, 0, 0]],
    [18, [255, 255, 0]],
    [24, [255, 255, 255]],
    [30, [0, 255, 255]],
    [34, [0, 0, 255]],
  ] as const) {
    const pixel = pixels.slice((16 * 64 + x) * 4, (16 * 64 + x) * 4 + 4);
    for (let channel = 0; channel < 3; channel++) {
      expect(Math.abs(pixel[channel] - color[channel])).toBeLessThanOrEqual(3);
    }
    expect(Math.abs(pixel[3] - 102)).toBeLessThanOrEqual(3);
  }
  expect(pixels[(16 * 64 + 10) * 4 + 3]).toBe(0);
});
