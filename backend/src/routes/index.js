import { Router } from 'express';

const router = Router();

router.get('/logs', (req, res) => {
    res.json([
        { id: 1, message: 'log entry 1' },
        { id: 2, message: 'log entry 2' },
    ]);
});

export default router;