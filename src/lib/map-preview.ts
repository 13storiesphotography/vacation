import sharp from "sharp";

const TILE_SIZE = 256;
const ZOOM = 14;
const OUTPUT_WIDTH = 640;
const OUTPUT_HEIGHT = 400;

function lon2tile(lon: number, zoom: number): number {
  return ((lon + 180) / 360) * 2 ** zoom;
}

function lat2tile(lat: number, zoom: number): number {
  const rad = (lat * Math.PI) / 180;
  return (
    ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) *
    2 ** zoom
  );
}

async function fetchRemoteImage(url: string): Promise<Buffer | null> {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "VacationPlaner/1.0 (spot preview)",
        Accept: "image/*",
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return null;
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.startsWith("image/")) return null;
    return Buffer.from(await response.arrayBuffer());
  } catch {
    return null;
  }
}

/** Optional Google imagery — key stays server-side, never in <img src>. */
async function tryGooglePreview(lat: number, lng: number): Promise<Buffer | null> {
  const key = process.env.GOOGLE_MAPS_API_KEY?.trim();
  if (!key) return null;

  const streetParams = new URLSearchParams({
    size: `${OUTPUT_WIDTH}x${OUTPUT_HEIGHT}`,
    location: `${lat},${lng}`,
    fov: "80",
    pitch: "0",
    key,
  });
  const street = await fetchRemoteImage(
    `https://maps.googleapis.com/maps/api/streetview?${streetParams}`,
  );
  if (street) return street;

  const staticParams = new URLSearchParams({
    center: `${lat},${lng}`,
    zoom: String(ZOOM),
    size: `${OUTPUT_WIDTH}x${OUTPUT_HEIGHT}`,
    scale: "2",
    maptype: "roadmap",
    markers: `color:0x0F6E8C|${lat},${lng}`,
    key,
  });
  return fetchRemoteImage(
    `https://maps.googleapis.com/maps/api/staticmap?${staticParams}`,
  );
}

async function fetchTile(z: number, x: number, y: number): Promise<Buffer> {
  const n = 2 ** z;
  const wrappedX = ((x % n) + n) % n;
  if (y < 0 || y >= n) {
    return sharp({
      create: {
        width: TILE_SIZE,
        height: TILE_SIZE,
        channels: 3,
        background: { r: 230, g: 236, b: 240 },
      },
    })
      .png()
      .toBuffer();
  }

  const url = `https://basemaps.cartocdn.com/rastertiles/voyager/${z}/${wrappedX}/${y}.png`;
  const buffer = await fetchRemoteImage(url);
  if (!buffer) {
    throw new Error(`Tile fetch failed for ${z}/${wrappedX}/${y}`);
  }
  return buffer;
}

async function renderOsmPreview(lat: number, lng: number): Promise<Buffer> {
  const xFloat = lon2tile(lng, ZOOM);
  const yFloat = lat2tile(lat, ZOOM);
  const centerX = Math.floor(xFloat);
  const centerY = Math.floor(yFloat);

  // 3x3 tiles so we can crop a centered window.
  const tiles: { dx: number; dy: number; buffer: Buffer }[] = [];
  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      const buffer = await fetchTile(ZOOM, centerX + dx, centerY + dy);
      tiles.push({ dx, dy, buffer });
    }
  }

  const mosaicSize = TILE_SIZE * 3;
  const mosaic = sharp({
    create: {
      width: mosaicSize,
      height: mosaicSize,
      channels: 3,
      background: { r: 230, g: 236, b: 240 },
    },
  }).composite(
    tiles.map((tile) => ({
      input: tile.buffer,
      left: (tile.dx + 1) * TILE_SIZE,
      top: (tile.dy + 1) * TILE_SIZE,
    })),
  );

  const mosaicPng = await mosaic.png().toBuffer();

  const pixelX = (xFloat - (centerX - 1)) * TILE_SIZE;
  const pixelY = (yFloat - (centerY - 1)) * TILE_SIZE;

  const left = Math.max(
    0,
    Math.min(mosaicSize - OUTPUT_WIDTH, Math.round(pixelX - OUTPUT_WIDTH / 2)),
  );
  const top = Math.max(
    0,
    Math.min(mosaicSize - OUTPUT_HEIGHT, Math.round(pixelY - OUTPUT_HEIGHT / 2)),
  );

  const markerX = Math.round(pixelX - left);
  const markerY = Math.round(pixelY - top);

  const markerSvg = Buffer.from(`
    <svg width="${OUTPUT_WIDTH}" height="${OUTPUT_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
      <circle cx="${markerX}" cy="${markerY}" r="10" fill="#0F6E8C" stroke="#ffffff" stroke-width="3"/>
      <circle cx="${markerX}" cy="${markerY}" r="3" fill="#ffffff"/>
    </svg>
  `);

  return sharp(mosaicPng)
    .extract({ left, top, width: OUTPUT_WIDTH, height: OUTPUT_HEIGHT })
    .composite([{ input: markerSvg, top: 0, left: 0 }])
    .png()
    .toBuffer();
}

export async function renderMapPreviewPng(lat: number, lng: number): Promise<Buffer> {
  const google = await tryGooglePreview(lat, lng);
  if (google) {
    return sharp(google)
      .resize(OUTPUT_WIDTH, OUTPUT_HEIGHT, { fit: "cover", position: "centre" })
      .png()
      .toBuffer();
  }
  return renderOsmPreview(lat, lng);
}
