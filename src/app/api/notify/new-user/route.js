import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';

// Sends a WhatsApp (Meta Cloud API) template message to the admin when a
// brand-new customer logs in for the first time.
//
// Env vars:
//   WHATSAPP_ACCESS_TOKEN     permanent access token
//   WHATSAPP_PHONE_NUMBER_ID  sender phone-number ID from Meta dashboard
//   WHATSAPP_ADMIN_NUMBER     admin number with country code, digits only (e.g. 919876543210)
//   WHATSAPP_TEMPLATE_NAME    approved template name
//   WHATSAPP_TEMPLATE_LANG    template language code (default "en")
//
// Template "new_account_admin" body variables:
//   {{1}} Name, {{2}} Email, {{3}} Phone, {{4}} Account ID

async function verifyFirebasePhone(idToken) {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!apiKey || !idToken) return null;
  const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken })
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.users?.[0]?.phoneNumber || null;
}

async function sendWhatsAppTemplate(values) {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const to = (process.env.WHATSAPP_ADMIN_NUMBER || '').replace(/\D/g, '');
  const templateName = process.env.WHATSAPP_TEMPLATE_NAME;
  if (!token || !phoneNumberId || !to || !templateName) {
    console.warn('WhatsApp notify skipped: missing WHATSAPP_* env vars');
    return;
  }

  const template = {
    name: templateName,
    language: { code: process.env.WHATSAPP_TEMPLATE_LANG || 'en' }
  };
  template.components = [{
    type: 'body',
    parameters: values.map(text => ({ type: 'text', text: String(text) }))
  }];

  const res = await fetch(`https://graph.facebook.com/v20.0/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', to, type: 'template', template })
  });
  if (!res.ok) {
    console.error('WhatsApp send failed:', res.status, await res.text());
  }
}

export async function POST(request) {
  try {
    const { idToken } = await request.json().catch(() => ({}));

    // Only trust the phone number proven by the Firebase OTP token.
    const phone = await verifyFirebasePhone(idToken);
    if (!phone) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const cleanPhone = phone.replace(/[^\d+]/g, '');

    // ignoreDuplicates => only a genuinely new row is returned.
    const { data, error } = await supabaseAdmin
      .from('users')
      .upsert(
        { phone: cleanPhone, last_login: new Date().toISOString() },
        { onConflict: 'phone', ignoreDuplicates: true }
      )
      .select();
    if (error) {
      console.error('new-user insert error:', error);
      return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }

    const isNew = Array.isArray(data) && data.length > 0;
    if (isNew) {
      const row = data[0];
      await sendWhatsAppTemplate([
        row.name || '-',
        row.email || '-',
        cleanPhone,
        row.id ?? cleanPhone
      ]);
    }

    return NextResponse.json({ isNew });
  } catch (err) {
    console.error('notify new-user error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
