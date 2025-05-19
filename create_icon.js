// Create a simple sticky note icon
const canvas = document.createElement('canvas');
canvas.width = 128;
canvas.height = 128;
const ctx = canvas.getContext('2d');

// Draw a yellow sticky note
ctx.fillStyle = '#FFEB3B';
ctx.fillRect(10, 10, 108, 108);

// Add a shadow effect
ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
ctx.shadowBlur = 10;
ctx.shadowOffsetX = 5;
ctx.shadowOffsetY = 5;

// Draw the black text lines
ctx.shadowColor = 'transparent';
ctx.strokeStyle = '#000';
ctx.lineWidth = 2;
ctx.beginPath();
ctx.moveTo(30, 40);
ctx.lineTo(90, 40);
ctx.stroke();

ctx.beginPath();
ctx.moveTo(30, 60);
ctx.lineTo(90, 60);
ctx.stroke();

ctx.beginPath();
ctx.moveTo(30, 80);
ctx.lineTo(70, 80);
ctx.stroke();

// Convert to data URL and log it
console.log(canvas.toDataURL());
