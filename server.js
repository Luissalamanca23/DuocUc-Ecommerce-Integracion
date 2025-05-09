// server.js
require('dotenv').config();             // Carga las variables de entorno desde .env
const express = require('express');
const cors = require('cors');           // Para permitir llamadas desde tu front
const { Pool } = require('pg');         // Añadimos PostgreSQL
const path = require('path');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const app = express();

// Conexión a la base de datos PostgreSQL (Neon)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// Middlewares
app.use(cors());                        // Ajusta orígenes si es necesario
app.use(express.json());                // Para parsear application/json
app.use(express.static(path.join(__dirname, '/'))); // Para servir archivos estáticos

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

// ===== API PARA ADMINISTRACIÓN DE PRODUCTOS =====

// Obtener todas las categorías
app.get('/api/categories', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM categories ORDER BY name');
    res.json(result.rows);
  } catch (err) {
    console.error('Error al obtener categorías:', err);
    res.status(500).json({ error: 'Error al obtener categorías' });
  }
});

// Crear nueva categoría
app.post('/api/categories', async (req, res) => {
  const { name, description } = req.body;
  
  if (!name) {
    return res.status(400).json({ error: 'El nombre de la categoría es obligatorio' });
  }
  
  try {
    const result = await pool.query(
      'INSERT INTO categories (name, description) VALUES ($1, $2) RETURNING *',
      [name, description]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error al crear categoría:', err);
    res.status(500).json({ error: 'Error al crear la categoría' });
  }
});

// Obtener todos los productos
app.get('/api/products', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT p.*, c.name as category_name 
      FROM products p 
      JOIN categories c ON p.category_id = c.id 
      ORDER BY p.name
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('Error al obtener productos:', err);
    res.status(500).json({ error: 'Error al obtener productos' });
  }
});

// Obtener un producto específico
app.get('/api/products/:id', async (req, res) => {
  const productId = req.params.id;
  
  try {
    const result = await pool.query(`
      SELECT p.*, c.name as category_name 
      FROM products p 
      JOIN categories c ON p.category_id = c.id 
      WHERE p.id = $1
    `, [productId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }
    
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error al obtener producto:', err);
    res.status(500).json({ error: 'Error al obtener el producto' });
  }
});

// Crear nuevo producto
app.post('/api/products', async (req, res) => {
  const { category_id, name, description, price, stock } = req.body;
  
  if (!category_id || !name || !price) {
    return res.status(400).json({ 
      error: 'La categoría, nombre y precio son obligatorios'
    });
  }
  
  try {
    const result = await pool.query(
      'INSERT INTO products (category_id, name, description, price, stock) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [category_id, name, description, price, stock || 0]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error al crear producto:', err);
    res.status(500).json({ error: 'Error al crear el producto' });
  }
});

// Actualizar un producto
app.put('/api/products/:id', async (req, res) => {
  const productId = req.params.id;
  const { category_id, name, description, price, stock } = req.body;
  
  if (!category_id || !name || !price) {
    return res.status(400).json({ 
      error: 'La categoría, nombre y precio son obligatorios'
    });
  }
  
  try {
    const result = await pool.query(
      `UPDATE products 
       SET category_id = $1, name = $2, description = $3, price = $4, stock = $5, updated_at = NOW() 
       WHERE id = $6 
       RETURNING *`,
      [category_id, name, description, price, stock || 0, productId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }
    
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error al actualizar producto:', err);
    res.status(500).json({ error: 'Error al actualizar el producto' });
  }
});

// Eliminar un producto
app.delete('/api/products/:id', async (req, res) => {
  const productId = req.params.id;
  
  try {
    const result = await pool.query('DELETE FROM products WHERE id = $1 RETURNING *', [productId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }
    
    res.json({ success: true, message: 'Producto eliminado correctamente' });
  } catch (err) {
    console.error('Error al eliminar producto:', err);
    res.status(500).json({ error: 'Error al eliminar el producto' });
  }
});

// Rutas para servir las páginas
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, '/admin.html'));
});

// Arrancar servidor
const PORT = process.env.PORT || 4242;
app.listen(PORT, () => {
  console.log(`Servidor escuchando en puerto ${PORT}`);
  console.log(`Panel de administración disponible en http://localhost:${PORT}/admin`);
});