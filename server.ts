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

  // Video proxy endpoint to bypass iOS / Safari Intelligent Tracking Prevention (ITP) and CORS for Google Drive videos
  app.get('/api/video/buyer', async (req, res) => {
    const videoUrl = 'https://drive.google.com/uc?export=download&id=17ob9XEwK3ICjetbZqS2DD0gpUMVgJuob';
    const rangeHeader = req.headers.range;

    const headers: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    };
    if (rangeHeader) {
      headers['Range'] = rangeHeader;
    }

    try {
      const response = await fetch(videoUrl, { headers });
      
      // Set appropriate video streaming/caching headers
      res.setHeader('Content-Type', 'video/mp4');
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      
      const contentRange = response.headers.get('content-range');
      if (contentRange) res.setHeader('Content-Range', contentRange);
      
      const contentLength = response.headers.get('content-length');
      if (contentLength) res.setHeader('Content-Length', contentLength);

      res.status(response.status);

      if (response.body) {
        const { Readable } = await import('stream');
        Readable.fromWeb(response.body as any).pipe(res);
      } else {
        res.end();
      }
    } catch (err) {
      console.error('Error proxying video stream:', err);
      // Fallback redirect if proxying fails
      res.redirect(videoUrl);
    }
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
      appType: 'custom', // We will handle the fallback manually for better control
    });
    
    app.use(vite.middlewares);

    app.get('*', async (req, res, next) => {
      const url = req.originalUrl;
      if (url.startsWith('/api')) return next();
      if (req.path.includes('.')) return next();

      try {
        let template = fs.readFileSync(path.resolve(process.cwd(), 'index.html'), 'utf-8');
        template = await vite.transformIndexHtml(url, template);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      } catch (e) {
        vite.ssrFixStacktrace(e as Error);
        next(e);
      }
    });
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    
    // 1. Serve static files with extensions first
    app.use(express.static(distPath, { 
      maxAge: '1d',
      index: false 
    }));
    
    // 2. SPA Fallback: Serve index.html for all non-API, non-asset routes
    app.get('*', (req, res, next) => {
      // Skip API
      if (req.url.startsWith('/api')) return next();
      
      // Skip files (already tried express.static)
      if (req.path.includes('.')) return next();

      res.sendFile(path.join(distPath, 'index.html'), (err) => {
        if (err) {
          console.error('[Prod SPA] Error sending index.html:', err);
          res.status(404).send('Application build not found. Please run npm run build.');
        }
      });
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
