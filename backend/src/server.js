import dotenv from 'dotenv';
dotenv.config({ quiet: true });

import app from './app.js';

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
   console.log(`logs backend listening on http://localhost:${PORT}`);
});
