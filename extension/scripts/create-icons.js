import { promises as fs } from 'fs';
import path from 'path';
import sharp from 'sharp';

async function createIcons() {
  const sizes = [16, 48, 128];
  
  try {
    const publicIconsDir = path.join(process.cwd(), 'public', 'icons');
    const distIconsDir = path.join(process.cwd(), 'dist', 'icons');
    
    await fs.mkdir(publicIconsDir, { recursive: true });
    await fs.mkdir(distIconsDir, { recursive: true });
    
    for (const size of sizes) {
      const svg = `
        <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
          <rect width="${size}" height="${size}" fill="#0066cc"/>
          <text 
            x="50%" 
            y="50%" 
            font-family="Arial" 
            font-size="${size * 0.5}px" 
            fill="white" 
            text-anchor="middle" 
            dominant-baseline="middle"
          >
            CV
          </text>
        </svg>`;

      const filename = `Icon${size}.png`;
      
      // Convert SVG to PNG
      await sharp(Buffer.from(svg))
        .png()
        .toFile(path.join(publicIconsDir, filename));
      
      await sharp(Buffer.from(svg))
        .png()
        .toFile(path.join(distIconsDir, filename));
    }
    
    console.log('Icons created successfully in public/icons/ and dist/icons/!');
  } catch (error) {
    console.error('Error creating icons:', error);
  }
}

createIcons(); 