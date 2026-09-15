const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const money = n => new Intl.NumberFormat("es-CL",{style:"currency",currency:"CLP",maximumFractionDigits:0}).format(Number(n||0));
const priceLabel = p => Number(p?.precio||0)>0 ? money(p.precio) : "Consultar";
const esc = s => String(s ?? "").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));
const normalizeText = value => String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es-CL").trim();
const productSearchText = p => normalizeText([p?.nombre,p?.descripcion,p?.categoria_nombre||p?.categoria,p?.ocasion].filter(Boolean).join(" "));
const MEDIA_VERSION = "20260915-r910-ecommerce";
const mediaUrl = value => {
  const u=String(value||"").trim();
  if(!u || /^(?:https?:|data:|blob:)/i.test(u)) return u;
  const sep=u.includes("?")?"&":"?";
  return `${u}${sep}v=${MEDIA_VERSION}`;
};

const seed = {"config":{"empresa":"Ale Atencio","whatsapp":"","instagram":"","facebook":"","tiktok":"","direccion":"","email":"","valor_despacho":"0","logo_url":"logo-ale-atencio.png"},"categories":[{"id":"C001","nombre":"Tortas","descripcion":"Tortas artesanales para celebraciones","drive_file_id":"","image_url":"producto-004-torta-pina-crema-y-cerezas.jpg","orden":1,"activo":"SI"},{"id":"C002","nombre":"Galletas","descripcion":"Galletas, alfajores y masas artesanales","drive_file_id":"","image_url":"producto-006-surtido-de-masas-secas.jpg","orden":2,"activo":"SI"},{"id":"C003","nombre":"Dulcería","descripcion":"Calugas, vasitos y dulces especiales","drive_file_id":"","image_url":"producto-008-galletas-vienesas-banadas.jpg","orden":3,"activo":"SI"},{"id":"C004","nombre":"Postres","descripcion":"Cheesecakes, pies, tartas y postres","drive_file_id":"","image_url":"producto-026-tarta-nuez-espolvoreada.jpg","orden":4,"activo":"SI"},{"id":"C005","nombre":"Regalos","descripcion":"Selecciones personalizadas y detalles para regalar","drive_file_id":"","image_url":"producto-006-surtido-de-masas-secas.jpg","orden":5,"activo":"SI"}],"banners":[{"id":"B001","titulo":"Dulces momentos hechos para celebrar","subtitulo":"Descubre nuestro catálogo artesanal Ale Atencio.","cta_texto":"Ver catálogo","enlace":"#productos/todos","drive_file_id":"","image_url":"producto-001-torta-chocolate-ganache.jpg","activo":"SI","orden":1},{"id":"B002","titulo":"Tortas que hacen especial cada celebración","subtitulo":"Diseños y sabores preparados con dedicación para cada ocasión.","cta_texto":"Ver tortas","enlace":"#productos/tortas","drive_file_id":"","image_url":"producto-004-torta-pina-crema-y-cerezas.jpg","activo":"SI","orden":2},{"id":"B003","titulo":"Detalles dulces para compartir y regalar","subtitulo":"Galletas, surtidos y preparaciones artesanales para sorprender.","cta_texto":"Ver productos","enlace":"#productos/todos","drive_file_id":"","image_url":"producto-006-surtido-de-masas-secas.jpg","activo":"SI","orden":3}],"products":[{"id":"P001","nombre":"Torta Chocolate Ganache","descripcion":"Torta artesanal Ale Atencio, preparada con presentación cuidada para celebraciones y momentos especiales.","precio":0,"categoria_nombre":"Tortas","stock":0,"drive_file_id":"","image_url":"producto-001-torta-chocolate-ganache.jpg","destacado":"SI","activo":"SI","ocasion":"Celebraciones","orden":1,"fecha_actualizacion":""},{"id":"P002","nombre":"Torta Hojarasca Manjar","descripcion":"Torta artesanal Ale Atencio, preparada con presentación cuidada para celebraciones y momentos especiales.","precio":0,"categoria_nombre":"Tortas","stock":0,"drive_file_id":"","image_url":"producto-002-torta-hojarasca-manjar.jpg","destacado":"SI","activo":"SI","ocasion":"Celebraciones","orden":2,"fecha_actualizacion":""},{"id":"P003","nombre":"Torta Café Praliné","descripcion":"Torta artesanal Ale Atencio, preparada con presentación cuidada para celebraciones y momentos especiales.","precio":0,"categoria_nombre":"Tortas","stock":0,"drive_file_id":"","image_url":"producto-003-torta-cafe-praline.jpg","destacado":"NO","activo":"SI","ocasion":"Celebraciones","orden":3,"fecha_actualizacion":""},{"id":"P004","nombre":"Torta Piña, Crema y Cerezas","descripcion":"Torta artesanal Ale Atencio, preparada con presentación cuidada para celebraciones y momentos especiales.","precio":0,"categoria_nombre":"Tortas","stock":0,"drive_file_id":"","image_url":"producto-004-torta-pina-crema-y-cerezas.jpg","destacado":"SI","activo":"SI","ocasion":"Celebraciones","orden":4,"fecha_actualizacion":""},{"id":"P005","nombre":"Torta Hojarasca Frambuesa","descripcion":"Torta artesanal Ale Atencio, preparada con presentación cuidada para celebraciones y momentos especiales.","precio":0,"categoria_nombre":"Tortas","stock":0,"drive_file_id":"","image_url":"producto-005-torta-hojarasca-frambuesa.jpg","destacado":"SI","activo":"SI","ocasion":"Celebraciones","orden":5,"fecha_actualizacion":""},{"id":"P006","nombre":"Surtido de Masas Secas","descripcion":"Selección Ale Atencio pensada para regalar, compartir o personalizar.","precio":0,"categoria_nombre":"Regalos","stock":0,"drive_file_id":"","image_url":"producto-006-surtido-de-masas-secas.jpg","destacado":"SI","activo":"SI","ocasion":"Regalos","orden":6,"fecha_actualizacion":""},{"id":"P007","nombre":"Torta Hojarasca Frambuesa","descripcion":"Torta artesanal Ale Atencio, preparada con presentación cuidada para celebraciones y momentos especiales.","precio":0,"categoria_nombre":"Tortas","stock":0,"drive_file_id":"","image_url":"producto-007-torta-hojarasca-frambuesa.jpg","destacado":"NO","activo":"SI","ocasion":"Celebraciones","orden":7,"fecha_actualizacion":""},{"id":"P008","nombre":"Galletas Vienesas Bañadas","descripcion":"Elaboración artesanal Ale Atencio, ideal para compartir, acompañar o regalar.","precio":0,"categoria_nombre":"Galletas","stock":0,"drive_file_id":"","image_url":"producto-008-galletas-vienesas-banadas.jpg","destacado":"SI","activo":"SI","ocasion":"Todo momento","orden":8,"fecha_actualizacion":""},{"id":"P009","nombre":"Pie de Manzana Tradicional","descripcion":"Postre artesanal Ale Atencio con presentación cuidada y sabor casero.","precio":0,"categoria_nombre":"Postres","stock":0,"drive_file_id":"","image_url":"producto-009-pie-de-manzana-tradicional.jpg","destacado":"NO","activo":"SI","ocasion":"Todo momento","orden":9,"fecha_actualizacion":""},{"id":"P010","nombre":"Galletas Vienesas Mix","descripcion":"Elaboración artesanal Ale Atencio, ideal para compartir, acompañar o regalar.","precio":0,"categoria_nombre":"Galletas","stock":0,"drive_file_id":"","image_url":"producto-010-galletas-vienesas-mix.jpg","destacado":"NO","activo":"SI","ocasion":"Todo momento","orden":10,"fecha_actualizacion":""},{"id":"P011","nombre":"Torta Merengue Nuez","descripcion":"Torta artesanal Ale Atencio, preparada con presentación cuidada para celebraciones y momentos especiales.","precio":0,"categoria_nombre":"Tortas","stock":0,"drive_file_id":"","image_url":"producto-011-torta-merengue-nuez.jpg","destacado":"NO","activo":"SI","ocasion":"Celebraciones","orden":11,"fecha_actualizacion":""},{"id":"P012","nombre":"Cheesecake Frutilla Rústico","descripcion":"Postre artesanal Ale Atencio con presentación cuidada y sabor casero.","precio":0,"categoria_nombre":"Postres","stock":0,"drive_file_id":"","image_url":"producto-012-cheesecake-frutilla-rustico.jpg","destacado":"NO","activo":"SI","ocasion":"Todo momento","orden":12,"fecha_actualizacion":""},{"id":"P013","nombre":"Merenguitos Artesanales","descripcion":"Dulce artesanal Ale Atencio, elaborado con dedicación para disfrutar y compartir.","precio":0,"categoria_nombre":"Dulcería","stock":0,"drive_file_id":"","image_url":"producto-013-merenguitos-artesanales.jpg","destacado":"NO","activo":"SI","ocasion":"Todo momento","orden":13,"fecha_actualizacion":""},{"id":"P014","nombre":"Pie de Limón Merengado","descripcion":"Postre artesanal Ale Atencio con presentación cuidada y sabor casero.","precio":0,"categoria_nombre":"Postres","stock":0,"drive_file_id":"","image_url":"producto-014-pie-de-limon-merengado.jpg","destacado":"NO","activo":"SI","ocasion":"Todo momento","orden":14,"fecha_actualizacion":""},{"id":"P015","nombre":"Calugas de Rosa","descripcion":"Dulce artesanal Ale Atencio, elaborado con dedicación para disfrutar y compartir.","precio":0,"categoria_nombre":"Dulcería","stock":0,"drive_file_id":"","image_url":"producto-015-calugas-de-rosa.jpg","destacado":"NO","activo":"SI","ocasion":"Todo momento","orden":15,"fecha_actualizacion":""},{"id":"P016","nombre":"Calugas Pistacho","descripcion":"Dulce artesanal Ale Atencio, elaborado con dedicación para disfrutar y compartir.","precio":0,"categoria_nombre":"Dulcería","stock":0,"drive_file_id":"","image_url":"producto-016-calugas-pistacho.jpg","destacado":"NO","activo":"SI","ocasion":"Todo momento","orden":16,"fecha_actualizacion":""},{"id":"P017","nombre":"Brazo de Reina Frambuesa","descripcion":"Postre artesanal Ale Atencio con presentación cuidada y sabor casero.","precio":0,"categoria_nombre":"Postres","stock":0,"drive_file_id":"","image_url":"producto-017-brazo-de-reina-frambuesa.jpg","destacado":"NO","activo":"SI","ocasion":"Todo momento","orden":17,"fecha_actualizacion":""},{"id":"P018","nombre":"Surtido de Galletas Finas","descripcion":"Selección Ale Atencio pensada para regalar, compartir o personalizar.","precio":0,"categoria_nombre":"Regalos","stock":0,"drive_file_id":"","image_url":"producto-018-surtido-de-galletas-finas.jpg","destacado":"NO","activo":"SI","ocasion":"Regalos","orden":18,"fecha_actualizacion":""},{"id":"P019","nombre":"Torta Chocolate Ganache","descripcion":"Torta artesanal Ale Atencio, preparada con presentación cuidada para celebraciones y momentos especiales.","precio":0,"categoria_nombre":"Tortas","stock":0,"drive_file_id":"","image_url":"producto-019-torta-chocolate-ganache.jpg","destacado":"NO","activo":"SI","ocasion":"Celebraciones","orden":19,"fecha_actualizacion":""},{"id":"P020","nombre":"Cuadrado Frambuesa Crumble","descripcion":"Dulce artesanal Ale Atencio, elaborado con dedicación para disfrutar y compartir.","precio":0,"categoria_nombre":"Dulcería","stock":0,"drive_file_id":"","image_url":"producto-020-cuadrado-frambuesa-crumble.jpg","destacado":"NO","activo":"SI","ocasion":"Todo momento","orden":20,"fecha_actualizacion":""},{"id":"P021","nombre":"Canastitas Gourmet Frutos Secos","descripcion":"Dulce artesanal Ale Atencio, elaborado con dedicación para disfrutar y compartir.","precio":0,"categoria_nombre":"Dulcería","stock":0,"drive_file_id":"","image_url":"producto-021-canastitas-gourmet-frutos-secos.jpg","destacado":"NO","activo":"SI","ocasion":"Todo momento","orden":21,"fecha_actualizacion":""},{"id":"P022","nombre":"Milhojas Crocante Manjar","descripcion":"Dulce artesanal Ale Atencio, elaborado con dedicación para disfrutar y compartir.","precio":0,"categoria_nombre":"Dulcería","stock":0,"drive_file_id":"","image_url":"producto-022-milhojas-crocante-manjar.jpg","destacado":"NO","activo":"SI","ocasion":"Todo momento","orden":22,"fecha_actualizacion":""},{"id":"P023","nombre":"Alfajores y Trufas Surtidas","descripcion":"Elaboración artesanal Ale Atencio, ideal para compartir, acompañar o regalar.","precio":0,"categoria_nombre":"Galletas","stock":0,"drive_file_id":"","image_url":"producto-023-alfajores-y-trufas-surtidas.jpg","destacado":"NO","activo":"SI","ocasion":"Todo momento","orden":23,"fecha_actualizacion":""},{"id":"P024","nombre":"Cheesecake Frutilla Rústico","descripcion":"Postre artesanal Ale Atencio con presentación cuidada y sabor casero.","precio":0,"categoria_nombre":"Postres","stock":0,"drive_file_id":"","image_url":"producto-024-cheesecake-frutilla-rustico.jpg","destacado":"NO","activo":"SI","ocasion":"Todo momento","orden":24,"fecha_actualizacion":""},{"id":"P025","nombre":"Alfajores Maicena Artesanales","descripcion":"Elaboración artesanal Ale Atencio, ideal para compartir, acompañar o regalar.","precio":0,"categoria_nombre":"Galletas","stock":0,"drive_file_id":"","image_url":"producto-025-alfajores-maicena-artesanales.jpg","destacado":"NO","activo":"SI","ocasion":"Todo momento","orden":25,"fecha_actualizacion":""},{"id":"P026","nombre":"Tarta Nuez Espolvoreada","descripcion":"Postre artesanal Ale Atencio con presentación cuidada y sabor casero.","precio":0,"categoria_nombre":"Postres","stock":0,"drive_file_id":"","image_url":"producto-026-tarta-nuez-espolvoreada.jpg","destacado":"NO","activo":"SI","ocasion":"Todo momento","orden":26,"fecha_actualizacion":""},{"id":"P027","nombre":"Torta Durazno Chantilly","descripcion":"Torta artesanal Ale Atencio, preparada con presentación cuidada para celebraciones y momentos especiales.","precio":0,"categoria_nombre":"Tortas","stock":0,"drive_file_id":"","image_url":"producto-027-torta-durazno-chantilly.jpg","destacado":"NO","activo":"SI","ocasion":"Celebraciones","orden":27,"fecha_actualizacion":""},{"id":"P028","nombre":"Canastitas Dulces Gourmet","descripcion":"Dulce artesanal Ale Atencio, elaborado con dedicación para disfrutar y compartir.","precio":0,"categoria_nombre":"Dulcería","stock":0,"drive_file_id":"","image_url":"producto-028-canastitas-dulces-gourmet.jpg","destacado":"NO","activo":"SI","ocasion":"Todo momento","orden":28,"fecha_actualizacion":""},{"id":"P029","nombre":"Vasitos Mousse Maracuyá Frambuesa","descripcion":"Dulce artesanal Ale Atencio, elaborado con dedicación para disfrutar y compartir.","precio":0,"categoria_nombre":"Dulcería","stock":0,"drive_file_id":"","image_url":"producto-029-vasitos-mousse-maracuya-frambuesa.jpg","destacado":"NO","activo":"SI","ocasion":"Todo momento","orden":29,"fecha_actualizacion":""},{"id":"P030","nombre":"Vasitos Postre Maracuyá Frambuesa","descripcion":"Dulce artesanal Ale Atencio, elaborado con dedicación para disfrutar y compartir.","precio":0,"categoria_nombre":"Dulcería","stock":0,"drive_file_id":"","image_url":"producto-030-vasitos-postre-maracuya-frambuesa.jpg","destacado":"NO","activo":"SI","ocasion":"Todo momento","orden":30,"fecha_actualizacion":""},{"id":"P031","nombre":"Torta Rosas Blancas","descripcion":"Torta artesanal Ale Atencio, preparada con presentación cuidada para celebraciones y momentos especiales.","precio":0,"categoria_nombre":"Tortas","stock":0,"drive_file_id":"","image_url":"producto-001-torta-chocolate-ganache.jpg","destacado":"NO","activo":"SI","ocasion":"Celebraciones","orden":31,"fecha_actualizacion":""},{"id":"P032","nombre":"Rollos de Canela Glaseados","descripcion":"Postre artesanal Ale Atencio con presentación cuidada y sabor casero.","precio":0,"categoria_nombre":"Postres","stock":0,"drive_file_id":"","image_url":"producto-032-rollos-de-canela-glaseados.jpg","destacado":"NO","activo":"SI","ocasion":"Todo momento","orden":32,"fecha_actualizacion":""},{"id":"P033","nombre":"Rectángulo Hojarasca Manjar","descripcion":"Dulce artesanal Ale Atencio, elaborado con dedicación para disfrutar y compartir.","precio":0,"categoria_nombre":"Dulcería","stock":0,"drive_file_id":"","image_url":"producto-033-rectangulo-hojarasca-manjar.jpg","destacado":"NO","activo":"SI","ocasion":"Todo momento","orden":33,"fecha_actualizacion":""},{"id":"P034","nombre":"Galletas Navideñas Decoradas","descripcion":"Preparación artesanal Ale Atencio, ideal para compartir y regalar en temporada navideña.","precio":0,"categoria_nombre":"Regalos","stock":0,"drive_file_id":"","image_url":"producto-034-galletas-navidenas-decoradas.jpg","destacado":"NO","activo":"SI","ocasion":"Navidad","orden":34,"fecha_actualizacion":""},{"id":"P035","nombre":"Torta Frambuesa Crocante","descripcion":"Torta artesanal Ale Atencio, preparada con presentación cuidada para celebraciones y momentos especiales.","precio":0,"categoria_nombre":"Tortas","stock":0,"drive_file_id":"","image_url":"producto-035-torta-frambuesa-crocante.jpg","destacado":"NO","activo":"SI","ocasion":"Celebraciones","orden":35,"fecha_actualizacion":""},{"id":"P036","nombre":"Torta Chocolate Premium","descripcion":"Torta artesanal Ale Atencio, preparada con presentación cuidada para celebraciones y momentos especiales.","precio":0,"categoria_nombre":"Tortas","stock":0,"drive_file_id":"","image_url":"producto-036-torta-chocolate-premium.jpg","destacado":"NO","activo":"SI","ocasion":"Celebraciones","orden":36,"fecha_actualizacion":""},{"id":"P037","nombre":"Alfajores Maicena Artesanales","descripcion":"Elaboración artesanal Ale Atencio, ideal para compartir, acompañar o regalar.","precio":0,"categoria_nombre":"Galletas","stock":0,"drive_file_id":"","image_url":"producto-037-alfajores-maicena-artesanales.jpg","destacado":"NO","activo":"SI","ocasion":"Todo momento","orden":37,"fecha_actualizacion":""},{"id":"P038","nombre":"Torta Hojarasca Manjar","descripcion":"Torta artesanal Ale Atencio, preparada con presentación cuidada para celebraciones y momentos especiales.","precio":0,"categoria_nombre":"Tortas","stock":0,"drive_file_id":"","image_url":"producto-038-torta-hojarasca-manjar.jpg","destacado":"NO","activo":"SI","ocasion":"Celebraciones","orden":38,"fecha_actualizacion":""},{"id":"P039","nombre":"Empanaditas Dulces Surtidas","descripcion":"Dulce artesanal Ale Atencio, elaborado con dedicación para disfrutar y compartir.","precio":0,"categoria_nombre":"Dulcería","stock":0,"drive_file_id":"","image_url":"producto-039-empanaditas-dulces-surtidas.jpg","destacado":"NO","activo":"SI","ocasion":"Todo momento","orden":39,"fecha_actualizacion":""},{"id":"P040","nombre":"Torta Rosas y Chocolate","descripcion":"Torta artesanal Ale Atencio, preparada con presentación cuidada para celebraciones y momentos especiales.","precio":0,"categoria_nombre":"Tortas","stock":0,"drive_file_id":"","image_url":"producto-040-torta-rosas-y-chocolate.jpg","destacado":"NO","activo":"SI","ocasion":"Celebraciones","orden":40,"fecha_actualizacion":""},{"id":"P041","nombre":"Galleta Reno Decorada","descripcion":"Preparación artesanal Ale Atencio, ideal para compartir y regalar en temporada navideña.","precio":0,"categoria_nombre":"Galletas","stock":0,"drive_file_id":"","image_url":"producto-041-galleta-reno-decorada.jpg","destacado":"NO","activo":"SI","ocasion":"Navidad","orden":41,"fecha_actualizacion":""},{"id":"P042","nombre":"Torta Merengue Frambuesa","descripcion":"Torta artesanal Ale Atencio, preparada con presentación cuidada para celebraciones y momentos especiales.","precio":0,"categoria_nombre":"Tortas","stock":0,"drive_file_id":"","image_url":"producto-042-torta-merengue-frambuesa.jpg","destacado":"NO","activo":"SI","ocasion":"Celebraciones","orden":42,"fecha_actualizacion":""},{"id":"P043","nombre":"Surtido Ale Atencio","descripcion":"Selección Ale Atencio pensada para regalar, compartir o personalizar.","precio":0,"categoria_nombre":"Regalos","stock":0,"drive_file_id":"","image_url":"producto-006-surtido-de-masas-secas.jpg","destacado":"SI","activo":"SI","ocasion":"Regalos","orden":43,"fecha_actualizacion":""},{"id":"P044","nombre":"Rectángulo Hojarasca Manjar","descripcion":"Dulce artesanal Ale Atencio, elaborado con dedicación para disfrutar y compartir.","precio":0,"categoria_nombre":"Dulcería","stock":0,"drive_file_id":"","image_url":"producto-044-rectangulo-hojarasca-manjar.jpg","destacado":"NO","activo":"SI","ocasion":"Todo momento","orden":44,"fecha_actualizacion":""},{"id":"P045","nombre":"Empanada de Manzana Individual","descripcion":"Dulce artesanal Ale Atencio, elaborado con dedicación para disfrutar y compartir.","precio":0,"categoria_nombre":"Dulcería","stock":0,"drive_file_id":"","image_url":"producto-045-empanada-de-manzana-individual.jpg","destacado":"NO","activo":"SI","ocasion":"Todo momento","orden":45,"fecha_actualizacion":""},{"id":"P046","nombre":"Triángulo Hojarasca Manjar","descripcion":"Dulce artesanal Ale Atencio, elaborado con dedicación para disfrutar y compartir.","precio":0,"categoria_nombre":"Dulcería","stock":0,"drive_file_id":"","image_url":"producto-046-triangulo-hojarasca-manjar.jpg","destacado":"NO","activo":"SI","ocasion":"Todo momento","orden":46,"fecha_actualizacion":""},{"id":"P047","nombre":"Calugas Artesanales Pistacho","descripcion":"Dulce artesanal Ale Atencio, elaborado con dedicación para disfrutar y compartir.","precio":0,"categoria_nombre":"Dulcería","stock":0,"drive_file_id":"","image_url":"producto-008-galletas-vienesas-banadas.jpg","destacado":"NO","activo":"SI","ocasion":"Todo momento","orden":47,"fecha_actualizacion":""},{"id":"P048","nombre":"Brazo de Reina Merengado","descripcion":"Postre artesanal Ale Atencio con presentación cuidada y sabor casero.","precio":0,"categoria_nombre":"Postres","stock":0,"drive_file_id":"","image_url":"producto-048-brazo-de-reina-merengado.jpg","destacado":"NO","activo":"SI","ocasion":"Todo momento","orden":48,"fecha_actualizacion":""},{"id":"P049","nombre":"Torta Merengue Frambuesa","descripcion":"Torta artesanal Ale Atencio, preparada con presentación cuidada para celebraciones y momentos especiales.","precio":0,"categoria_nombre":"Tortas","stock":0,"drive_file_id":"","image_url":"producto-049-torta-merengue-frambuesa.jpg","destacado":"NO","activo":"SI","ocasion":"Celebraciones","orden":49,"fecha_actualizacion":""},{"id":"P050","nombre":"Cheesecake Frutilla","descripcion":"Postre artesanal Ale Atencio con presentación cuidada y sabor casero.","precio":0,"categoria_nombre":"Postres","stock":0,"drive_file_id":"","image_url":"producto-050-cheesecake-frutilla.jpg","destacado":"NO","activo":"SI","ocasion":"Todo momento","orden":50,"fecha_actualizacion":""},{"id":"P051","nombre":"Cheesecake Maracuyá","descripcion":"Postre artesanal Ale Atencio con presentación cuidada y sabor casero.","precio":0,"categoria_nombre":"Postres","stock":0,"drive_file_id":"","image_url":"producto-051-cheesecake-maracuya.jpg","destacado":"NO","activo":"SI","ocasion":"Todo momento","orden":51,"fecha_actualizacion":""},{"id":"P052","nombre":"Torta Piña, Crema y Cerezas","descripcion":"Torta artesanal Ale Atencio, preparada con presentación cuidada para celebraciones y momentos especiales.","precio":0,"categoria_nombre":"Tortas","stock":0,"drive_file_id":"","image_url":"producto-052-torta-pina-crema-y-cerezas.jpg","destacado":"NO","activo":"SI","ocasion":"Celebraciones","orden":52,"fecha_actualizacion":""},{"id":"P053","nombre":"Croissants de Mantequilla","descripcion":"Postre artesanal Ale Atencio con presentación cuidada y sabor casero.","precio":0,"categoria_nombre":"Postres","stock":0,"drive_file_id":"","image_url":"producto-053-croissants-de-mantequilla.jpg","destacado":"NO","activo":"SI","ocasion":"Todo momento","orden":53,"fecha_actualizacion":""},{"id":"P054","nombre":"Alfajores y Trufas Finas","descripcion":"Elaboración artesanal Ale Atencio, ideal para compartir, acompañar o regalar.","precio":0,"categoria_nombre":"Galletas","stock":0,"drive_file_id":"","image_url":"producto-054-alfajores-y-trufas-finas.jpg","destacado":"NO","activo":"SI","ocasion":"Todo momento","orden":54,"fecha_actualizacion":""},{"id":"P055","nombre":"Galletas Navideñas Envoltorio","descripcion":"Preparación artesanal Ale Atencio, ideal para compartir y regalar en temporada navideña.","precio":0,"categoria_nombre":"Regalos","stock":0,"drive_file_id":"","image_url":"producto-055-galletas-navidenas-envoltorio.jpg","destacado":"NO","activo":"SI","ocasion":"Navidad","orden":55,"fecha_actualizacion":""},{"id":"P056","nombre":"Surtido de Galletas Finas Ale Atencio","descripcion":"Selección Ale Atencio pensada para regalar, compartir o personalizar.","precio":0,"categoria_nombre":"Regalos","stock":0,"drive_file_id":"","image_url":"producto-056-surtido-de-galletas-finas-ale-atencio.jpg","destacado":"NO","activo":"SI","ocasion":"Regalos","orden":56,"fecha_actualizacion":""},{"id":"P057","nombre":"Torta Hojarasca Manjar Redonda","descripcion":"Torta artesanal Ale Atencio, preparada con presentación cuidada para celebraciones y momentos especiales.","precio":0,"categoria_nombre":"Tortas","stock":0,"drive_file_id":"","image_url":"producto-057-torta-hojarasca-manjar-redonda.jpg","destacado":"SI","activo":"SI","ocasion":"Celebraciones","orden":57,"fecha_actualizacion":""},{"id":"P058","nombre":"Torta Merengue Frambuesa Redonda","descripcion":"Torta artesanal Ale Atencio, preparada con presentación cuidada para celebraciones y momentos especiales.","precio":0,"categoria_nombre":"Tortas","stock":0,"drive_file_id":"","image_url":"producto-058-torta-merengue-frambuesa-redonda.jpg","destacado":"NO","activo":"SI","ocasion":"Celebraciones","orden":58,"fecha_actualizacion":""},{"id":"P059","nombre":"Rollos de Canela Caseros","descripcion":"Postre artesanal Ale Atencio con presentación cuidada y sabor casero.","precio":0,"categoria_nombre":"Postres","stock":0,"drive_file_id":"","image_url":"producto-059-rollos-de-canela-caseros.jpg","destacado":"NO","activo":"SI","ocasion":"Todo momento","orden":59,"fecha_actualizacion":""},{"id":"P060","nombre":"Alfajores Premium","descripcion":"Elaboración artesanal Ale Atencio, ideal para compartir, acompañar o regalar.","precio":0,"categoria_nombre":"Galletas","stock":0,"drive_file_id":"","image_url":"producto-060-alfajores-premium.jpg","destacado":"NO","activo":"SI","ocasion":"Todo momento","orden":60,"fecha_actualizacion":""},{"id":"P061","nombre":"Torta Merengue Nuez","descripcion":"Torta artesanal Ale Atencio, preparada con presentación cuidada para celebraciones y momentos especiales.","precio":0,"categoria_nombre":"Tortas","stock":0,"drive_file_id":"","image_url":"producto-061-torta-merengue-nuez.jpg","destacado":"NO","activo":"SI","ocasion":"Celebraciones","orden":61,"fecha_actualizacion":""},{"id":"P062","nombre":"Trufas y Alfajores Surtidos","descripcion":"Dulce artesanal Ale Atencio, elaborado con dedicación para disfrutar y compartir.","precio":0,"categoria_nombre":"Dulcería","stock":0,"drive_file_id":"","image_url":"producto-062-trufas-y-alfajores-surtidos.jpg","destacado":"NO","activo":"SI","ocasion":"Todo momento","orden":62,"fecha_actualizacion":""},{"id":"P063","nombre":"Cheesecake Frambuesa","descripcion":"Postre artesanal Ale Atencio con presentación cuidada y sabor casero.","precio":0,"categoria_nombre":"Postres","stock":0,"drive_file_id":"","image_url":"producto-063-cheesecake-frambuesa.jpg","destacado":"NO","activo":"SI","ocasion":"Todo momento","orden":63,"fecha_actualizacion":""},{"id":"P064","nombre":"Vasitos Mousse Gourmet","descripcion":"Dulce artesanal Ale Atencio, elaborado con dedicación para disfrutar y compartir.","precio":0,"categoria_nombre":"Dulcería","stock":0,"drive_file_id":"","image_url":"producto-064-vasitos-mousse-gourmet.jpg","destacado":"NO","activo":"SI","ocasion":"Todo momento","orden":64,"fecha_actualizacion":""},{"id":"P065","nombre":"Mini Tartaletas y Alfajores","descripcion":"Dulce artesanal Ale Atencio, elaborado con dedicación para disfrutar y compartir.","precio":0,"categoria_nombre":"Dulcería","stock":0,"drive_file_id":"","image_url":"producto-065-mini-tartaletas-y-alfajores.jpg","destacado":"NO","activo":"SI","ocasion":"Todo momento","orden":65,"fecha_actualizacion":""},{"id":"P066","nombre":"Croissants Artesanales","descripcion":"Postre artesanal Ale Atencio con presentación cuidada y sabor casero.","precio":0,"categoria_nombre":"Postres","stock":0,"drive_file_id":"","image_url":"producto-066-croissants-artesanales.jpg","destacado":"NO","activo":"SI","ocasion":"Todo momento","orden":66,"fecha_actualizacion":""},{"id":"P067","nombre":"Galletas Personalizadas Novios","descripcion":"Selección Ale Atencio pensada para regalar, compartir o personalizar.","precio":0,"categoria_nombre":"Regalos","stock":0,"drive_file_id":"","image_url":"producto-006-surtido-de-masas-secas.jpg","destacado":"NO","activo":"SI","ocasion":"Matrimonios","orden":67,"fecha_actualizacion":""},{"id":"P068","nombre":"Torta Chocolate Oro","descripcion":"Torta artesanal Ale Atencio, preparada con presentación cuidada para celebraciones y momentos especiales.","precio":0,"categoria_nombre":"Tortas","stock":0,"drive_file_id":"","image_url":"producto-004-torta-pina-crema-y-cerezas.jpg","destacado":"SI","activo":"SI","ocasion":"Celebraciones","orden":68,"fecha_actualizacion":""},{"id":"P069","nombre":"Torta Merengue Frambuesa","descripcion":"Torta artesanal Ale Atencio, preparada con presentación cuidada para celebraciones y momentos especiales.","precio":0,"categoria_nombre":"Tortas","stock":0,"drive_file_id":"","image_url":"producto-069-torta-merengue-frambuesa.jpg","destacado":"NO","activo":"SI","ocasion":"Celebraciones","orden":69,"fecha_actualizacion":""},{"id":"P070","nombre":"Strudel de Manzana","descripcion":"Postre artesanal Ale Atencio con presentación cuidada y sabor casero.","precio":0,"categoria_nombre":"Postres","stock":0,"drive_file_id":"","image_url":"producto-070-strudel-de-manzana.jpg","destacado":"NO","activo":"SI","ocasion":"Todo momento","orden":70,"fecha_actualizacion":""},{"id":"P071","nombre":"Galletas Peineta Artesanales","descripcion":"Elaboración artesanal Ale Atencio, ideal para compartir, acompañar o regalar.","precio":0,"categoria_nombre":"Galletas","stock":0,"drive_file_id":"","image_url":"producto-071-galletas-peineta-artesanales.jpg","destacado":"NO","activo":"SI","ocasion":"Todo momento","orden":71,"fecha_actualizacion":""},{"id":"P072","nombre":"Torta Merengue Frambuesa","descripcion":"Torta artesanal Ale Atencio, preparada con presentación cuidada para celebraciones y momentos especiales.","precio":0,"categoria_nombre":"Tortas","stock":0,"drive_file_id":"","image_url":"producto-072-torta-merengue-frambuesa.jpg","destacado":"NO","activo":"SI","ocasion":"Celebraciones","orden":72,"fecha_actualizacion":""},{"id":"P073","nombre":"Alfajores Nevados","descripcion":"Elaboración artesanal Ale Atencio, ideal para compartir, acompañar o regalar.","precio":0,"categoria_nombre":"Galletas","stock":0,"drive_file_id":"","image_url":"producto-073-alfajores-nevados.jpg","destacado":"NO","activo":"SI","ocasion":"Todo momento","orden":73,"fecha_actualizacion":""},{"id":"P074","nombre":"Torta Piña, Crema y Cerezas","descripcion":"Torta artesanal Ale Atencio, preparada con presentación cuidada para celebraciones y momentos especiales.","precio":0,"categoria_nombre":"Tortas","stock":0,"drive_file_id":"","image_url":"producto-074-torta-pina-crema-y-cerezas.jpg","destacado":"SI","activo":"SI","ocasion":"Celebraciones","orden":74,"fecha_actualizacion":""},{"id":"P075","nombre":"Tarta Corazones de Manjar","descripcion":"Postre artesanal Ale Atencio con presentación cuidada y sabor casero.","precio":0,"categoria_nombre":"Postres","stock":0,"drive_file_id":"","image_url":"producto-075-tarta-corazones-de-manjar.jpg","destacado":"NO","activo":"SI","ocasion":"Todo momento","orden":75,"fecha_actualizacion":""},{"id":"P076","nombre":"Torta Merengada Alta","descripcion":"Torta artesanal Ale Atencio, preparada con presentación cuidada para celebraciones y momentos especiales.","precio":0,"categoria_nombre":"Tortas","stock":0,"drive_file_id":"","image_url":"producto-076-torta-merengada-alta.jpg","destacado":"NO","activo":"SI","ocasion":"Celebraciones","orden":76,"fecha_actualizacion":""},{"id":"P077","nombre":"Torta Hojarasca Manjar Chocodots","descripcion":"Torta artesanal Ale Atencio, preparada con presentación cuidada para celebraciones y momentos especiales.","precio":0,"categoria_nombre":"Tortas","stock":0,"drive_file_id":"","image_url":"producto-077-torta-hojarasca-manjar-chocodots.jpg","destacado":"NO","activo":"SI","ocasion":"Celebraciones","orden":77,"fecha_actualizacion":""},{"id":"P078","nombre":"Macarons Surtidos Box","descripcion":"Selección Ale Atencio pensada para regalar, compartir o personalizar.","precio":0,"categoria_nombre":"Regalos","stock":0,"drive_file_id":"","image_url":"producto-078-macarons-surtidos-box.jpg","destacado":"NO","activo":"SI","ocasion":"Regalos","orden":78,"fecha_actualizacion":""},{"id":"P079","nombre":"Palmeritas de Hojaldre","descripcion":"Elaboración artesanal Ale Atencio, ideal para compartir, acompañar o regalar.","precio":0,"categoria_nombre":"Galletas","stock":0,"drive_file_id":"","image_url":"producto-079-palmeritas-de-hojaldre.jpg","destacado":"NO","activo":"SI","ocasion":"Todo momento","orden":79,"fecha_actualizacion":""},{"id":"P080","nombre":"Torta Chocolate Oro","descripcion":"Torta artesanal Ale Atencio, preparada con presentación cuidada para celebraciones y momentos especiales.","precio":0,"categoria_nombre":"Tortas","stock":0,"drive_file_id":"","image_url":"producto-080-torta-chocolate-oro.jpg","destacado":"SI","activo":"SI","ocasion":"Celebraciones","orden":80,"fecha_actualizacion":""},{"id":"P081","nombre":"Macarons Surtidos Box","descripcion":"Selección Ale Atencio pensada para regalar, compartir o personalizar.","precio":0,"categoria_nombre":"Regalos","stock":0,"drive_file_id":"","image_url":"producto-081-macarons-surtidos-box.jpg","destacado":"NO","activo":"SI","ocasion":"Regalos","orden":81,"fecha_actualizacion":""},{"id":"P082","nombre":"Torta Naked Frambuesa","descripcion":"Torta artesanal Ale Atencio, preparada con presentación cuidada para celebraciones y momentos especiales.","precio":0,"categoria_nombre":"Tortas","stock":0,"drive_file_id":"","image_url":"producto-082-torta-naked-frambuesa.jpg","destacado":"NO","activo":"SI","ocasion":"Celebraciones","orden":82,"fecha_actualizacion":""},{"id":"P083","nombre":"Tarta Decorada Premium","descripcion":"Postre artesanal Ale Atencio con presentación cuidada y sabor casero.","precio":0,"categoria_nombre":"Postres","stock":0,"drive_file_id":"","image_url":"producto-083-tarta-decorada-premium.jpg","destacado":"NO","activo":"SI","ocasion":"Todo momento","orden":83,"fecha_actualizacion":""},{"id":"P084","nombre":"Rectángulo Hojarasca Manjar Dorado","descripcion":"Dulce artesanal Ale Atencio, elaborado con dedicación para disfrutar y compartir.","precio":0,"categoria_nombre":"Dulcería","stock":0,"drive_file_id":"","image_url":"producto-084-rectangulo-hojarasca-manjar-dorado.jpg","destacado":"NO","activo":"SI","ocasion":"Todo momento","orden":84,"fecha_actualizacion":""},{"id":"P085","nombre":"Galletas Navideñas Surtidas","descripcion":"Preparación artesanal Ale Atencio, ideal para compartir y regalar en temporada navideña.","precio":0,"categoria_nombre":"Regalos","stock":0,"drive_file_id":"","image_url":"producto-085-galletas-navidenas-surtidas.jpg","destacado":"NO","activo":"SI","ocasion":"Navidad","orden":85,"fecha_actualizacion":""},{"id":"P086","nombre":"Cuadrados Frambuesa Crumble","descripcion":"Dulce artesanal Ale Atencio, elaborado con dedicación para disfrutar y compartir.","precio":0,"categoria_nombre":"Dulcería","stock":0,"drive_file_id":"","image_url":"producto-086-cuadrados-frambuesa-crumble.jpg","destacado":"NO","activo":"SI","ocasion":"Todo momento","orden":86,"fecha_actualizacion":""},{"id":"P087","nombre":"Torta Hojarasca Manjar Alta","descripcion":"Torta artesanal Ale Atencio, preparada con presentación cuidada para celebraciones y momentos especiales.","precio":0,"categoria_nombre":"Tortas","stock":0,"drive_file_id":"","image_url":"producto-087-torta-hojarasca-manjar-alta.jpg","destacado":"NO","activo":"SI","ocasion":"Celebraciones","orden":87,"fecha_actualizacion":""},{"id":"P088","nombre":"Galleta Corporativa Personalizada","descripcion":"Preparación personalizada Ale Atencio para empresas, eventos y ocasiones especiales.","precio":0,"categoria_nombre":"Regalos","stock":0,"drive_file_id":"","image_url":"producto-088-galleta-corporativa-personalizada.jpg","destacado":"NO","activo":"SI","ocasion":"Empresas","orden":88,"fecha_actualizacion":""},{"id":"P089","nombre":"Cheesecake Frutos Rojos","descripcion":"Postre artesanal Ale Atencio con presentación cuidada y sabor casero.","precio":0,"categoria_nombre":"Postres","stock":0,"drive_file_id":"","image_url":"producto-026-tarta-nuez-espolvoreada.jpg","destacado":"SI","activo":"SI","ocasion":"Todo momento","orden":89,"fecha_actualizacion":""},{"id":"P090","nombre":"Torta Chocolate Oro","descripcion":"Torta artesanal Ale Atencio, preparada con presentación cuidada para celebraciones y momentos especiales.","precio":0,"categoria_nombre":"Tortas","stock":0,"drive_file_id":"","image_url":"producto-090-torta-chocolate-oro.jpg","destacado":"NO","activo":"SI","ocasion":"Celebraciones","orden":90,"fecha_actualizacion":""},{"id":"P091","nombre":"Torta Hojarasca Manjar Clásica","descripcion":"Torta artesanal Ale Atencio, preparada con presentación cuidada para celebraciones y momentos especiales.","precio":0,"categoria_nombre":"Tortas","stock":0,"drive_file_id":"","image_url":"producto-091-torta-hojarasca-manjar-clasica.jpg","destacado":"NO","activo":"SI","ocasion":"Celebraciones","orden":91,"fecha_actualizacion":""},{"id":"P092","nombre":"Muffin Gourmet Frutos Secos","descripcion":"Dulce artesanal Ale Atencio, elaborado con dedicación para disfrutar y compartir.","precio":0,"categoria_nombre":"Dulcería","stock":0,"drive_file_id":"","image_url":"producto-092-muffin-gourmet-frutos-secos.jpg","destacado":"NO","activo":"SI","ocasion":"Todo momento","orden":92,"fecha_actualizacion":""},{"id":"P093","nombre":"Galletas Corporativas Personalizadas","descripcion":"Preparación personalizada Ale Atencio para empresas, eventos y ocasiones especiales.","precio":0,"categoria_nombre":"Regalos","stock":0,"drive_file_id":"","image_url":"producto-093-galletas-corporativas-personalizadas.jpg","destacado":"NO","activo":"SI","ocasion":"Empresas","orden":93,"fecha_actualizacion":""},{"id":"P094","nombre":"Strudel de Manzana y Nuez","descripcion":"Postre artesanal Ale Atencio con presentación cuidada y sabor casero.","precio":0,"categoria_nombre":"Postres","stock":0,"drive_file_id":"","image_url":"producto-094-strudel-de-manzana-y-nuez.jpg","destacado":"NO","activo":"SI","ocasion":"Todo momento","orden":94,"fecha_actualizacion":""},{"id":"P095","nombre":"Berlines con Azúcar","descripcion":"Postre artesanal Ale Atencio con presentación cuidada y sabor casero.","precio":0,"categoria_nombre":"Postres","stock":0,"drive_file_id":"","image_url":"producto-095-berlines-con-azucar.jpg","destacado":"NO","activo":"SI","ocasion":"Todo momento","orden":95,"fecha_actualizacion":""},{"id":"P096","nombre":"Rectángulo Hojarasca Frambuesa","descripcion":"Dulce artesanal Ale Atencio, elaborado con dedicación para disfrutar y compartir.","precio":0,"categoria_nombre":"Dulcería","stock":0,"drive_file_id":"","image_url":"producto-096-rectangulo-hojarasca-frambuesa.jpg","destacado":"NO","activo":"SI","ocasion":"Todo momento","orden":96,"fecha_actualizacion":""},{"id":"P097","nombre":"Galletas Corporativas Envoltorio","descripcion":"Preparación personalizada Ale Atencio para empresas, eventos y ocasiones especiales.","precio":0,"categoria_nombre":"Regalos","stock":0,"drive_file_id":"","image_url":"producto-097-galletas-corporativas-envoltorio.jpg","destacado":"NO","activo":"SI","ocasion":"Empresas","orden":97,"fecha_actualizacion":""},{"id":"P098","nombre":"Croissants Dorados","descripcion":"Postre artesanal Ale Atencio con presentación cuidada y sabor casero.","precio":0,"categoria_nombre":"Postres","stock":0,"drive_file_id":"","image_url":"producto-098-croissants-dorados.jpg","destacado":"NO","activo":"SI","ocasion":"Todo momento","orden":98,"fecha_actualizacion":""},{"id":"P099","nombre":"Palmeritas de Hojaldre","descripcion":"Elaboración artesanal Ale Atencio, ideal para compartir, acompañar o regalar.","precio":0,"categoria_nombre":"Galletas","stock":0,"drive_file_id":"","image_url":"producto-099-palmeritas-de-hojaldre.jpg","destacado":"NO","activo":"SI","ocasion":"Todo momento","orden":99,"fecha_actualizacion":""},{"id":"P100","nombre":"Torta Vainilla Manjar","descripcion":"Torta artesanal Ale Atencio, preparada con presentación cuidada para celebraciones y momentos especiales.","precio":0,"categoria_nombre":"Tortas","stock":0,"drive_file_id":"","image_url":"producto-100-torta-vainilla-manjar.jpg","destacado":"SI","activo":"SI","ocasion":"Celebraciones","orden":100,"fecha_actualizacion":""},{"id":"P101","nombre":"Rectángulo Hojarasca Frambuesa","descripcion":"Dulce artesanal Ale Atencio, elaborado con dedicación para disfrutar y compartir.","precio":0,"categoria_nombre":"Dulcería","stock":0,"drive_file_id":"","image_url":"producto-101-rectangulo-hojarasca-frambuesa.jpg","destacado":"NO","activo":"SI","ocasion":"Todo momento","orden":101,"fecha_actualizacion":""}]};

