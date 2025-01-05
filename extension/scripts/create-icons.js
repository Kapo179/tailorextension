const fs = require('fs');
const path = require('path');

// Simple 1x1 pixel transparent PNG base64 data
const iconData = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

const sizes = [16, 48, 128];
const publicDir = path.join(__dirname, '../public');

// Create icons
sizes.forEach(size => {
  fs.writeFileSync(path.join(publicDir, `icon${size}.png`), iconData);
}); 