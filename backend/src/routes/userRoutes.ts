import { Router } from 'express';
import { z } from 'zod';
import { createUserShare } from '../services/shareService';

const router = Router();

const registerSchema = z.object({
  deviceFingerprint: z.string().min(8),
  shareB: z.string().min(16),
});

router.post('/register', async (req, res) => {
  /*
    Endpoint: POST /api/user/register
    Request shape:
    {
      deviceFingerprint: string,
      shareB: string (base64)
    }

    Response shape:
    {
      userId: string,
      sessionToken: string
    }
  */
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid request body', issues: parsed.error.issues });
  }

  const created = await createUserShare(parsed.data.deviceFingerprint, parsed.data.shareB);
  return res.status(201).json(created);
});

export default router;
