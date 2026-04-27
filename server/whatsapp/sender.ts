function getWhatsAppConfig() {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (!token || !phoneId) {
    console.warn('WhatsApp API credentials missing (WHATSAPP_ACCESS_TOKEN or WHATSAPP_PHONE_NUMBER_ID)');
  }

  return {
    url: `https://graph.facebook.com/v19.0/${phoneId}/messages`,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  };
}

// ===== إرسال رسالة نصية عادية =====
export async function sendTextMessage(to: string, text: string): Promise<string | null> {
  const { url, headers } = getWhatsAppConfig();
  
  const body = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "text",
    text: { body: text, preview_url: false }
  };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: headers as any,
      body: JSON.stringify(body)
    });
    const data: any = await res.json();
    if (!res.ok) {
      console.error('WhatsApp API Error (sendTextMessage):', JSON.stringify(data, null, 2));
      return data; // Return the full error object
    }
    return data.messages?.[0]?.id || null;
  } catch (err) {
    console.error('WhatsApp sender error:', err);
    return null;
  }
}

// ===== إرسال رسالة بأزرار (Interactive Buttons) =====
export async function sendButtonMessage(
  to: string,
  bodyText: string,
  buttons: { id: string; title: string }[],
  headerText?: string
): Promise<string | null> {
  const { url, headers } = getWhatsAppConfig();
  const body = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "interactive",
    interactive: {
      type: "button",
      ...(headerText && {
        header: { type: "text", text: headerText }
      }),
      body: { text: bodyText },
      action: {
        buttons: buttons.map(btn => ({
          type: "reply",
          reply: { id: btn.id, title: btn.title.substring(0, 20) }
        }))
      }
    }
  };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: headers as any,
      body: JSON.stringify(body)
    });
    const data: any = await res.json();
    if (!res.ok) {
       console.error('WhatsApp API Error (sendButtonMessage):', JSON.stringify(data, null, 2));
    }
    return data.messages?.[0]?.id || null;
  } catch (err) {
    console.error('Button message error:', err);
    return null;
  }
}

// ===== إرسال قائمة (Interactive List) =====
export async function sendListMessage(
  to: string,
  bodyText: string,
  buttonLabel: string,
  sections: { title: string; rows: { id: string; title: string; description?: string }[] }[]
): Promise<string | null> {
  const { url, headers } = getWhatsAppConfig();
  const body = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "interactive",
    interactive: {
      type: "list",
      body: { text: bodyText },
      action: {
        button: buttonLabel,
        sections
      }
    }
  };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: headers as any,
      body: JSON.stringify(body)
    });
    const data: any = await res.json();
    if (!res.ok) {
       console.error('WhatsApp API Error (sendListMessage):', JSON.stringify(data, null, 2));
    }
    return data.messages?.[0]?.id || null;
  } catch (err) {
    console.error('List message error:', err);
    return null;
  }
}

// ===== إرسال Template Message (للإشعار الأول) =====
export async function sendTemplateMessage(
  to: string,
  templateName: string,
  components: any[]
): Promise<string | null> {
  const { url, headers } = getWhatsAppConfig();
  const body = {
    messaging_product: "whatsapp",
    to,
    type: "template",
    template: {
      name: templateName,
      language: { code: "ar" },
      components
    }
  };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: headers as any,
      body: JSON.stringify(body)
    });
    const data: any = await res.json();
    if (!res.ok) {
       console.error('WhatsApp API Error (sendTemplateMessage):', JSON.stringify(data, null, 2));
    }
    return data.messages?.[0]?.id || null;
  } catch (err) {
    console.error('Template message error:', err);
    return null;
  }
}
