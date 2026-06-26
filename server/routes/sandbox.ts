import { Router } from 'express';

const router = Router();

interface SandboxLog {
  id: string;
  provider: 'stripe' | 'twilio' | 'auth0' | 'webhook';
  method: string;
  path: string;
  body: any;
  query: any;
  headers: any;
  timestamp: number;
  response: any;
}

let sandboxLogs: SandboxLog[] = [];
let logIdCounter = 0;

function addLog(provider: 'stripe' | 'twilio' | 'auth0' | 'webhook', method: string, path: string, req: any, resBody: any) {
  const log: SandboxLog = {
    id: `log_${Date.now()}_${++logIdCounter}`,
    provider,
    method,
    path,
    body: req.body || {},
    query: req.query || {},
    headers: req.headers || {},
    timestamp: Date.now(),
    response: resBody
  };
  sandboxLogs.push(log);
  if (sandboxLogs.length > 500) {
    sandboxLogs.shift();
  }
}

// --- Stripe Mocks ---
router.post('/stripe/v1/payment_intents', (req, res) => {
  const amount = Number(req.body.amount || 2000);
  const currency = req.body.currency || 'usd';
  const metadata = req.body.metadata || {};
  
  const paymentIntent = {
    id: `pi_mock_${Math.random().toString(36).substring(2, 11)}`,
    object: 'payment_intent',
    amount,
    amount_capturable: 0,
    amount_details: { tip: {} },
    amount_received: amount,
    application: null,
    application_fee_amount: null,
    automatic_payment_methods: null,
    canceled_at: null,
    cancellation_reason: null,
    capture_method: 'automatic',
    client_secret: `pi_mock_secret_${Math.random().toString(36).substring(2, 24)}`,
    confirmation_method: 'automatic',
    created: Math.floor(Date.now() / 1000),
    currency,
    customer: req.body.customer || null,
    description: req.body.description || 'Mock Payment Intent',
    invoice: null,
    last_payment_error: null,
    latest_charge: `ch_mock_${Math.random().toString(36).substring(2, 11)}`,
    livemode: false,
    metadata,
    next_action: null,
    on_behalf_of: null,
    payment_method: `pm_mock_${Math.random().toString(36).substring(2, 11)}`,
    payment_method_configuration_details: null,
    payment_method_options: {},
    payment_method_types: ['card'],
    processing: null,
    receipt_email: req.body.receipt_email || null,
    review: null,
    setup_future_usage: null,
    shipping: null,
    statement_descriptor: null,
    statement_descriptor_suffix: null,
    status: 'succeeded',
    transfer_data: null,
    transfer_group: null
  };

  addLog('stripe', 'POST', '/v1/payment_intents', req, paymentIntent);
  res.json(paymentIntent);
});

router.post('/stripe/v1/checkout/sessions', (req, res) => {
  const successUrl = req.body.success_url || 'http://localhost:3000/success';
  const cancelUrl = req.body.cancel_url || 'http://localhost:3000/cancel';
  
  const session = {
    id: `cs_mock_${Math.random().toString(36).substring(2, 11)}`,
    object: 'checkout.session',
    after_expiration: null,
    allow_promotion_codes: null,
    amount_subtotal: 2000,
    amount_total: 2000,
    automatic_tax: { enabled: false, liability: null, status: null },
    billing_address_collection: null,
    cancel_url: cancelUrl,
    client_reference_id: req.body.client_reference_id || null,
    client_secret: null,
    consent: null,
    consent_collection: null,
    created: Math.floor(Date.now() / 1000),
    currency: req.body.currency || 'usd',
    currency_conversion: null,
    custom_fields: [],
    custom_text: {
      after_submit: null,
      shipping_address: null,
      submit: null,
      terms_of_service_acceptance: null
    },
    customer: null,
    customer_creation: 'if_required',
    customer_details: null,
    customer_email: req.body.customer_email || null,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    invoice: null,
    invoice_creation: null,
    livemode: false,
    locale: null,
    metadata: req.body.metadata || {},
    mode: req.body.mode || 'payment',
    payment_intent: `pi_mock_${Math.random().toString(36).substring(2, 11)}`,
    payment_link: null,
    payment_method_configuration_details: null,
    payment_method_collection: 'always',
    payment_method_options: {},
    payment_method_types: ['card'],
    payment_status: 'unpaid',
    phone_number_collection: { enabled: false },
    recovered_from: null,
    redirect_on_completion: 'never',
    setup_intent: null,
    shipping_address_collection: null,
    shipping_cost: null,
    shipping_details: null,
    shipping_options: [],
    status: 'open',
    submit_type: null,
    subscription: null,
    success_url: successUrl,
    total_details: { amount_discount: 0, amount_shipping: 0, amount_tax: 0 },
    ui_mode: 'hosted',
    url: 'https://checkout.stripe.com/c/pay/mock_session_url'
  };

  addLog('stripe', 'POST', '/v1/checkout/sessions', req, session);
  res.json(session);
});