let state = JSON.parse(JSON.stringify(seed));
let cart = JSON.parse(localStorage.getItem("aleAtencioCart") || "[]");
let currentSlide = 0, slideTimer = null;

function beginButtonLoader(btn){if(!btn)return;btn.dataset.busy="1";btn.classList.add("is-loading");btn.disabled=true}
function endButtonLoader(btn){if(!btn)return;delete btn.dataset.busy;btn.classList.remove("is-loading");btn.disabled=false}
document.addEventListener("click",e=>{const b=e.target.closest("button");if(!b||b.disabled)return;b.classList.add("is-loading");setTimeout(()=>{if(!b.dataset.busy)b.classList.remove("is-loading")},360)},true);

async function loadStore(){
  if(AleAPI.configured()){
    try{
      const data = await AleAPI.get("bootstrap");
      state.config = {...state.config,...(data.config||{})};
      state.categories = data.categories?.length ? data.categories : state.categories;
      state.banners = data.banners?.length ? data.banners : state.banners;
      state.products = data.products?.length ? data.products : state.products;
    }catch(e){ console.warn("Catálogo remoto no disponible", e); }
  }
  const logo = state.config.logo_url || "logo-ale-atencio.png";
  $("#brandLogo").src = logo;
  const waFloat=$("#whatsappFloat"); if(waFloat) waFloat.style.display="grid";
  syncSocialButtons();
  buildCategoryMenu();
  render();
  updateCartUI();
}

