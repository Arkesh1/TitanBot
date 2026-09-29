import sharp from 'sharp';
import path from 'path';

export async function createWarningCard({ user }) {
    const backgroundPath = path.join(process.cwd(), 'src', 'warning-bg.png');

    const bgMeta = await sharp(backgroundPath).metadata();
    const width = 1200;
    const height = Math.round(width * (bgMeta.height / bgMeta.width));

    const avatarUrl = user.displayAvatarURL({
        extension: 'png',
        size: 512,
        forceStatic: true,
    });

    const response = await fetch(avatarUrl);
    if (!response.ok) {
        throw new Error(`Failed to download Discord avatar: ${response.status}`);
    }
    const avatarBuffer = Buffer.from(await response.arrayBuffer());

    // ---- Tweak these ----
    const headCenterX = 0.655;   // center of the FRONT face (fraction of width)
    const headCenterY = 0.585;   // center of the FRONT face (fraction of height)
    const faceWRatio = 0.19;     // front face width (fraction of width)
    const faceHRatio = 1.2;      // front face height relative to its width
    const depthRatio = 0.28;     // how thick the block is (fraction of face width)
    const pixels = 16;           // pixelation level, lower = blockier
    // ---------------------

    const faceW = Math.round(width * faceWRatio);
    const faceH = Math.round(faceW * faceHRatio);
    const depth = Math.round(faceW * depthRatio);
    const slope = 0.5;                       // how steeply the depth recedes upward
    const rise = Math.round(depth * slope);  // vertical offset of the depth faces

    // Pixelated base so the head looks Minecraft-style
    const pixelated = await sharp(avatarBuffer)
        .resize(pixels, pixels, { fit: 'cover', position: 'centre' })
        .png()
        .toBuffer();

    const scale = (w, h) =>
        sharp(pixelated)
            .resize(w, h, { fit: 'fill', kernel: 'nearest' })
            .png()
            .toBuffer();

    const transparent = { r: 0, g: 0, b: 0, alpha: 0 };
    const nearest = sharp.interpolators.nearest;

    // Front face with a subtle gradient and dark outline
    const shade = Buffer.from(`
        <svg width="${faceW}" height="${faceH}" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stop-color="#fff" stop-opacity="0.18"/>
                    <stop offset="1" stop-color="#000" stop-opacity="0.25"/>
                </linearGradient>
            </defs>
            <rect width="100%" height="100%" fill="url(#g)"/>
            <rect x="1" y="1" width="${faceW - 2}" height="${faceH - 2}"
                  fill="none" stroke="#000" stroke-opacity="0.6" stroke-width="2"/>
        </svg>`);

    const front = await sharp(await scale(faceW, faceH))
        .composite([{ input: shade }])
        .png()
        .toBuffer();

    // Right side face: sheared up and darkened
    const side = await sharp(await scale(depth, faceH))
        .affine([[1, 0], [-slope, 1]], { background: transparent, interpolator: nearest })
        .modulate({ brightness: 0.55 })
        .png()
        .toBuffer();

    // Top face: sheared sideways and lightened
    const top = await sharp(await scale(faceW, rise))
        .affine([[1, -depth / rise], [0, 1]], { background: transparent, interpolator: nearest })
        .modulate({ brightness: 1.2 })
        .png()
        .toBuffer();

    const left = Math.round(width * headCenterX - faceW / 2);
    const topPos = Math.round(height * headCenterY - faceH / 2);

    return sharp(backgroundPath)
        .resize(width, height)
        .composite([
            { input: top, left, top: topPos - rise },
            { input: side, left: left + faceW, top: topPos - rise },
            { input: front, left, top: topPos },
        ])
        .png()
        .toBuffer();
}
