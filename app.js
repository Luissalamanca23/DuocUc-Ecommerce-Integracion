// Configuración y variables globales
const apiUrls = {
    fakestoreapi: 'https://fakestoreapi.com/products',
    dummyjson: 'https://dummyjson.com/products'
};

// Estado del carrito
let cart = [];
let currentFilter = 'all';
let allProducts = [];
let isLoading = true;

// Elementos del DOM
const productsContainer = document.getElementById('products-container');
const loadingElement = document.getElementById('loading');
const cartCountElement = document.getElementById('cart-count');
const cartBtn = document.getElementById('cart-btn');
const cartModal = document.getElementById('cart-modal');
const cartItemsContainer = document.getElementById('cart-items');
const cartSubtotalElement = document.getElementById('cart-subtotal');
const cartTotalElement = document.getElementById('cart-total');
const checkoutBtn = document.getElementById('checkout-btn');
const productDetailModal = document.getElementById('product-detail-modal');
const productDetailContainer = document.getElementById('product-detail');
const closeButtons = document.querySelectorAll('.close');
const filterButtons = document.querySelectorAll('.filter-btn');

// Inicialización
document.addEventListener('DOMContentLoaded', () => {
    // Cargar productos
    loadProducts();
    
    // Configurar eventos
    setupEventListeners();
    
    // Restaurar el carrito desde localStorage si existe
    const savedCart = localStorage.getItem('cart');
    if (savedCart) {
        cart = JSON.parse(savedCart);
        updateCartCount();
    }
});

// Función para cargar productos de las APIs
async function loadProducts() {
    isLoading = true;
    showLoading(true);
    allProducts = [];
    
    try {
        // Cargar productos de Fake Store API
        const fakeStoreResponse = await fetch(apiUrls.fakestoreapi);
        const fakeStoreProducts = await fakeStoreResponse.json();
        
        // Procesar productos de Fake Store API
        const processedFakeStoreProducts = fakeStoreProducts.map(product => ({
            id: 'fakestoreapi_' + product.id,
            title: product.title,
            price: product.price,
            description: product.description,
            category: product.category,
            image: product.image,
            rating: product.rating,
            source: 'fakestoreapi'
        }));
        
        // Cargar productos de DummyJSON
        const dummyJsonResponse = await fetch(apiUrls.dummyjson);
        const dummyJsonData = await dummyJsonResponse.json();
        
        // Procesar productos de DummyJSON
        const processedDummyJsonProducts = dummyJsonData.products.map(product => ({
            id: 'dummyjson_' + product.id,
            title: product.title,
            price: product.price,
            description: product.description,
            category: product.category,
            image: product.thumbnail || product.images[0],
            rating: {
                rate: product.rating,
                count: product.stock
            },
            source: 'dummyjson'
        }));
        
        // Combinar todos los productos
        allProducts = [...processedFakeStoreProducts, ...processedDummyJsonProducts];
        
        // Renderizar productos
        renderProducts();
    } catch (error) {
        console.error('Error cargando productos:', error);
        productsContainer.innerHTML = `
            <div class="error-message">
                <p>Lo sentimos, hubo un error al cargar los productos. Por favor, intenta de nuevo más tarde.</p>
                <button onclick="loadProducts()">Reintentar</button>
            </div>
        `;
    } finally {
        isLoading = false;
        showLoading(false);
    }
}

// Mostrar u ocultar el indicador de carga
function showLoading(show) {
    loadingElement.style.display = show ? 'flex' : 'none';
    productsContainer.style.display = show ? 'none' : 'grid';
}

// Renderizar productos según el filtro actual
function renderProducts() {
    // Filtrar productos según la selección
    const productsToShow = currentFilter === 'all' 
        ? allProducts 
        : allProducts.filter(product => product.source === currentFilter);
    
    // Vaciar el contenedor
    productsContainer.innerHTML = '';
    
    if (productsToShow.length === 0) {
        productsContainer.innerHTML = '<p class="no-products">No se encontraron productos.</p>';
        return;
    }
    
    // Generar el HTML para cada producto
    productsToShow.forEach(product => {
        const productCard = createProductCard(product);
        productsContainer.appendChild(productCard);
    });
}

// Crear una tarjeta de producto
function createProductCard(product) {
    const productElement = document.createElement('div');
    productElement.className = 'product-card';
    productElement.dataset.id = product.id;
    
    // Crear estrellas para la calificación
    const rating = product.rating.rate || product.rating;
    const starCount = Math.round(rating);
    let starsHTML = '';
    
    for (let i = 0; i < 5; i++) {
        if (i < starCount) {
            starsHTML += '<i class="fas fa-star"></i>';
        } else {
            starsHTML += '<i class="far fa-star"></i>';
        }
    }
    
    // Formatear el precio
    const formattedPrice = formatPrice(product.price);
    
    // Establecer la estructura HTML
    productElement.innerHTML = `
        <span class="source-badge">${product.source === 'fakestoreapi' ? 'Tienda 1' : 'Tienda 2'}</span>
        <img src="${product.image}" alt="${product.title}" class="product-image">
        <div class="product-info">
            <h3>${product.title}</h3>
            <div class="product-price">${formattedPrice}</div>
            <div class="product-rating">
                <span class="stars">${starsHTML}</span>
                <span class="count">(${product.rating.count || 'N/A'})</span>
            </div>
            <div class="product-actions">
                <button class="quick-view" data-id="${product.id}">
                    <i class="fas fa-eye"></i>
                </button>
                <button class="add-to-cart" data-id="${product.id}">
                    Añadir al carrito
                </button>
            </div>
        </div>
    `;
    
    return productElement;
}