function buildCategoryMenu(){
  $("#categoryMenu").innerHTML = state.categories
    .slice().sort((a,b)=>Number(a.orden||0)-Number(b.orden||0))
    .map(c=>`<a href="#productos/${slug(c.nombre)}">${esc(c.nombre)}</a>`).join("");
}

function slug(s){return String(s||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/\s+/g,"-")}
function categoryFallback(i){return ["🍰","🍪","🍬","🍮","🎁","🧁"][i%6]}
function productFallback(p){return ({Tortas:"🍰",Galletas:"🍪","Dulcería":"🍫",Postres:"🧁",Regalos:"🎁"})[p.categoria_nombre]||"🍰"}

function heroView(){
  const banners = state.banners.slice().sort((a,b)=>Number(a.orden||0)-Number(b.orden||0));
  return `<section class="hero"><div class="hero-stage">
    ${banners.map((b,i)=>`<article class="hero-slide ${i===0?"active":""}">
      <div class="hero-bg ${b.image_url?"":`hero-fallback-${(i%3)+1}`}" ${b.image_url?`style="background-image:url('${esc(mediaUrl(b.image_url))}')"`:""}></div>
      <div class="hero-content"><div class="hero-copy">
        <span class="eyebrow">Ale Atencio Repostería</span>
        <h1>${esc(b.titulo)}</h1>
        <p>${esc(b.subtitulo)}</p>
        <div class="hero-actions">
          <a class="btn btn-primary" href="${esc(b.enlace||"#productos/todos")}">${esc(b.cta_texto||"Ver más")}</a>
          <a class="btn hero-secondary" href="#productos/todos">Ver catálogo</a>
        </div>
      </div></div>
    </article>`).join("")}
    <div class="hero-controls">
      <button class="hero-arrow" id="prevSlide"><i class="bi bi-chevron-left"></i></button>
      <div class="hero-dots">${banners.map((_,i)=>`<button class="hero-dot ${i===0?"active":""}" data-dot="${i}"></button>`).join("")}</div>
      <button class="hero-arrow" id="nextSlide"><i class="bi bi-chevron-right"></i></button>
    </div>
  </div></section>`;
}