// --- Twilio Mocks ---
router.post('/twilio/2010-04-01/Accounts/:sid/Messages.json', (req, res) => {
  const fromNum = req.body.From || 'mock-twilio-number';
  const toNum = req.body.To || 'mock-user-number';
  const msgBody = req.body.Body || '';
  
  const twilioMessage = {
    sid: `SM_mock_${Math.random().toString(36).substring(2, 34)}`,
    date_created: new Date().toUTCString(),
    date_updated: new Date().toUTCString(),
    date_sent: null,
    account_sid: req.params.sid,
    to: toNum,
    from: fromNum,
    messaging_service_sid: null,
    body: msgBody,
    status: 'queued',
    num_segments: '1',
    num_media: '0',
    direction: 'outbound-api',
    api_version: '2010-04-01',
    price: '0.0075',
    price_unit: 'USD',
    error_code: null,
    error_message: null,
    uri: `/2010-04-01/Accounts/${req.params.sid}/Messages/SM_mock.json`,
    subresource_uris: {
      media: `/2010-04-01/Accounts/${req.params.sid}/Messages/SM_mock/Media.json`
    }
  };

  addLog('twilio', 'POST', `/2010-04-01/Accounts/${req.params.sid}/Messages.json`, req, twilioMessage);
  res.status(201).json(twilioMessage);
});

// --- Auth0 Mocks ---
router.post('/auth0/oauth/token', (req, res) => {
  const tokenResponse = {
    access_token: `auth0_mock_access_${Math.random().toString(36).substring(2, 24)}`,
    id_token: `auth0_mock_id_${Math.random().toString(36).substring(2, 24)}`,
    scope: req.body.scope || 'openid profile email',
    expires_in: 86400,
    token_type: 'Bearer'
  };

  addLog('auth0', 'POST', '/oauth/token', req, tokenResponse);
  res.json(tokenResponse);
});

router.get('/auth0/userinfo', (req, res) => {
  const userinfo = {
    sub: 'auth0|mock_user_123',
    nickname: 'mockdeveloper',
    name: 'Mock Developer',
    picture: 'https://secure.gravatar.com/avatar/mock',
    updated_at: new Date().toISOString(),
    email: 'developer@example.com',
    email_verified: true
  };

  addLog('auth0', 'GET', '/userinfo', req, userinfo);
  res.json(userinfo);
});

// --- Management Endpoints ---
router.get('/logs', (req, res) => {
  res.json({ success: true, logs: sandboxLogs });
});

router.post('/clear', (req, res) => {
  sandboxLogs = [];
  res.json({ success: true });
});

router.post('/trigger-webhook', async (req, res) => {
  const { webhookUrl, eventType } = req.body;
  if (!webhookUrl || !eventType) {
    return res.status(400).json({ error: 'webhookUrl and eventType are required' });
  }

  const mockEventId = `evt_mock_${Math.random().toString(36).substring(2, 11)}`;
  const mockObjectId = `obj_mock_${Math.random().toString(36).substring(2, 11)}`;
  
  let webhookPayload: any = {};

  if (eventType.startsWith('payment_intent.')) {
    webhookPayload = {
      id: mockEventId,
      object: 'event',
      api_version: '2023-10-16',
      created: Math.floor(Date.now() / 1000),
      data: {
        object: {
          id: mockObjectId,
          object: 'payment_intent',
          amount: 2000,
          amount_received: eventType === 'payment_intent.succeeded' ? 2000 : 0,
          client_secret: 'pi_mock_secret_12345',
          currency: 'usd',
          status: eventType === 'payment_intent.succeeded' ? 'succeeded' : 'requires_payment_method',
          metadata: { is_mock: 'true' }
        }
      },
      livemode: false,
      pending_webhooks: 1,
      request: { id: 'req_mock_123', idempotency_key: 'idemp_mock_123' },
      type: eventType
    };
  } else if (eventType.startsWith('customer.subscription.')) {
    webhookPayload = {
      id: mockEventId,
      object: 'event',
      api_version: '2023-10-16',
      created: Math.floor(Date.now() / 1000),
      data: {
        object: {
          id: mockObjectId,
          object: 'subscription',
          customer: 'cus_mock_123',
          status: eventType === 'customer.subscription.deleted' ? 'canceled' : 'active',
          metadata: { is_mock: 'true' }
        }
      },
      livemode: false,
      type: eventType
    };
  } else {
    // Generic event
    webhookPayload = {
      id: mockEventId,
      object: 'event',
      created: Math.floor(Date.now() / 1000),
      data: {
        object: {
          id: mockObjectId,
          status: 'success',
          metadata: { is_mock: 'true' }
        }
      },
      type: eventType
    };
  }

  const mockReq = {
    body: { webhookUrl, eventType, payload: webhookPayload },
    query: {},
    headers: { 'user-agent': 'Github-devy Webhook Trigger' }
  };

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(webhookPayload)
    });
    
    const responseText = await response.text();
    let responseBody = responseText;
    try {
      responseBody = JSON.parse(responseText);
    } catch (_) {}

    const resData = {
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
      body: responseBody
    };

    addLog('webhook', 'POST', webhookUrl, mockReq, resData);
    res.json({ success: true, response: resData });
  } catch (err: any) {
    const errorRes = { error: err.message };
    addLog('webhook', 'POST', webhookUrl, mockReq, errorRes);
    res.status(500).json(errorRes);
  }
});

export default router;