// Formatear el precio
function formatPrice(price) {
    return '€' + price.toFixed(2);
}

// Añadir un producto al carrito
function addToCart(productId) {
    const product = allProducts.find(p => p.id === productId);
    
    if (!product) {
        console.error('Producto no encontrado:', productId);
        return;
    }
    
    // Verificar si el producto ya está en el carrito
    const existingItemIndex = cart.findIndex(item => item.id === productId);
    
    if (existingItemIndex >= 0) {
        // Si ya existe, incrementar la cantidad
        cart[existingItemIndex].quantity += 1;
    } else {
        // Si no existe, añadirlo con cantidad 1
        cart.push({
            ...product,
            quantity: 1
        });
    }
    
    // Actualizar el contador del carrito
    updateCartCount();
    
    // Guardar el carrito en localStorage
    saveCart();
    
    // Mostrar notificación
    showNotification(`¡${product.title} añadido al carrito!`);
}

// Actualizar el contador del carrito
function updateCartCount() {
    const totalItems = cart.reduce((total, item) => total + item.quantity, 0);
    cartCountElement.textContent = totalItems;
}

// Guardar el carrito en localStorage
function saveCart() {
    localStorage.setItem('cart', JSON.stringify(cart));
}

// Mostrar notificación
function showNotification(message) {
    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    // Añadir clase para mostrar la notificación con animación
    setTimeout(() => notification.classList.add('show'), 10);
    
    // Eliminar la notificación después de 3 segundos
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Renderizar el contenido del carrito
function renderCart() {
    // Vaciar el contenedor
    cartItemsContainer.innerHTML = '';
    
    if (cart.length === 0) {
        cartItemsContainer.innerHTML = '<div class="empty-cart">Tu carrito está vacío</div>';
        cartSubtotalElement.textContent = formatPrice(0);
        cartTotalElement.textContent = formatPrice(0);
        return;
    }
    
    // Calcular el subtotal
    let subtotal = 0;
    
    // Generar HTML para cada elemento del carrito
    cart.forEach(item => {
        const itemTotal = item.price * item.quantity;
        subtotal += itemTotal;
        
        const cartItem = document.createElement('div');
        cartItem.className = 'cart-item';
        cartItem.innerHTML = `
            <img src="${item.image}" alt="${item.title}" class="cart-item-image">
            <div class="cart-item-details">
                <div class="cart-item-title">${item.title}</div>
                <div class="cart-item-price">${formatPrice(item.price)}</div>
            </div>
            <div class="cart-item-quantity">
                <button class="decrease-quantity" data-id="${item.id}">-</button>
                <span>${item.quantity}</span>
                <button class="increase-quantity" data-id="${item.id}">+</button>
            </div>
            <button class="remove-item" data-id="${item.id}">
                <i class="fas fa-trash"></i>
            </button>
        `;
        
        cartItemsContainer.appendChild(cartItem);
    });
    
    // Actualizar los totales
    const total = subtotal; // Si hubiera impuestos o envío, se sumarían aquí
    
    cartSubtotalElement.textContent = formatPrice(subtotal);
    cartTotalElement.textContent = formatPrice(total);
    
    // Configurar eventos para los botones del carrito
    setupCartItemEvents();
}

// Configurar eventos para los elementos del carrito
function setupCartItemEvents() {
    // Aumentar cantidad
    const increaseButtons = document.querySelectorAll('.increase-quantity');
    increaseButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            const productId = e.target.dataset.id;
            increaseQuantity(productId);
        });
    });
    
    // Disminuir cantidad
    const decreaseButtons = document.querySelectorAll('.decrease-quantity');
    decreaseButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            const productId = e.target.dataset.id;
            decreaseQuantity(productId);
        });
    });
    
    // Eliminar del carrito
    const removeButtons = document.querySelectorAll('.remove-item');
    removeButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            const productId = e.target.closest('.remove-item').dataset.id;
            removeFromCart(productId);
        });
    });
}

// Aumentar la cantidad de un producto en el carrito
function increaseQuantity(productId) {
    const itemIndex = cart.findIndex(item => item.id === productId);
    
    if (itemIndex >= 0) {
        cart[itemIndex].quantity += 1;
        updateCartCount();
        saveCart();
        renderCart();
    }
}