function categoryCard(c,i){
  return `<a class="category-card" href="#productos/${slug(c.nombre)}">
    ${c.image_url?`<img src="${esc(mediaUrl(c.image_url))}" alt="${esc(c.nombre)}">`:`<div style="position:absolute;inset:0;display:grid;place-items:center;font-size:92px">${categoryFallback(i)}</div>`}
    <div class="category-copy"><h3>${esc(c.nombre)}</h3><span>${esc(c.descripcion||"")}</span></div>
  </a>`;
}

function productCard(p){
  const priced=Number(p.precio||0)>0;
  const action=priced ? `addToCart('${esc(p.id)}')` : `location.hash='solicitud'`;
  return `<article class="product-card">
    <div class="product-image">
      ${p.image_url?`<img src="${esc(mediaUrl(p.image_url))}" alt="${esc(p.nombre)}" loading="lazy">`:`<span>${productFallback(p)}</span>`}
      ${String(p.destacado).toUpperCase()==="SI"?'<span class="product-badge">Destacado</span>':""}
    </div>
    <div class="product-body">
      <small>${esc(p.categoria_nombre||p.categoria||"")}</small>
      <h3>${esc(p.nombre)}</h3>
      <p>${esc(p.descripcion||"")}</p>
      <div class="product-bottom"><span class="price">${priceLabel(p)}</span><button class="add-button" onclick="${action}">${priced?"Agregar":"Consultar"}</button></div>
    </div>
  </article>`;
}

