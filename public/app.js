const AUTH = { text: 'Requiere token', cls: '' };
const PUBLIC = { text: 'Público', cls: 'public' };

const modules = [
  {
    name: 'Auth', base: '/api/auth',
    endpoints: [
      { m: 'POST', p: '/login', d: 'Inicia sesión y devuelve el JWT', auth: PUBLIC },
      { m: 'POST', p: '/recovery', d: 'Solicita recuperación de contraseña', auth: PUBLIC },
      { m: 'GET', p: '/me', d: 'Devuelve el usuario autenticado', auth: AUTH },
    ]
  },
  {
    name: 'Productos', base: '/api/productos',
    endpoints: [
      { m: 'GET', p: '/', d: 'Lista los productos', auth: AUTH },
      { m: 'POST', p: '/', d: 'Crea un producto', auth: AUTH },
      { m: 'PUT', p: '/:id', d: 'Actualiza un producto', auth: AUTH },
      { m: 'DELETE', p: '/:id', d: 'Elimina un producto', auth: AUTH },
    ]
  },
  {
    name: 'Categorías', base: '/api/categorias',
    endpoints: [
      { m: 'GET', p: '/', d: 'Lista las categorías', auth: AUTH },
      { m: 'POST', p: '/', d: 'Crea una categoría', auth: AUTH },
      { m: 'PUT', p: '/:id', d: 'Actualiza una categoría', auth: AUTH },
      { m: 'DELETE', p: '/:id', d: 'Elimina una categoría', auth: AUTH },
    ]
  },
  {
    name: 'Inventario', base: '/api/inventario',
    endpoints: [
      { m: 'GET', p: '/movimientos', d: 'Lista movimientos de inventario', auth: AUTH },
      { m: 'POST', p: '/movimientos', d: 'Registra un movimiento (entrada/salida)', auth: AUTH },
      { m: 'GET', p: '/stock', d: 'Stock actual de todos los productos', auth: AUTH },
      { m: 'GET', p: '/stock/page', d: 'Stock actual paginado', auth: AUTH },
      { m: 'GET', p: '/stock/bajo', d: 'Cantidad de productos con stock bajo', auth: AUTH },
    ]
  },
  {
    name: 'Ventas', base: '/api/ventas',
    endpoints: [
      { m: 'GET', p: '/', d: 'Lista las ventas', auth: AUTH },
      { m: 'GET', p: '/:id', d: 'Detalle de una venta', auth: AUTH },
      { m: 'POST', p: '/', d: 'Registra una venta', auth: AUTH },
      { m: 'PATCH', p: '/:id/cancelar', d: 'Cancela una venta', auth: AUTH },
    ]
  },
  {
    name: 'Caja', base: '/api/caja',
    endpoints: [
      { m: 'GET', p: '/actual', d: 'Estado de la caja abierta actualmente', auth: AUTH },
      { m: 'GET', p: '/:id/resumen', d: 'Resumen de un corte de caja', auth: AUTH },
      { m: 'POST', p: '/abrir', d: 'Abre la caja', auth: AUTH },
      { m: 'POST', p: '/cerrar/:id', d: 'Cierra la caja', auth: AUTH },
      { m: 'GET', p: '/cortes', d: 'Lista los cortes de caja', auth: AUTH },
      { m: 'POST', p: '/cortes/:id/recalcular', d: 'Recalcula un corte de caja', auth: AUTH },
    ]
  },
  {
    name: 'Clientes', base: '/api/clientes',
    endpoints: [
      { m: 'GET', p: '/pos', d: 'Clientes para el punto de venta', auth: AUTH },
      { m: 'GET', p: '/', d: 'Lista los clientes', auth: AUTH },
      { m: 'POST', p: '/', d: 'Crea un cliente', auth: AUTH },
      { m: 'PUT', p: '/:id', d: 'Actualiza un cliente', auth: AUTH },
      { m: 'DELETE', p: '/:id', d: 'Elimina un cliente', auth: AUTH },
      { m: 'GET', p: '/:id/deudas', d: 'Deudas de un cliente', auth: AUTH },
    ]
  },
  {
    name: 'Créditos', base: '/api/creditos',
    endpoints: [
      { m: 'GET', p: '/deuda-clientes', d: 'Clientes con deuda activa', auth: AUTH },
      { m: 'POST', p: '/pagar-cliente', d: 'Registra el pago de un cliente', auth: AUTH },
      { m: 'GET', p: '/', d: 'Lista los créditos', auth: AUTH },
      { m: 'POST', p: '/', d: 'Crea un crédito', auth: AUTH },
      { m: 'PUT', p: '/:id', d: 'Actualiza un crédito', auth: AUTH },
      { m: 'GET', p: '/:id/abonos', d: 'Lista los abonos de un crédito', auth: AUTH },
      { m: 'POST', p: '/:id/abonos', d: 'Registra un abono', auth: AUTH },
    ]
  },
  {
    name: 'Proveedores', base: '/api/proveedores',
    endpoints: [
      { m: 'GET', p: '/semana', d: 'Proveedores agendados esta semana', auth: AUTH },
      { m: 'PATCH', p: '/pedidos/:pedidoId', d: 'Actualiza un pedido a proveedor', auth: AUTH },
      { m: 'GET', p: '/', d: 'Lista los proveedores', auth: AUTH },
      { m: 'POST', p: '/', d: 'Crea un proveedor', auth: AUTH },
      { m: 'PUT', p: '/:id', d: 'Actualiza un proveedor', auth: AUTH },
      { m: 'DELETE', p: '/:id', d: 'Elimina un proveedor', auth: AUTH },
      { m: 'GET', p: '/:id/pagos', d: 'Pagos hechos a un proveedor', auth: AUTH },
      { m: 'POST', p: '/:id/pagos', d: 'Registra un pago a proveedor', auth: AUTH },
      { m: 'GET', p: '/:id/pedidos', d: 'Pedidos hechos a un proveedor', auth: AUTH },
      { m: 'POST', p: '/:id/pedidos', d: 'Crea un pedido a proveedor', auth: AUTH },
    ]
  },
  {
    name: 'Usuarios', base: '/api/usuarios',
    endpoints: [
      { m: 'GET', p: '/roles', d: 'Lista los roles disponibles', auth: AUTH },
      { m: 'GET', p: '/', d: 'Lista los usuarios', auth: AUTH },
      { m: 'POST', p: '/', d: 'Crea un usuario', auth: AUTH },
      { m: 'PUT', p: '/:id', d: 'Actualiza un usuario', auth: AUTH },
      { m: 'DELETE', p: '/:id', d: 'Elimina un usuario', auth: AUTH },
    ]
  },
  {
    name: 'Dashboard', base: '/api/dashboard',
    endpoints: [
      { m: 'GET', p: '/stats', d: 'Estadísticas generales del negocio', auth: AUTH },
      { m: 'GET', p: '/ultimas-ventas', d: 'Últimas ventas registradas', auth: AUTH },
    ]
  },
  {
    name: 'Configuración', base: '/api/configuracion',
    endpoints: [
      { m: 'GET', p: '/', d: 'Obtiene la configuración de la tienda', auth: AUTH },
      { m: 'PUT', p: '/', d: 'Actualiza la configuración de la tienda', auth: AUTH },
      { m: 'GET', p: '/tema', d: 'Obtiene el tema visual configurado', auth: AUTH },
      { m: 'PUT', p: '/tema', d: 'Actualiza el tema visual', auth: AUTH },
    ]
  },
  {
    name: 'Accesos', base: '/api/accesos',
    endpoints: [
      { m: 'GET', p: '/', d: 'Lista los permisos de acceso por rol', auth: AUTH },
      { m: 'PUT', p: '/', d: 'Actualiza los permisos de acceso', auth: AUTH },
    ]
  },
  {
    name: 'Notas', base: '/api/notas',
    endpoints: [
      { m: 'GET', p: '/', d: 'Obtiene la nota guardada', auth: AUTH },
      { m: 'POST', p: '/', d: 'Crea una nota', auth: AUTH },
      { m: 'PUT', p: '/:id', d: 'Actualiza una nota', auth: AUTH },
    ]
  },
  {
    name: 'Mercado Pago', base: '/api/mercadopago',
    endpoints: [
      { m: 'POST', p: '/pago', d: 'Crea un intento de pago', auth: AUTH },
      { m: 'GET', p: '/pago/:intentId', d: 'Consulta el estado de un intento de pago', auth: AUTH },
      { m: 'DELETE', p: '/pago/:intentId', d: 'Cancela un intento de pago', auth: AUTH },
    ]
  },
  {
    name: 'Webhooks y sistema', base: '',
    endpoints: [
      { m: 'POST', p: '/webhooks/mercadopago', d: 'Recibe notificaciones de Mercado Pago (sin token, llamado por MP)', auth: PUBLIC },
      { m: 'GET', p: '/health', d: 'Chequeo de salud del servidor', auth: PUBLIC },
    ]
  },
];

const container = document.getElementById('modules');
modules.forEach((mod, i) => {
  const details = document.createElement('details');
  details.className = 'module';
  if (i === 0) details.open = true;
  const summary = document.createElement('summary');
  summary.innerHTML = `<span>${mod.name}</span><span class="base">${mod.base}</span>`;
  details.appendChild(summary);
  mod.endpoints.forEach(ep => {
    const row = document.createElement('div');
    row.className = 'endpoint';
    row.innerHTML = `
      <span class="method ${ep.m}">${ep.m}</span>
      <span class="path">${mod.base}${ep.p}</span>
      <span class="auth ${ep.auth.cls}">${ep.auth.text}</span>
    `;
    details.appendChild(row);
    const desc = document.createElement('div');
    desc.className = 'desc';
    desc.textContent = ep.d;
    details.appendChild(desc);
  });
  container.appendChild(details);
});

fetch('/health').then(r => r.json()).then(() => {
  document.getElementById('dot').classList.add('ok');
  document.getElementById('statusText').textContent = 'Servidor en línea';
}).catch(() => {
  document.getElementById('dot').classList.add('fail');
  document.getElementById('statusText').textContent = 'Servidor sin respuesta';
});
