const fs=require('fs');
function read(f){return fs.readFileSync(f,'utf8')}
function ok(cond,msg){if(!cond)throw new Error('FALLO: '+msg);console.log('[OK]',msg)}
const app=read('app.js'),cp=read('cpanel.js'),web=read('index.html'),admin=read('cpanel.html'),api=read('index.ts'),sql=read('SQL_ACTUALIZACION_R9_17_0_TRANSBANK_INTEGRACIONES.sql');
ok(web.includes('id="transbankCartBtn"'),'Botón Transbank existe en carrito');
ok(app.includes('openCheckout("TRANSBANK")'),'Botón del carrito inicia flujo Transbank');
ok(app.includes('window.location.assign(payUrl)'),'Pedido confirmado redirige al Link de Pago');
ok(app.includes('id="solicitud-formulario"') || app.includes('solicitud-formulario'),'Solicitud tiene ancla de posicionamiento directo');
ok(app.includes('focusRequestForm'),'Solicitud aplica posicionamiento automático');
ok(admin.includes('data-view="integrations"'),'cPanel incorpora módulo Integraciones');
ok(admin.includes('data-view="payments"'),'cPanel incorpora módulo Pasarela de pago');
ok(admin.includes('id="pTransbankUrl"'),'cPanel tiene campo URL Transbank');
ok(cp.includes('enabled=!!url'),'Pegar URL activa Transbank automáticamente');
ok(cp.includes('integration_shopify_url') && cp.includes('integration_woocommerce_url') && cp.includes('integration_mercadolibre_url'),'Conectores ecommerce comunes están configurables');
ok(api.includes('transbank_payment_url') && api.includes('transbank_link_payment'),'Backend permite configuración Transbank y declara capacidad');
ok(api.includes('pedido_items') && api.includes('order_pdf') && api.includes('rut_cl'),'Regresión R9.16: detalle de pedidos, PDF y RUT se conservan');
ok(sql.includes("('transbank_enabled','NO')") && sql.includes("('transbank_payment_url','')"),'SQL crea claves Transbank de forma idempotente');
console.log('R9.17.0 TESTS OK');