function catalogFilterInfo(filter){
  const key=slug(filter||"todos");
  const titleMap={
    "todos":"Todos los productos",
    "panaderia-galleteria":"Panadería y galletería",
    "eventos":"Eventos",
    "postres-antojos":"Postres y antojos"
  };
  return {key,title:titleMap[key]||titleCase(key)};
}

function catalogMatches(p,filter){
  const key=slug(filter||"todos");
  if(key==="todos") return true;
  const cat=slug(p.categoria_nombre||p.categoria);
  const occasion=slug(p.ocasion);
  const text=normalizeText([p.nombre,p.descripcion,p.categoria_nombre||p.categoria,p.ocasion].filter(Boolean).join(" "));
  if(key==="panaderia-galleteria") return cat==="galletas" || /croissant|rollo|strudel|berlin|palmerita|masa|hojaldre|galleta|alfajor/.test(text);
  if(key==="eventos") return occasion==="celebraciones" || cat==="tortas" || /evento|celebracion|cumple|novio|corporativ/.test(text);
  if(key==="postres-antojos") return cat==="postres" || cat==="dulceria";
  return cat===key || occasion===key;
}

function delicaciesSection(){
  const findBy=(pred)=>state.products.find(pred) || state.products.find(p=>p.image_url) || state.products[0];
  const cards=[
    {title:"Tortas",filter:"tortas",product:findBy(p=>slug(p.categoria_nombre||p.categoria)==="tortas" && p.image_url)},
    {title:"Panadería y galletería",filter:"panaderia-galleteria",product:findBy(p=>/croissant|rollo|galleta|masa|palmerita|berlin/.test(normalizeText(p.nombre)) && p.image_url)},
    {title:"Eventos",filter:"eventos",product:findBy(p=>slug(p.ocasion)==="celebraciones" && p.image_url)},
    {title:"Postres y antojos",filter:"postres-antojos",product:findBy(p=>["postres","dulceria"].includes(slug(p.categoria_nombre||p.categoria)) && p.image_url)}
  ];
  return `<section class="delicacies-section" aria-labelledby="delicaciesTitle">
    <div class="section delicacies-inner">
      <div class="delicacies-heading">
        <h2 id="delicaciesTitle">Nuestras delicias</h2>
        <p>Hechas con cariño, pensadas para celebrar</p>
      </div>
      <div class="delicacies-grid">
        ${cards.map((c,i)=>`<article class="delicacy-card">
          <a class="delicacy-media" href="#productos/${c.filter}" aria-label="Ver ${esc(c.title)}">
            ${c.product?.image_url?`<img src="${esc(mediaUrl(c.product.image_url))}" alt="${esc(c.title)}" loading="lazy">`:`<div class="delicacy-fallback">${categoryFallback(i)}</div>`}
          </a>
          <div class="delicacy-body">
            <h3>${esc(c.title)}</h3>
            <a class="delicacy-link" href="#productos/${c.filter}">Ver catálogo <i class="bi bi-chevron-right"></i></a>
          </div>
        </article>`).join("")}
      </div>
    </div>
  </section>`;
}

