require('dotenv').config();
const express = require('express');
const axios = require('axios');
const path = require('path');
const fs = require('fs');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3000;
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;
const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
const hasPaystackSecret = Boolean(
  PAYSTACK_SECRET_KEY &&
  !PAYSTACK_SECRET_KEY.toLowerCase().includes('your_')
);

app.disable('x-powered-by');
app.disable('etag');

app.use((req, res, next) => {
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please try again later.' }
});

app.use('/api', apiLimiter);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'DeanKing Smartdevice City backend is running.' });
});

const allowedStaticExtensions = new Set(['.html', '.css', '.js', '.jpg', '.jpeg', '.png', '.webp', '.gif', '.svg', '.ico', '.json']);
app.use((req, res, next) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') return next();

  const requestedPath = req.path || '/';
  const extension = path.extname(requestedPath).toLowerCase();

  if (requestedPath.includes('..') || (!extension && requestedPath !== '/')) {
    return res.status(400).send('Invalid request path');
  }

  if (extension && !allowedStaticExtensions.has(extension)) {
    return res.status(403).send('Forbidden file type');
  }

  next();
});

app.use(express.static(__dirname, {
  index: false,
  extensions: ['html'],
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-store');
    }
  }
}));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'DeanKing-Smartdevice-City.html'));
});

app.get('/cart.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'cart.html'));
});

app.post('/api/create-payment', async (req, res) => {
  const { email, name, amount, metadata } = req.body || {};

  if (!email || !name || !amount || Number(amount) <= 0) {
    return res.status(400).json({ error: 'Missing required payment data.' });
  }

  if (!hasPaystackSecret) {
    return res.status(500).json({ error: 'Paystack secret key is not configured.' });
  }

  try {
    const response = await axios.post(
      'https://api.paystack.co/transaction/initialize',
      {
        email,
        amount: Math.round(Number(amount) * 100),
        currency: 'NGN',
        callback_url: `${BASE_URL}/payment/callback`,
        reference: `DK-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
        metadata: {
          custom_fields: [
            {
              display_name: 'Customer Name',
              variable_name: 'customer_name',
              value: name
            },
            ...(Array.isArray(metadata?.cart) && metadata.cart.length
              ? [{
                  display_name: 'Cart Items',
                  variable_name: 'cart_items',
                  value: metadata.cart.join(', ')
                }]
              : [])
          ]
        }
      },
      {
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    return res.json({
      authorization_url: response.data.data.authorization_url,
      reference: response.data.data.reference
    });
  } catch (error) {
    console.error(error.response?.data || error.message);
    return res.status(500).json({
      error: 'Unable to initialize Paystack payment. Please try again.'
    });
  }
});

app.get('/payment/callback', async (req, res) => {
  const reference = req.query.reference;

  if (!reference) {
    return res.send(`
      <html>
        <head><title>Payment Error</title></head>
        <body style="font-family: Arial; padding: 40px; text-align:center;">
          <h2>Payment failed</h2>
          <p>No payment reference was provided.</p>
          <a href="/cart.html">Return to cart</a>
        </body>
      </html>
    `);
  }

  if (!hasPaystackSecret) {
    return res.send(`
      <html>
        <head><title>Configuration Error</title></head>
        <body style="font-family: Arial; padding: 40px; text-align:center;">
          <h2>Payment setup is incomplete</h2>
          <p>Add your Paystack secret key in the .env file and restart the app.</p>
        </body>
      </html>
    `);
  }

  try {
    const verifyRes = await axios.get(`https://api.paystack.co/transaction/verify/${reference}`, {
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`
      }
    });

    const data = verifyRes.data.data;

    if (data.status === 'success') {
      return res.redirect(`${BASE_URL}/cart.html?payment=success&reference=${reference}`);
    }

    return res.send(`
      <html>
        <head><title>Payment Unsuccessful</title></head>
        <body style="font-family: Arial; padding: 40px; text-align:center;">
          <h2>Payment was not successful</h2>
          <p>Please try again or contact support.</p>
          <a href="/cart.html">Return to cart</a>
        </body>
      </html>
    `);
  } catch (error) {
    console.error(error.response?.data || error.message);
    return res.send(`
      <html>
        <head><title>Verification Error</title></head>
        <body style="font-family: Arial; padding: 40px; text-align:center;">
          <h2>Payment verification error</h2>
          <p>Please contact the store owner.</p>
          <a href="/cart.html">Return to cart</a>
        </body>
      </html>
    `);
  }
});

app.get('*', (req, res) => {
  const requestPath = req.path.replace(/^\//, '');
  const safePath = path.resolve(__dirname, requestPath || 'DeanKing-Smartdevice-City.html');

  if (safePath.startsWith(__dirname) && fs.existsSync(safePath)) {
    return res.sendFile(safePath);
  }

  return res.sendFile(path.join(__dirname, 'DeanKing-Smartdevice-City.html'));
});

app.listen(PORT, () => {
  console.log(`DeanKing Smartdevice City server running on http://localhost:${PORT}`);
});
