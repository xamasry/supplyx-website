import { Router, Request, Response } from 'express';
import { handleIncomingMessage } from './flowHandler';

const router = Router();

// ===== Webhook Verification (مطلوب من Meta) =====
router.get('/webhook', (req: Request, res: Response) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    console.log('✅ WhatsApp Webhook verified');
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

// ===== استقبال الرسائل =====
router.post('/webhook', async (req: Request, res: Response) => {
  // الرد الفوري على Meta (مهم — لازم يرد في أقل من 5 ثواني)
  res.sendStatus(200);

  try {
    const body = req.body;
    if (body.object !== 'whatsapp_business_account') return;

    for (const entry of body.entry || []) {
      for (const change of entry.changes || []) {
        const value = change.value;
        if (!value?.messages?.length) continue;

        for (const message of value.messages) {
          const phone = message.from;
          const messageId = message.id;
          
          let content = '';
          let messageType: 'text' | 'button' | 'interactive' = 'text';

          // رسالة نصية
          if (message.type === 'text') {
            content = message.text?.body?.trim() || '';
            messageType = 'text';
          }
          // رد على زر
          else if (message.type === 'interactive') {
            const interactive = message.interactive;
            if (interactive?.type === 'button_reply') {
              content = interactive.button_reply?.id || '';
              messageType = 'button';
            } else if (interactive?.type === 'list_reply') {
              content = interactive.list_reply?.id || '';
              messageType = 'interactive';
            }
          }

          if (!content && !messageType) continue;

          // معالجة الرسالة بشكل async
          await handleIncomingMessage(phone, messageType, content, messageId);
        }
      }
    }
  } catch (err) {
    console.error('Webhook processing error:', err);
  }
});

export default router;
