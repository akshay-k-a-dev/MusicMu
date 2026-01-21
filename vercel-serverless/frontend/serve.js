import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5173;
const distPath = path.join(__dirname, 'dist');

// Enable CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});

// Serve static files from dist directory
app.use(express.static(distPath));

// Handle client-side routing - send index.html for any other request
app.use((req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🌐 Frontend server running on http://0.0.0.0:${PORT}`);
  console.log(`🎵 Access Cantio at http://cantio.local:${PORT}`);
});
