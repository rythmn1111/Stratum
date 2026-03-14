import { Router } from 'express';
import { z } from 'zod';
import { fetchShareB, updateShareB } from '../services/shareService';

const router = Router();

const fetchSchema = z.object({
  userId: z.string().uuid(),
  deviceFingerprint: z.string().min(8),
  sessionToken: z.string().min(10),
});

const updateSchema = z.object({
  userId: z.string().uuid(),
  deviceFingerprint: z.string().min(8),
  sessionToken: z.string().min(10),
  nextShareB: z.string().min(16),
});

router.post('/fetch', async (req, res) => {
  /*
    Endpoint: POST /api/share/fetch
    Request shape:
    {
      userId: string,
      deviceFingerprint: string,
      sessionToken: string
    }

    Response shape:
    {
      shareB: string (base64)
    }
  */
  const parsed = fetchSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid request body', issues: parsed.error.issues });
  }

  const share = await fetchShareB(
    parsed.data.userId,
    parsed.data.deviceFingerprint,
    parsed.data.sessionToken,
  );

  if (!share) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  // Server share is released only to authenticated device + valid session token combinations.
  return res.status(200).json({ shareB: share });
});

router.post('/update', async (req, res) => {
  /*
    Endpoint: POST /api/share/update
    Request shape:
    {
      userId: string,
      deviceFingerprint: string,
      sessionToken: string,
      nextShareB: string (base64)
    }

    Response shape:
    {
      success: boolean
    }
  */
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid request body', issues: parsed.error.issues });
  }

  const updated = await updateShareB(
    parsed.data.userId,
    parsed.data.deviceFingerprint,
    parsed.data.sessionToken,
    parsed.data.nextShareB,
  );

  if (!updated) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  return res.status(200).json({ success: true });
});

export default router;
