const fs = require('fs');
const path = require('path');

// Simple 1x1 pixel transparent PNG base64 data
const iconData = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

const sizes = [16, 48, 128];
const iconDir = path.join(__dirname, '../public/icons');

// Create icons directory if it doesn't exist
if (!fs.existsSync(iconDir)) {
  fs.mkdirSync(iconDir, { recursive: true });
}

// Create icon files
sizes.forEach(size => {
  fs.writeFileSync(path.join(iconDir, `icon${size}.png`), iconData);
}); 