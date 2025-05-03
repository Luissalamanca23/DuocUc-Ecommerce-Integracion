// server.js
require('dotenv').config();             // Si usas .env para tus claves
const express = require('express');
const cors = require('cors');           // Para permitir llamadas desde tu front
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const app = express();

// Middlewares
app.use(cors());                        // Ajusta orígenes si es necesario
app.use(express.json());                // Para parsear application/json

// 1) Endpoint para crear/confirmar el PaymentIntent
app.post('/process-payment', async (req, res) => {
    const { payment_method_id, amount, name, email } = req.body;
    try {
      const pi = await stripe.paymentIntents.create({
        amount,
        currency: 'usd',
        payment_method_types: ['card'],
        payment_method: payment_method_id,
        confirmation_method: 'manual',
        confirm: true,
        receipt_email: email,
        metadata: { customer_name: name }
      });
  
      if (pi.status === 'requires_action') {
        return res.json({
          requires_action: true,
          payment_intent_client_secret: pi.client_secret
        });
      }
      if (pi.status === 'succeeded') {
        return res.json({ success: true });
      }
      return res.json({ error: `Unexpected status ${pi.status}` });
    } catch (err) {
      console.error('🚨 Stripe error:', err);
      return res.status(400).json({ error: err.message });
    }
  });

// 2) Endpoint para confirmar después de 3D Secure
app.post('/confirm-payment', async (req, res) => {
  const { payment_intent_id } = req.body;
  try {
    const paymentIntent = await stripe.paymentIntents.confirm(payment_intent_id);
    if (paymentIntent.status === 'succeeded') {
      return res.json({ success: true });
    } else {
      return res.json({ error: 'No se pudo confirmar el pago. Estado: ' + paymentIntent.status });
    }
  } catch (err) {
    console.error(err);
    return res.status(400).json({ error: err.message });
  }
});

// 3) (Opcional) Webhook para eventos de Stripe, si lo necesitas
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;  
app.post('/webhook', express.raw({type: 'application/json'}), (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }
  // Maneja eventos aquí...
  res.send();
});

// Arrancar servidor
const PORT = process.env.PORT || 4242;
app.listen(PORT, () => console.log(`Servidor escuchando en puerto ${PORT}`));