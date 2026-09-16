const fs=require('fs');
const path=require('path');
const root=__dirname;
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const ts=read('index.ts'), app=read('app.js'), cp=read('cpanel.js'), html=read('cpanel.html'), web=read('index.html'), sql=read('SQL_ACTUALIZACION_R9_18_7_SEGUIMIENTO_REPORTES.sql');
const checks=[
  ['version backend',ts.includes('R9.18.7-SEGUIMIENTO-REPORTES-TIEMPO-REAL')],
  ['tracking public endpoint',ts.includes('action==="trackorder"')&&ts.includes('publicTrackOrder')],
  ['tracking privacy verification',ts.includes('verify_phone')&&ts.includes('needs_verification')],
  ['secure tracking token',ts.includes('trackingTokenForOrder')&&ts.includes('ALE_ATENCIO_TRACK_V1')],
  ['customer pdf endpoint',ts.includes('action==="publicorderpdf"')&&ts.includes('publicGenerateOrderPdf')],
  ['order history',ts.includes('pedido_estado_historial')&&ts.includes('appendOrderHistory')],
  ['live paid sales report',ts.includes('action==="salesreport"')&&ts.includes('.eq("estado_pago","PAGADO")')],
  ['business timezone',ts.includes('America/Santiago')],
  ['payment bell',cp.includes('PAGO CONFIRMADO')&&cp.includes('addIncomingNotification("payment"')],
  ['automatic watcher',cp.includes('setInterval(pollNotifications,5000)')],
  ['top 1/10/20/50',html.includes('value="1"')&&html.includes('value="10"')&&html.includes('value="20"')&&html.includes('value="50"')],
  ['circular comparisons',html.includes('reportYearCircle')&&html.includes('reportMonthCircle')],
  ['customer tracking page',web.includes('Consulta tu pedido')&&app.includes('trackingView')],
  ['customer pdf UI',web.includes('orderSuccessPdfGenerate')],
  ['migration tracking hash',sql.includes('tracking_token_hash')],
  ['migration history',sql.includes('pedido_estado_historial')],
];
let failed=0;
for(const [name,ok] of checks){console.log(`${ok?'OK':'FAIL'} - ${name}`);if(!ok)failed++;}
if(failed){console.error(`\n${failed} check(s) failed`);process.exit(1)}
console.log(`\n${checks.length} checks passed`);
