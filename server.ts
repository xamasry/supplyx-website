import express from 'express';
import cors from 'cors';
import path from 'path';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  // API Routes
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
  });

  const whatsappRouter = (await import('./server/whatsapp/webhook')).default;
  const { notifyNearbySuppliers } = await import('./server/triggers/onNewRequest');
  const { db } = await import('./src/lib/firebase');
  const { doc, getDoc } = await import('firebase/firestore');

  app.use('/api/whatsapp', whatsappRouter);

  app.post('/api/requests/notify', async (req, res) => {
    const { requestId } = req.body;
    
    try {
      const requestDoc = await getDoc(doc(db, 'requests', requestId));
      if (!requestDoc.exists()) {
        return res.status(404).json({ error: 'Request not found' });
      }
      
      const request = { id: requestId, ...requestDoc.data() } as any;
      
      notifyNearbySuppliers(request).catch(console.error);
      
      res.json({ success: true, message: 'Notification process started' });
    } catch (err) {
      res.status(500).json({ error: 'Failed to notify suppliers' });
    }
  });

  app.post('/api/whatsapp/send-verification', async (req, res) => {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ error: 'Phone is required' });

    try {
      const { sendTextMessage } = await import('./server/whatsapp/sender');
      
      // Format phone to international format (assuming Egypt +20)
      const formattedPhone = phone.startsWith('20') ? phone : '20' + phone.replace(/^0+/, '');
      
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      
      const { setDoc } = await import('firebase/firestore');
      
      await setDoc(doc(db, 'phone_verifications', formattedPhone), {
        code,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString()
      });

      const message = `كود التحقق الخاص بك في SupplyX هو: *${code}*\n\nالرجاء إدخال هذا الكود في صفحة التسجيل.`;
      console.log(`[WhatsApp Attempt] Sending OTP to: ${formattedPhone}`);
      const response = await sendTextMessage(formattedPhone, message) as any;
      console.log(`[WhatsApp Response]`, JSON.stringify(response));
      
      let whatsappError = null;
      let errorType = null;

      if (response && typeof response === 'object' && 'error' in response) {
        const err = response.error;
        whatsappError = err.message;
        errorType = err.code === 131030 ? 'SANDBOX_RESTRICTION' : 'API_ERROR';
        console.error(`WhatsApp Error [${errorType}]:`, whatsappError);
      } else if (!response) {
        whatsappError = 'لم يتم استلام رد من خادم واتساب';
        errorType = 'CONNECTION_ERROR';
      }

      res.json({ 
        success: true, 
        mockCode: (!response || errorType) ? code : undefined,
        whatsappError: whatsappError,
        errorType: errorType
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to send verification code' });
    }
  });

  // Mock endpoints for the sake of presentation
  // In a real app we would use Supabase via client or service role
  // Supabase takes care of most DB functionality directly but we could add webhooks
  app.post('/api/auth/register', (req, res) => {
    res.json({ success: true, message: 'Mock registration successful' });
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    // In express 4.x we use * to match all fallback routes
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
