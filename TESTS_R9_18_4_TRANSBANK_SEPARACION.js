const fs=require('fs');
const h=fs.readFileSync('cpanel.html','utf8');
const j=fs.readFileSync('cpanel.js','utf8');
const t=fs.readFileSync('index.ts','utf8');
const a=fs.readFileSync('app.js','utf8');
function ok(c,m){if(!c)throw new Error(m);console.log('OK',m)}
ok(h.includes('pTransbankManualUrl'),'cPanel expone Link Webpay manual separado');
ok(h.includes('no participa'),'UI explica separación del flujo manual');
ok(j.includes('transbank_payment_url:manualUrl'),'cPanel guarda link manual en clave separada');
ok(j.includes('safeTransbankStorefrontUrl'),'cPanel valida dominios del comercio');
ok(j.includes('if(isTransbankHost(legacyHost))'),'cPanel migra visualmente el antiguo link puesto como retorno');
ok(t.includes('isTransbankPublicHost'),'backend identifica hosts Transbank');
ok(t.includes('transbankManualPaymentUrl'),'backend valida link manual oficial');
ok(t.includes('transbankRemoteCreate') && a.includes('transbankcreate'),'Webpay Plus REST permanece activo');
ok(!a.includes('transbank_payment_url'),'app del carrito no usa link manual');
console.log('R9.18.4 PASS');