function homeView(){
  const cats = state.categories.slice().sort((a,b)=>Number(a.orden||0)-Number(b.orden||0));
  const featured = state.products.filter(p=>String(p.destacado).toUpperCase()==="SI").slice(0,6);
  const offers = state.products.slice().sort((a,b)=>Number(a.precio||0)-Number(b.precio||0)).slice(0,4);
  const visualProducts = state.products.filter(p=>p.image_url).slice(0,6);
  const allVisual = visualProducts.length ? visualProducts : state.products.slice(0,6);
  const primaryVisual = allVisual[0] || state.products[0];
  const giftVisual = state.products.find(p=>slug(p.categoria_nombre||p.categoria)==="regalos") || state.products[0];

  const imgOrFallback = (p,cls="") => p && p.image_url
    ? `<img class="${cls}" src="${esc(mediaUrl(p.image_url))}" alt="${esc(p.nombre||"Ale Atencio")}">`
    : `<div class="visual-fallback ${cls}">${p?productFallback(p):"🧁"}</div>`;

  return `${heroView()}

  <section class="home-intro-strip">
    <div><i class="bi bi-gift"></i><span>Regalos y celebraciones</span></div>
    <div><i class="bi bi-cake2"></i><span>Pedidos personalizados</span></div>
    <div><i class="bi bi-bag-heart"></i><span>Presentación cuidada</span></div>
    <div><i class="bi bi-whatsapp"></i><span>Atención directa</span></div>
  </section>

  ${delicaciesSection()}

  <section class="section home-categories">
    <div class="editorial-heading">
      <span class="eyebrow">Descubre</span>
      <h2>Nuestros favoritos</h2>
    </div>
    <div class="category-visual-grid">
      ${cats.slice(0,5).map((c,i)=>`
        <a class="category-visual-card category-size-${i+1}" href="#productos/${slug(c.nombre)}">
          ${c.image_url
            ? `<img src="${esc(mediaUrl(c.image_url))}" alt="${esc(c.nombre)}">`
            : `<div class="category-visual-fallback">${categoryFallback(i)}</div>`}
          <div class="category-visual-overlay">
            <span>${esc(c.descripcion||"")}</span>
            <h3>${esc(c.nombre)}</h3>
          </div>
        </a>`).join("")}
    </div>
  </section>

  <section class="section corporate-section">
    <div class="corporate-photo">
      ${imgOrFallback(giftVisual,"corporate-img")}
    </div>
    <div class="corporate-copy">
      <span class="eyebrow">Regalos especiales</span>
      <h2>Un detalle dulce siempre se recuerda</h2>
      <p>Preparamos cajas y selecciones para cumpleaños, agradecimientos, empresas y celebraciones.</p>
      <a class="btn btn-primary" href="#solicitud">Solicitar propuesta</a>
    </div>
  </section>

  <section class="section">
    <div class="editorial-heading centered">
      <span class="eyebrow">Los más pedidos</span>
      <h2>Dulces elegidos para compartir</h2>
    </div>
    <div class="products-grid products-home-grid">${featured.map(productCard).join("")}</div>
    <div class="center-action"><a class="editorial-link" href="#productos/todos">Ver todos los productos <i class="bi bi-arrow-right"></i></a></div>
  </section>

  <section class="wide-visual-band">
    <div class="wide-visual-image">
      ${imgOrFallback(primaryVisual,"wide-visual-img")}
    </div>
    <div class="wide-visual-copy">
      <span class="eyebrow">Hecho para celebrar</span>
      <h2>Sabores que acompañan tus mejores momentos</h2>
      <a class="btn btn-light" href="#nosotros">Conócenos</a>
    </div>
  </section>

  <section class="section">
    <div class="section-head compact-head">
      <div><span class="eyebrow">Selección especial</span><h2>Ofertas y favoritos</h2></div>
      <a class="editorial-link" href="#ofertas">Ver promociones</a>
    </div>
    <div class="offer-image-grid">${offers.map((p,i)=>`
      <article class="offer-image-card">
        <div class="offer-media">
          ${p.image_url?`<img src="${esc(mediaUrl(p.image_url))}" alt="${esc(p.nombre)}">`:`<div class="offer-fallback">${productFallback(p)}</div>`}
        </div>
        <div class="offer-info">
          <small>${esc(p.categoria_nombre||p.categoria||"")}</small>
          <h3>${esc(p.nombre)}</h3>
          <div><strong>${priceLabel(p)}</strong><button onclick="${Number(p.precio||0)>0?`addToCart('${esc(p.id)}')`:`location.hash='solicitud'`}"><i class="bi bi-plus-lg"></i></button></div>
        </div>
      </article>`).join("")}
    </div>
  </section>

  <section class="testimonials-band">
    <div class="section testimonials-inner">
      <div class="editorial-heading centered">
        <span class="eyebrow">Lo que dicen</span>
        <h2>Momentos que se vuelven recuerdos</h2>
      </div>
      <div class="testimonial-grid">
        <article><div class="quote-mark">“</div><p>Hermosa presentación y cada detalle se notaba preparado con muchísimo cariño.</p><strong>Camila R.</strong></article>
        <article><div class="quote-mark">“</div><p>La torta quedó preciosa y el sabor fue increíble. Todos preguntaron dónde la habíamos encargado.</p><strong>Daniela M.</strong></article>
        <article><div class="quote-mark">“</div><p>Pedí una caja para regalo y llegó impecable. Muy delicada y elegante.</p><strong>Francisca P.</strong></article>
      </div>
    </div>
  </section>

  <section class="section">
    <div class="section-head compact-head">
      <div><span class="eyebrow">Instagram</span><h2>Un poquito de Ale Atencio</h2></div>
      ${state.config.instagram?`<a class="editorial-link" href="${esc(state.config.instagram)}" target="_blank" rel="noopener">Síguenos <i class="bi bi-instagram"></i></a>`:""}
    </div>
    <div class="instagram-photo-grid">
      ${allVisual.map((p,i)=>`
        <a class="instagram-photo" href="${state.config.instagram?esc(state.config.instagram):"#productos/todos"}" ${state.config.instagram?'target="_blank" rel="noopener"':""}>
          ${p.image_url?`<img src="${esc(mediaUrl(p.image_url))}" alt="${esc(p.nombre)}">`:`<div class="instagram-fallback">${productFallback(p)}</div>`}
          <span><i class="bi bi-instagram"></i></span>
        </a>`).join("")}
    </div>
  </section>

  <section class="section">
    <div class="editorial-heading centered">
      <span class="eyebrow">Ideas dulces</span>
      <h2>Para inspirarte</h2>
    </div>
    <div class="journal-grid">
      <a class="journal-card" href="#productos/tortas">
        <div class="journal-visual">${imgOrFallback(state.products.find(p=>slug(p.categoria_nombre)==="tortas"))}</div>
        <div class="journal-copy"><small>Celebraciones</small><h3>Cómo elegir una torta para un momento especial</h3><span>Ver ideas →</span></div>
      </a>
      <a class="journal-card" href="#productos/regalos">
        <div class="journal-visual">${imgOrFallback(giftVisual)}</div>
        <div class="journal-copy"><small>Regalos</small><h3>Detalles dulces para sorprender</h3><span>Descubrir →</span></div>
      </a>
      <a class="journal-card" href="#solicitud">
        <div class="journal-visual">${imgOrFallback(state.products.find(p=>slug(p.categoria_nombre)==="postres"))}</div>
        <div class="journal-copy"><small>Eventos</small><h3>Ideas para una mesa dulce elegante</h3><span>Solicitar →</span></div>
      </a>
    </div>
  </section>

  <section class="contact-end-band">
    <div class="contact-end-inner">
      <div><span class="eyebrow">Ale Atencio Repostería</span><h2>¿Tienes una idea especial?</h2><p>Cuéntanos qué necesitas y coordinamos contigo cada detalle.</p></div>
      <div class="contact-end-actions">
        <a class="btn btn-primary" href="#solicitud">Hacer solicitud</a>
        <a class="btn btn-light" href="#" onclick="openWhatsApp();return false"><i class="bi bi-whatsapp"></i> WhatsApp</a>
      </div>
    </div>
  </section>

  ${footer()}`;
}

function catalogView(filter="todos"){
  const info=catalogFilterInfo(filter);
  const list = state.products.filter(p=>catalogMatches(p,info.key));
  return `<section class="view-hero"><div class="view-hero-inner"><span class="eyebrow">Catálogo</span><h1>${esc(info.title)}</h1><p>Elige tus favoritos y agrégalos al carrito.</p></div></section>
  <section class="section"><div class="catalog-tools"><input id="catalogSearch" placeholder="Buscar producto..."><select id="catalogSort"><option value="">Orden recomendado</option><option value="low">Precio menor a mayor</option><option value="high">Precio mayor a menor</option></select></div><div class="products-grid" id="catalogGrid">${list.map(productCard).join("")}</div></section>${footer()}`;
}
function titleCase(s){return String(s).split("-").map(x=>x.charAt(0).toUpperCase()+x.slice(1)).join(" ")}