// Disminuir la cantidad de un producto en el carrito
function decreaseQuantity(productId) {
    const itemIndex = cart.findIndex(item => item.id === productId);
    
    if (itemIndex >= 0) {
        if (cart[itemIndex].quantity > 1) {
            cart[itemIndex].quantity -= 1;
        } else {
            // Si la cantidad es 1, eliminar del carrito
            removeFromCart(productId);
            return;
        }
        
        updateCartCount();
        saveCart();
        renderCart();
    }
}

// Eliminar un producto del carrito
function removeFromCart(productId) {
    cart = cart.filter(item => item.id !== productId);
    updateCartCount();
    saveCart();
    renderCart();
}

// Mostrar el detalle de un producto
function showProductDetail(productId) {
    const product = allProducts.find(p => p.id === productId);
    
    if (!product) {
        console.error('Producto no encontrado:', productId);
        return;
    }
    
    // Crear estrellas para la calificación
    const rating = product.rating.rate || product.rating;
    const starCount = Math.round(rating);
    let starsHTML = '';
    
    for (let i = 0; i < 5; i++) {
        if (i < starCount) {
            starsHTML += '<i class="fas fa-star"></i>';
        } else {
            starsHTML += '<i class="far fa-star"></i>';
        }
    }
    
    // Generar HTML para el detalle del producto
    productDetailContainer.innerHTML = `
        <div class="product-detail-grid">
            <div class="product-detail-image">
                <img src="${product.image}" alt="${product.title}">
            </div>
            <div class="product-detail-info">
                <h3>${product.title}</h3>
                <div class="product-detail-price">${formatPrice(product.price)}</div>
                <div class="product-detail-rating">
                    <span class="stars">${starsHTML}</span>
                    <span class="count">(${product.rating.count || 'N/A'} reseñas)</span>
                </div>
                <div class="product-detail-category">${product.category}</div>
                <div class="product-detail-description">${product.description}</div>
                <div class="product-detail-actions">
                    <button class="product-detail-add-to-cart" data-id="${product.id}">
                        Añadir al carrito
                    </button>
                </div>
            </div>
        </div>
    `;
    
    // Mostrar el modal
    productDetailModal.style.display = 'block';
    
    // Configurar evento para el botón "Añadir al carrito"
    const addToCartBtn = productDetailContainer.querySelector('.product-detail-add-to-cart');
    addToCartBtn.addEventListener('click', () => {
        addToCart(product.id);
    });
}

// Configurar todos los eventos
function setupEventListeners() {
    // Botones de filtro
    filterButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            // Remover clase activa de todos los botones
            filterButtons.forEach(btn => btn.classList.remove('active'));
            
            // Añadir clase activa al botón seleccionado
            e.target.classList.add('active');
            
            // Actualizar filtro y renderizar productos
            currentFilter = e.target.dataset.source;
            renderProducts();
        });
    });
    
    // Delegación de eventos para los botones de producto
    productsContainer.addEventListener('click', (e) => {
        // Botón "Añadir al carrito"
        if (e.target.classList.contains('add-to-cart')) {
            const productId = e.target.dataset.id;
            addToCart(productId);
        }
        // Botón "Vista rápida"
        else if (e.target.classList.contains('quick-view') || e.target.closest('.quick-view')) {
            const productId = e.target.dataset.id || e.target.closest('.quick-view').dataset.id;
            showProductDetail(productId);
        }
    });
    
    // Abrir modal del carrito
    cartBtn.addEventListener('click', () => {
        renderCart();
        cartModal.style.display = 'block';
    });
    
    // Cerrar modales
    closeButtons.forEach(button => {
        button.addEventListener('click', () => {
            cartModal.style.display = 'none';
            productDetailModal.style.display = 'none';
        });
    });
    
    // Cerrar modales al hacer clic fuera
    window.addEventListener('click', (e) => {
        if (e.target === cartModal) {
            cartModal.style.display = 'none';
        }
        if (e.target === productDetailModal) {
            productDetailModal.style.display = 'none';
        }
    });
    
    // Botón de checkout
    checkoutBtn.addEventListener('click', () => {
        if (cart.length > 0) {
            alert('¡Gracias por tu compra! Este es un sitio de demostración, así que no se procesará ningún pago real.');
            cart = [];
            updateCartCount();
            saveCart();
            cartModal.style.display = 'none';
        }
    });
}

// Añadir estilos para notificaciones
const notificationStyle = document.createElement('style');
notificationStyle.innerHTML = `
    .notification {
        position: fixed;
        bottom: 20px;
        right: 20px;
        background-color: #4a6cf7;
        color: white;
        padding: 15px 20px;
        border-radius: 5px;
        box-shadow: 0 3px 10px rgba(0, 0, 0, 0.2);
        z-index: 1000;
        transform: translateY(100px);
        opacity: 0;
        transition: transform 0.3s ease, opacity 0.3s ease;
    }
    
    .notification.show {
        transform: translateY(0);
        opacity: 1;
    }
`;
document.head.appendChild(notificationStyle);