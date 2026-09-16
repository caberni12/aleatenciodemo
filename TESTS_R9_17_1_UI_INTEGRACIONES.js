const fs=require('fs');
const path=require('path');
const root=__dirname;
const html=fs.readFileSync(path.join(root,'cpanel.html'),'utf8');
const css=fs.readFileSync(path.join(root,'cpanel.css'),'utf8');
function ok(cond,msg){if(!cond){console.error('[FAIL]',msg);process.exitCode=1}else console.log('[OK]',msg)}
ok(html.includes('20260916-r9171-ui-integraciones'),'Cache-busting R9.17.1 aplicado');
ok(html.includes('id="view-integrations"'),'Vista Integraciones presente');
ok(html.includes('id="view-payments"'),'Vista Pasarela de pago presente');
ok(css.includes('R9.17.1 · PULIDO VISUAL PREMIUM'),'Bloque CSS R9.17.1 presente');
ok(css.includes('.integration-toggle input:checked'),'Switch activo estilizado');
ok(css.includes('#view-integrations .integration-card .field-group input[type="url"]'),'Inputs URL con estilo dedicado');
ok(css.includes('.integration-card:has(.integration-toggle input:checked)'),'Estado visual de tarjeta activa');
ok(css.includes('@media(max-width:440px)'),'Responsive móvil pequeño presente');
ok(css.includes('.payment-provider-card'),'Estilo Transbank conservado/refinado');
if(!process.exitCode) console.log('UI TESTS R9.17.1: OK');