function offersView(){
  const list=state.products.filter(p=>String(p.destacado).toUpperCase()==="SI");
  return `<section class="view-hero"><div class="view-hero-inner"><span class="eyebrow">Selección especial</span><h1>Promociones y destacados</h1><p>Opciones elegidas para regalar, compartir y celebrar.</p></div></section><section class="section"><div class="products-grid">${list.map(productCard).join("")}</div></section>${footer()}`;
}

function aboutView(){
  const aboutVisual = state.products.find(p=>slug(p.categoria_nombre||p.categoria)==="tortas") || state.products[0];
  return `<section class="view-hero"><div class="view-hero-inner"><span class="eyebrow">Nosotros</span><h1>Ale Atencio Repostería</h1><p>Preparaciones cuidadas, sabores que encantan y detalles pensados para cada ocasión.</p></div></section>
  <section class="section"><div class="story"><div class="story-visual">${aboutVisual && aboutVisual.image_url ? `<img src="${esc(mediaUrl(aboutVisual.image_url))}" alt="${esc(aboutVisual.nombre)}">` : `<div class="story-fallback">🎂</div>`}</div><div class="story-copy"><span class="eyebrow">Hecho para celebrar</span><h2>Momentos dulces</h2><p>Trabajamos cada pedido con dedicación, buscando que el sabor y la presentación se sientan especiales desde el primer momento.</p><a class="btn btn-primary" href="#solicitud">Solicitar pedido</a></div></div></section>${footer()}`;
}

function requestView(){
  return `<section class="view-hero"><div class="view-hero-inner"><span class="eyebrow">Solicitud</span><h1>Cuéntanos qué necesitas</h1><p>Completa los datos y te contactaremos para confirmar disponibilidad y detalles.</p></div></section>
  <section class="section"><div class="request-layout">
    <div class="request-card"><span class="eyebrow">Contacto</span><h2>Ale Atencio</h2>
      <div class="contact-line"><strong>WhatsApp</strong><span>${esc(state.config.whatsapp||"")}</span></div>
      <div class="contact-line"><strong>Correo</strong><span>${esc(state.config.email||"")}</span></div>
      <div class="contact-line"><strong>Dirección / retiro</strong><span>${esc(state.config.direccion||"Coordinación previa")}</span></div>
      ${socialIcons()}
    </div>
    <form class="request-form" id="requestForm"><span class="eyebrow">Cotización</span><h2>Formulario de solicitud</h2>
      <div class="form-grid">
        <input id="rqName" placeholder="Nombre completo" required><input id="rqPhone" placeholder="WhatsApp" required>
        <input id="rqEmail" type="email" placeholder="Correo"><input id="rqDate" type="date">
        <select id="rqType" required><option value="">Tipo de solicitud</option><option>Torta personalizada</option><option>Galletas</option><option>Postres para evento</option><option>Box regalo</option><option>Cotización general</option></select>
        <input id="rqQty" placeholder="Cantidad / personas"><textarea id="rqMessage" class="span-2" placeholder="Cuéntanos sabores, colores, temática, tamaño y otros detalles"></textarea>
      </div><button class="btn btn-primary" type="submit">Enviar solicitud</button>
    </form>
  </div></section>${footer()}`;
}

function policiesView(){
  return `<section class="view-hero"><div class="view-hero-inner"><span class="eyebrow">Información</span><h1>Políticas</h1><p>Condiciones importantes para coordinar tu pedido.</p></div></section>
  <section class="section"><div class="policy-grid">
    <div class="policy-card"><h3>Privacidad</h3><p>Los datos entregados se utilizan para gestionar solicitudes, pedidos y coordinación de entrega.</p></div>
    <div class="policy-card"><h3>Pedidos personalizados</h3><p>Valores, disponibilidad y tiempos pueden variar según diseño, tamaño, ingredientes y fecha solicitada.</p></div>
    <div class="policy-card"><h3>Despacho y retiro</h3><p>El costo y disponibilidad de despacho se confirma al coordinar el pedido. El retiro se agenda previamente.</p></div>
    <div class="policy-card"><h3>Cambios</h3><p>Al tratarse de alimentos y productos personalizados, cualquier incidencia se revisa directamente para buscar una solución adecuada.</p></div>
  </div></section>${footer()}`;
}

function socialLink(platform){return String((state.config||{})[platform]||"").trim()}
function openSocial(platform){const url=socialLink(platform);if(!url){toast(`${platform.charAt(0).toUpperCase()+platform.slice(1)} aún no está configurado en el cPanel.`);return false}window.open(url,"_blank","noopener");return true}
window.openSocial=openSocial;
function socialIcons(){
  const items=[
    `<a class="social-icon whatsapp" href="#" onclick="openWhatsApp();return false" title="WhatsApp" aria-label="WhatsApp"><i class="bi bi-whatsapp"></i></a>`,
    `<a class="social-icon instagram" href="#" onclick="openSocial('instagram');return false" title="Instagram" aria-label="Instagram"><i class="bi bi-instagram"></i></a>`,
    `<a class="social-icon facebook" href="#" onclick="openSocial('facebook');return false" title="Facebook" aria-label="Facebook"><i class="bi bi-facebook"></i></a>`,
    `<a class="social-icon tiktok" href="#" onclick="openSocial('tiktok');return false" title="TikTok" aria-label="TikTok"><i class="bi bi-tiktok"></i></a>`
  ];
  return `<div class="social-row" style="margin-top:20px">${items.join("")}</div>`;
}
function syncSocialButtons(){
  const map={instagram:"instagramFloat",facebook:"facebookFloat",tiktok:"tiktokFloat"};
  Object.entries(map).forEach(([platform,id])=>{const el=document.getElementById(id);if(!el)return;const url=socialLink(platform);el.classList.toggle("is-unconfigured",!url);el.href=url||"#";el.onclick=e=>{e.preventDefault();openSocial(platform)}});
}

function footer(){
  const c=state.config;
  return `<footer class="site-footer"><div class="footer-inner"><div class="footer-grid">
    <div class="footer-brand-block"><img class="footer-logo" src="${esc(c.logo_url||"logo-ale-atencio.png")}" alt="Ale Atencio"><p>Tortas, galletas, postres y regalos preparados para tus momentos especiales.</p>${socialIcons()}</div>
    <div class="footer-shop-block"><div class="footer-title">Tienda</div><div class="footer-links"><a href="#inicio">Inicio</a><a href="#productos/tortas">Tortas</a><a href="#productos/galletas">Galletas</a><a href="#productos/postres">Postres</a><a href="#productos/regalos">Regalos</a></div></div>
    <div class="footer-help-block"><div class="footer-title">Ayuda</div><div class="footer-links"><a href="#solicitud">Solicitud</a><a href="#politicas">Políticas</a><a href="#politicas">Despachos</a><a href="#politicas">Cambios</a></div></div>
    <div class="footer-contact-block"><div class="footer-title">Contacto</div><div class="footer-links">${normalizePhone(c.whatsapp)?`<a href="#" onclick="openWhatsApp();return false">${esc(c.whatsapp)}</a>`:""}${c.email?`<a href="mailto:${esc(c.email)}">${esc(c.email)}</a>`:""}${c.direccion?`<span>${esc(c.direccion)}</span>`:""}</div></div>
  </div><div class="footer-line"></div><div class="footer-bottom"><span>© 2026 Ale Atencio Repostería</span><div class="footer-policies"><a href="#politicas">Privacidad</a><a href="#politicas">Términos</a><a href="#politicas">Despacho</a></div></div></div></footer>`;
}

function render(){
  const hash=location.hash.replace("#","")||"inicio";
  if(hash==="inicio") $("#app").innerHTML=homeView();
  else if(hash.startsWith("productos/")) $("#app").innerHTML=catalogView(hash.split("/")[1]||"todos");
  else if(hash==="ofertas") $("#app").innerHTML=offersView();
  else if(hash==="nosotros") $("#app").innerHTML=aboutView();
  else if(hash==="solicitud") $("#app").innerHTML=requestView();
  else if(hash==="politicas") $("#app").innerHTML=policiesView();
  else $("#app").innerHTML=homeView();
  window.scrollTo({top:0,behavior:"smooth"});
  closeMobile(); wireCarousel(); wireCatalog(); wireRequest();
}

function wireCarousel(){
  const slides=$$(".hero-slide"), dots=$$(".hero-dot"); if(!slides.length)return;
  const show=i=>{currentSlide=(i+slides.length)%slides.length;slides.forEach((s,x)=>s.classList.toggle("active",x===currentSlide));dots.forEach((d,x)=>d.classList.toggle("active",x===currentSlide))}
  $("#prevSlide")?.addEventListener("click",()=>{show(currentSlide-1);reset()});$("#nextSlide")?.addEventListener("click",()=>{show(currentSlide+1);reset()});dots.forEach((d,i)=>d.addEventListener("click",()=>{show(i);reset()}));
  const start=()=>slideTimer=setInterval(()=>show(currentSlide+1),5000),reset=()=>{clearInterval(slideTimer);start()};clearInterval(slideTimer);start();
}

function wireCatalog(){
  const input=$("#catalogSearch"), sort=$("#catalogSort"); if(!input)return;
  const filter=location.hash.replace("#productos/","")||"todos";
  const base=state.products.filter(p=>catalogMatches(p,filter));
  const redraw=()=>{const q=normalizeText(input.value);let list=base.filter(p=>productSearchText(p).includes(q));if(sort.value==="low")list.sort((a,b)=>a.precio-b.precio);if(sort.value==="high")list.sort((a,b)=>b.precio-a.precio);$("#catalogGrid").innerHTML=list.length?list.map(productCard).join(""):'<div class="empty-card">No encontramos productos.</div>'}
  input.addEventListener("input",redraw);sort.addEventListener("change",redraw);
}

function clientRecordId(prefix){
  const rnd = (window.crypto?.getRandomValues) ? Array.from(crypto.getRandomValues(new Uint32Array(2))).map(n=>n.toString(36)).join("") : Math.random().toString(36).slice(2,12);
  return `${prefix}-WEB-${Date.now().toString(36).toUpperCase()}-${rnd.slice(0,10).toUpperCase()}`;
}

