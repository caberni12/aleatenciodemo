const fs=require('fs');
const path=require('path');
const root=__dirname;
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const ts=read('index.ts'), app=read('app.js'), cp=read('cpanel.html'), cpjs=read('cpanel.js'), sql=read('SQL_ACTUALIZACION_R9_18_0_TRANSBANK_WEBPAY_PLUS.sql');
const tests=[
 ['backend version',ts.includes('ALE-SUPABASE-R9.18.0-TRANSBANK-WEBPAY-PLUS')],
 ['production secret not exposed',ts.includes('TRANSBANK_API_KEY_SECRET')&&!app.includes('579B532A7440BB0C9079DED94D31EA1615BACEB56610332264630D42D0A36B1C')&&!cp.includes('579B532A7440BB0C9079DED94D31EA1615BACEB56610332264630D42D0A36B1C')&&!cp.includes('id="pTransbankSecret"')],
 ['commerce code only server',ts.includes('TRANSBANK_COMMERCE_CODE')&&!app.includes('TRANSBANK_COMMERCE_CODE')],
 ['official create endpoint',ts.includes('/rswebpaytransaction/api/webpay/v1.2/transactions')],
 ['integration host',ts.includes('https://webpay3gint.transbank.cl')],
 ['production host',ts.includes('https://webpay3g.transbank.cl')],
 ['create action',ts.includes('action==="transbankcreate"')&&ts.includes('transbankCreatePayment')],
 ['return handler',ts.includes('tbk_return')&&ts.includes('transbankReturn(req)')],
 ['commit validation',ts.includes('AUTHORIZED')&&ts.includes('response_code')&&ts.includes('validAmount')&&ts.includes('validOrder')],
 ['frontend POST token_ws',app.includes('form.method="POST"')&&app.includes('input.name="token_ws"')],
 ['frontend no external link payment',!app.includes('transbankPaymentUrl()')&&!cp.includes('URL oficial del Link de Pago')],
 ['cpanel only public return URL',cp.includes('id="pTransbankReturnUrl"')&&cp.includes('URL pública de tu tienda')],
 ['health endpoint',ts.includes('transbankhealth')&&cpjs.includes('refreshTransbankHealth')],
 ['payment tracking table',sql.includes('create table if not exists public.pagos_transbank')],
 ['order payment state',sql.includes('estado_pago')&&cpjs.includes('payment-status-badge')],
 ['checkout token protected',ts.includes('checkout_token_hash')&&ts.includes('TRANSBANK_TOKEN_PEDIDO_INVALIDO')],
];
let failed=0;for(const [name,ok] of tests){console.log(`${ok?'OK':'FAIL'}  ${name}`);if(!ok)failed++;}
if(failed){console.error(`\n${failed} test(s) failed`);process.exit(1)}
console.log(`\n${tests.length} tests OK`);
