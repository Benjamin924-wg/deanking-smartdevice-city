require('dotenv').config();
const express = require('express');
const axios = require('axios');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3000;
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;
const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
const hasPaystackSecret = Boolean(
  PAYSTACK_SECRET_KEY &&
  !PAYSTACK_SECRET_KEY.toLowerCase().includes('your_')
);
const OWNER_PASSWORD = process.env.PRODUCT_MANAGER_PASSWORD || 'DeanKingOwner2026!';
const productStorePath = path.join(__dirname, 'products.json');
const defaultProducts = [
  { id: 'phone-cases', name: 'Phone cases', description: 'Protect your phone with stylish and durable cases.', price: 3000, image: 'images/Phone cases.jpg' },
  { id: 'chargers', name: 'Chargers', description: 'Fast and reliable phone chargers for your devices.', price: 7000, image: 'images/Charger.jpg' },
  { id: 'power-banks', name: 'Power Banks', description: 'Keep your phone powered anywhere you go.', price: 45000, image: 'images/Power bank.jpg' },
  { id: 'earpieces', name: 'Earpieces', description: 'Enjoy clear sound and comfortable listening.', price: 5000, image: 'images/Earpieses.jpg' }
];
const sessions = new Map();

function getProducts() {
  try {
    if (!fs.existsSync(productStorePath)) {
      fs.writeFileSync(productStorePath, JSON.stringify(defaultProducts, null, 2));
    }
    const products = JSON.parse(fs.readFileSync(productStorePath, 'utf8'));
    return Array.isArray(products) ? products : defaultProducts;
  } catch (error) {
    console.error('Unable to read product catalog:', error.message);
    return defaultProducts;
  }
}

function saveProducts(products) {
  fs.writeFileSync(productStorePath, JSON.stringify(products, null, 2));
}

function isOwner(req) {
  const token = req.headers.cookie?.match(/(?:^|;\s*)owner_session=([^;]+)/)?.[1];
  return Boolean(token && sessions.has(token));
}

function requireOwner(req, res, next) {
  if (!isOwner(req)) {
    return res.status(401).json({ error: 'Owner login required.' });
  }
  next();
}

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

app.get('/api/products', (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.json(getProducts());
});

app.post('/api/owner/login', (req, res) => {
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  const expected = Buffer.from(OWNER_PASSWORD);
  const received = Buffer.from(password);
  const valid = expected.length === received.length && crypto.timingSafeEqual(expected, received);

  if (!valid) {
    return res.status(401).json({ error: 'Incorrect owner password.' });
  }

  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, Date.now());
  res.setHeader('Set-Cookie', `owner_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800`);
  res.json({ authenticated: true });
});

app.get('/api/owner/session', (req, res) => {
  res.json({ authenticated: isOwner(req) });
});

app.post('/api/owner/logout', (req, res) => {
  const token = req.headers.cookie?.match(/(?:^|;\s*)owner_session=([^;]+)/)?.[1];
  if (token) sessions.delete(token);
  res.setHeader('Set-Cookie', 'owner_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');
  res.json({ authenticated: false });
});

app.post('/api/products', requireOwner, (req, res) => {
  const { name, description, price, image } = req.body || {};
  if (!name || !description || !image || !Number.isFinite(Number(price)) || Number(price) <= 0) {
    return res.status(400).json({ error: 'Valid product name, information, price, and image are required.' });
  }
  const product = {
    id: `product-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
    name: String(name).trim(),
    description: String(description).trim(),
    price: Number(price),
    image: String(image).trim()
  };
  const products = getProducts();
  products.push(product);
  saveProducts(products);
  res.status(201).json(product);
});

app.put('/api/products/:id', requireOwner, (req, res) => {
  const { name, description, price, image } = req.body || {};
  if (!name || !description || !image || !Number.isFinite(Number(price)) || Number(price) <= 0) {
    return res.status(400).json({ error: 'Valid product name, information, price, and image are required.' });
  }
  const products = getProducts();
  const index = products.findIndex((product) => product.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Product not found.' });
  products[index] = {
    id: req.params.id,
    name: String(name).trim(),
    description: String(description).trim(),
    price: Number(price),
    image: String(image).trim()
  };
  saveProducts(products);
  res.json(products[index]);
});

app.delete('/api/products/:id', requireOwner, (req, res) => {
  const products = getProducts();
  const remaining = products.filter((product) => product.id !== req.params.id);
  if (remaining.length === products.length) return res.status(404).json({ error: 'Product not found.' });
  saveProducts(remaining);
  res.status(204).end();
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