async function sendAndConfirm(action, type, data){
  // R9.3: el ID nace en el navegador y el backend es idempotente.
  // Si el transporte se corta después del INSERT, verificamos por ID antes de
  // declarar un error. Esto evita el falso "no fue posible" con registro guardado.
  let postError = null;
  try{
    const r=await AleAPI.postPublic(action,data);
    if(r?.ok!==false) return {ok:true,id:r?.id||data.id,numero_solicitud:r?.numero_solicitud||"",source:"transport",persisted:r?.persisted!==false};
  }catch(err){ postError=err; }

  // Ante timeout/CORS/conexión ambigua, la escritura puede haber quedado confirmada.
  for(let i=0;i<7;i++){
    if(i) await new Promise(r=>setTimeout(r,450+i*180));
    try{
      const check=await AleAPI.verifyRecord(type,data.id,1);
      if(check?.ok&&check?.exists) return {ok:true,id:data.id,numero_solicitud:check?.numero_solicitud||"",source:"verified-after-transport"};
    }catch(_){ }
  }

  const err=postError||new Error("REGISTRO_NO_CONFIRMADO");
  err.ambiguous = AleAPI.isAmbiguousTransportError?.(err) !== false;
  throw err;
}

function wireRequest(){
  $("#requestForm")?.addEventListener("submit",async e=>{
    e.preventDefault();
    const form=e.currentTarget;
    const btn=e.submitter||form?.querySelector('button[type="submit"]');
    beginButtonLoader(btn);
    const data={id:clientRecordId("SOL"),nombre:$("#rqName").value.trim(),telefono:$("#rqPhone").value.trim(),email:$("#rqEmail").value.trim(),fecha_evento:$("#rqDate").value,tipo:$("#rqType").value,cantidad:$("#rqQty").value.trim(),detalle:$("#rqMessage").value.trim()};
    try{
      if(!AleAPI.configured()) throw new Error("API_NO_CONFIGURADA");
      const r=await sendAndConfirm("createRequest","request",data);
      // Desde este punto el servidor ya confirmó el registro.
      // Ningún error de UI posterior debe convertirse en un falso error de envío.
      toast(`Solicitud enviada correctamente · ${r.numero_solicitud||r.id}`,"success");
      try{ form?.reset(); }catch(uiErr){ console.warn("No fue posible limpiar el formulario",uiErr); }
      try{
        if(normalizePhone(state.config.whatsapp)) openWhatsApp(`Hola Ale Atencio, acabo de registrar la solicitud ${r.numero_solicitud||r.id}.\n\nNombre: ${data.nombre}\nTeléfono: ${data.telefono}\nFecha: ${data.fecha_evento}\nTipo: ${data.tipo}\nCantidad: ${data.cantidad}\nDetalle: ${data.detalle}`);
      }catch(uiErr){ console.warn("La solicitud fue registrada, pero no se pudo abrir WhatsApp",uiErr); }
    } catch(err){
      console.warn(err);
      if(AleAPI.isAmbiguousTransportError?.(err) || err?.ambiguous){
        toast(`Solicitud ${data.id} recibida; la confirmación del servidor está demorando. No la vuelvas a enviar.`,"info");
      } else {
        toast(`No fue posible registrar la solicitud: ${String(err?.message||"ERROR_SERVIDOR")}`,"error");
      }
    } finally { endButtonLoader(btn); }
  });
}

window.addToCart=id=>{const p=state.products.find(x=>x.id===id);if(!p)return;const item=cart.find(x=>x.id===id);if(item)item.qty++;else cart.push({id,qty:1});saveCart();toast("Producto agregado")}
function saveCart(){localStorage.setItem("aleAtencioCart",JSON.stringify(cart));updateCartUI()}
window.changeQty=(id,d)=>{const i=cart.find(x=>x.id===id);if(!i)return;i.qty+=d;if(i.qty<=0)cart=cart.filter(x=>x.id!==id);saveCart()}
window.removeItem=id=>{cart=cart.filter(x=>x.id!==id);saveCart()}

function totals(method=""){
  const subtotal=cart.reduce((s,i)=>{const p=state.products.find(x=>x.id===i.id);return s+(p?Number(p.precio)*i.qty:0)},0);
  const delivery=(subtotal && method==="Despacho")?Number(state.config.valor_despacho||0):0;
  return{subtotal,delivery,total:subtotal+delivery}
}
function updateCartUI(){
  const count=cart.reduce((s,i)=>s+i.qty,0);$("#cartCount").textContent=count;
  $("#cartItems").innerHTML=count?cart.map(i=>{const p=state.products.find(x=>x.id===i.id);if(!p)return"";return `<div class="cart-item"><div class="cart-thumb">${productFallback(p)}</div><div><strong>${esc(p.nombre)}</strong><small>${money(p.precio)}</small><div class="qty"><button onclick="changeQty('${p.id}',-1)">−</button><span>${i.qty}</span><button onclick="changeQty('${p.id}',1)">+</button></div></div><button class="remove-item" onclick="removeItem('${p.id}')"><i class="bi bi-x-lg"></i></button></div>`}).join(""):'<div class="empty-card">Tu carrito está vacío.</div>';
  const t=totals();$("#cartSubtotal").textContent=money(t.subtotal);$("#cartDelivery").textContent="Por confirmar";$("#cartTotal").textContent=money(t.subtotal);
}

async function submitOrder(){
  const btn=$("#submitOrderBtn");
  if(!cart.length){toast("Tu carrito está vacío");return}
  const nombre=$("#coName").value.trim(), telefono=$("#coPhone").value.trim();if(!nombre||!telefono){toast("Completa nombre y WhatsApp");return}
  beginButtonLoader(btn);
  const metodo=$("#coMethod").value;const t=totals(metodo);const detail=cart.map(i=>{const p=state.products.find(x=>x.id===i.id);return{id:p.id,nombre:p.nombre,cantidad:i.qty,precio:Number(p.precio)}})
  const data={id:clientRecordId("PED"),nombre,telefono,email:$("#coEmail").value.trim(),metodo_entrega:metodo,direccion:$("#coAddress").value.trim(),observaciones:$("#coNotes").value.trim(),detalle:detail,subtotal:t.subtotal,despacho:t.delivery,total:t.total};
  let orderId="",saved=false;
  try{if(!AleAPI.configured())throw new Error("API_NO_CONFIGURADA");const r=await sendAndConfirm("createOrder","order",data);orderId=r.id||data.id;saved=true;}
  catch(e){console.warn(e)}
  const lines=detail.map(x=>`• ${x.cantidad} x ${x.nombre} - ${money(x.precio*x.cantidad)}`).join("\n");
  if(normalizePhone(state.config.whatsapp)) openWhatsApp(`Hola Ale Atencio, quiero confirmar mi pedido${orderId?` ${orderId}`:""}.\n\n${lines}\n\nTotal: ${money(t.total)}\nNombre: ${nombre}\nEntrega: ${data.metodo_entrega}\nDirección: ${data.direccion}\nObservaciones: ${data.observaciones}`);
  if(saved){cart=[];saveCart();closeModal();closeCart();toast(`Pedido registrado${orderId?` · ${orderId}`:""}`,"success");}
  else toast(normalizePhone(state.config.whatsapp)?"No se confirmó el pedido en la BD; se abrió WhatsApp.":"No fue posible registrar el pedido. Revisa la conexión del sistema.","error");
  endButtonLoader(btn);
}

function normalizePhone(v){return String(v||"").replace(/\D/g,"")}
window.openWhatsApp=(custom="")=>{const phone=normalizePhone(state.config.whatsapp);if(!phone){toast("WhatsApp aún no está configurado en el cPanel.");return false}const msg=custom||"Hola Ale Atencio, quisiera información sobre sus productos.";window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`,"_blank","noopener");return true}

function openCart(){$("#cartDrawer").classList.add("open");$("#overlay").classList.add("show")}function closeCart(){$("#cartDrawer").classList.remove("open");$("#overlay").classList.remove("show")}
function openModal(id){$(id).classList.add("show")}function closeModal(){$$(".modal").forEach(x=>x.classList.remove("show"))}
$("#cartBtn").addEventListener("click",openCart);$("#closeCart").addEventListener("click",closeCart);$("#overlay").addEventListener("click",closeCart);$("#clearCart").addEventListener("click",()=>{cart=[];saveCart()});
$("#checkoutBtn").addEventListener("click",()=>{if(!cart.length)return toast("Tu carrito está vacío");openModal("#checkoutModal")});$("#submitOrderBtn").addEventListener("click",submitOrder);$("#whatsappFloat").addEventListener("click",e=>{e.preventDefault();openWhatsApp()});
$("#searchBtn").addEventListener("click",()=>openModal("#searchModal"));$$("[data-close-modal]").forEach(b=>b.addEventListener("click",closeModal));$$(".modal").forEach(m=>m.addEventListener("click",e=>{if(e.target===m)closeModal()}));
$("#searchAction").addEventListener("click",doSearch);$("#searchInput").addEventListener("keydown",e=>{if(e.key==="Enter")doSearch()});
function doSearch(){const q=normalizeText($("#searchInput").value);const list=state.products.filter(p=>productSearchText(p).includes(q)).slice(0,8);$("#searchResults").innerHTML=list.length?list.map(p=>`<div class="search-result"><div><strong>${esc(p.nombre)}</strong><br><small>${esc(p.categoria_nombre||"")}</small></div><button class="add-button" onclick="addToCart('${p.id}')">Agregar</button></div>`).join(""):'<div class="empty-card">No encontramos coincidencias.</div>'}
$(".nav-trigger").addEventListener("click",e=>{e.stopPropagation();e.currentTarget.closest(".nav-group").classList.toggle("open")});document.addEventListener("click",()=>$(".nav-group").classList.remove("open"));
$("#mobileToggle").addEventListener("click",()=>$("#mainNav").classList.toggle("show"));function closeMobile(){$("#mainNav").classList.remove("show");$(".nav-group").classList.remove("open")}
function toast(msg,type="info"){
  let t=$(".toast");
  if(!t){t=document.createElement("div");t.className="toast";document.body.appendChild(t)}
  t.className=`toast ${type}`;
  const icon=type==="success"?"✓":type==="error"?"✕":"";
  t.innerHTML=`${icon?`<span class="toast-status-icon">${icon}</span>`:""}<span>${esc(msg)}</span>`;
  t.classList.add("show");
  clearTimeout(t._timer);
  t._timer=setTimeout(()=>t.classList.remove("show"),type==="info"?1900:3500);
}
window.addEventListener("hashchange",render);
loadStore();


function hideSplashScreen(){
  const splash = document.getElementById('splashScreen');
  if(!splash || splash.dataset.closing === '1') return;
  splash.dataset.closing = '1';
  splash.classList.add('closing');
  setTimeout(()=>{
    splash.classList.add('hide');
  }, 980);
  setTimeout(()=>{
    if(splash && splash.parentNode) splash.parentNode.removeChild(splash);
  }, 1650);
}

window.addEventListener('load', ()=>{
  setTimeout(hideSplashScreen, 1700);
});

// safety fallback
setTimeout(()=>{
  const splash = document.getElementById('splashScreen');
  if(splash && splash.dataset.closing !== '1') hideSplashScreen();
}, 3600);
