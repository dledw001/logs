import express from 'express';
import cors from 'cors';

const app = express();

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
    res.json({ service: 'logs-backend', status: 'ok'});
});

import router from './routes/index.js';
app.use('/api', router);

export default app;