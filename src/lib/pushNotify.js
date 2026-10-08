/**
 * Sends a push notification through Expo's push service to a device holding an Expo push token
 * (saved by the mobile app into `users.push_token`). No Expo account/access-token is required for
 * ordinary volumes; see https://docs.expo.dev/push-notifications/sending-notifications/.
 *
 * Never throws — a failed push must not break the order-status update that triggered it.
 */
export async function sendPushNotification(pushToken, { title, body, data } = {}) {
  if (!pushToken || typeof pushToken !== 'string' || !pushToken.startsWith('ExponentPushToken')) return;
  try {
    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ to: pushToken, title, body, data, sound: 'default', priority: 'high' }),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok || json?.data?.status === 'error') {
      console.warn('Expo push send failed:', json?.data?.message || res.status);
    }
  } catch (err) {
    console.warn('Expo push send error:', err?.message);
  }
}

/** Copy shown to the passenger for each order status the admin can set. */
export const ORDER_STATUS_MESSAGES = {
  Placed: { title: 'Order confirmed 🍽️', body: 'Your order has been received and is being lined up with the kitchen.' },
  Preparing: { title: 'Your food is being prepared 👨‍🍳', body: "The kitchen has started cooking your order — it'll be ready soon." },
  Dispatched: { title: 'On its way to your berth 🚉', body: 'Your order is out for delivery and will reach your seat shortly.' },
  Delivered: { title: 'Delivered — enjoy your meal! 🎉', body: 'Your order has been delivered. Bon appétit!' },
  Cancelled: { title: 'Order cancelled', body: 'Your order has been cancelled. Contact support if this is unexpected.' },
};
