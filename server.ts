import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';

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
      appType: 'custom',
    });
    app.use(vite.middlewares);

    app.get('*', async (req, res, next) => {
      const url = req.originalUrl;
      const originalPath = req.path;
      
      // Skip API routes
      if (url.startsWith('/api')) {
        console.log(`[API 404] Missing endpoint: ${url}`);
        return next();
      }

      // Skip common static file extensions - standard Vite middleware should have caught these
      // if they existed. If they didn't, we might not want to serve index.html for them.
      if (originalPath.match(/\.(js|css|png|jpg|jpeg|gif|svg|ico|json|woff|woff2|ttf|otf)$/)) {
        return next();
      }

      try {
        const indexPath = path.resolve(process.cwd(), 'index.html');
        if (!fs.existsSync(indexPath)) {
          console.error(`[SPA Error] index.html not found at ${indexPath}`);
          return res.status(404).send('index.html not found');
        }
        
        let template = fs.readFileSync(indexPath, 'utf-8');
        template = await vite.transformIndexHtml(url, template);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      } catch (e) {
        vite.ssrFixStacktrace(e as Error);
        console.error(`[Vite Transform Error] URL: ${url}`, e);
        res.status(500).json({ error: 'Internal Server Error during Vite transformation' });
      }
    });
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    
    // Serve static files from dist
    app.use(express.static(distPath, { index: false }));
    
    // Serve index.html for all other routes (SPA Fallback)
    app.get('*', (req, res) => {
      const url = req.url;
      
      // Skip API routes
      if (url.startsWith('/api')) {
        return res.status(404).json({ error: 'API route not found' });
      }

      // Skip files with extensions that weren't found by express.static
      if (req.path.includes('.')) {
        return res.status(404).send('File not found');
      }

      const indexPath = path.join(distPath, 'index.html');
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        console.error(`[Production SPA Error] Build not found at ${indexPath}`);
        res.status(404).send('Build not found. Please run npm run build.');
      }
    });
  }

  // Final 404 Catch-all (for things that reached here, like missing APIs)
  app.use((req, res) => {
    console.log(`[404] No route matched for ${req.method} ${req.originalUrl}`);
    res.status(404).json({ 
      error: 'Not Found', 
      path: req.originalUrl,
      help: 'If this is a UI route, ensure SPA fallback is working. If this is an API, check the endpoint path.'
    });
  });

  // Global Error Handler
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error(`[Global Error] ${req.method} ${req.url}`, err);
    res.status(500).json({
      error: 'Internal Server Error',
      message: err.message,
      stack: process.env.NODE_ENV === 'production' ? null : err.stack
    });
  });

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
