const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const iconSizes = [72, 96, 128, 144, 152, 192, 384, 512];
const logoPath = path.join(__dirname, '../public/video-game-wingman-logo.png');
const iconsDir = path.join(__dirname, '../public/icons');

// Ensure icons directory exists
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// Check if logo exists
if (!fs.existsSync(logoPath)) {
  console.error('Logo not found at:', logoPath);
  console.log('Creating placeholder icons instead...');
  
  // Create simple placeholder icons
  iconSizes.forEach(size => {
    const svg = `
      <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
        <rect width="${size}" height="${size}" fill="#1a1a2e"/>
        <text x="50%" y="50%" font-family="Arial" font-size="${size * 0.3}" fill="#e94560" text-anchor="middle" dominant-baseline="middle" font-weight="bold">WM</text>
      </svg>
    `;
    
    sharp(Buffer.from(svg))
      .png()
      .toFile(path.join(iconsDir, `icon-${size}x${size}.png`))
      .then(() => console.log(`Created placeholder icon: icon-${size}x${size}.png`))
      .catch(err => console.error(`Error creating icon ${size}x${size}:`, err));
  });
} else {
  // Generate icons from logo
  console.log('Generating icons from logo...');
  
  Promise.all(
    iconSizes.map(size => {
      return sharp(logoPath)
        .resize(size, size, {
          fit: 'contain',
          background: { r: 26, g: 26, b: 46, alpha: 1 } // #1a1a2e
        })
        .png()
        .toFile(path.join(iconsDir, `icon-${size}x${size}.png`))
        .then(() => console.log(`Generated icon: icon-${size}x${size}.png`))
        .catch(err => console.error(`Error generating icon ${size}x${size}:`, err));
    })
  )
    .then(() => console.log('All icons generated successfully!'))
    .catch(err => console.error('Error generating icons:', err));
}
