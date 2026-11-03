const input = document.getElementById('ingredientes');
const chipsEl = document.getElementById('chips');
const restriccionesInput = document.getElementById('restricciones');
const chipsRestriccionesEl = document.getElementById('chips-restricciones');
const despensaRapidaEl = document.getElementById('despensa-rapida');
const btn = document.getElementById('buscar');
const btnActualizar = document.getElementById('actualizar');
const btnLimpiar = document.getElementById('limpiar');
const estadoEl = document.getElementById('estado');
const estadoTexto = document.getElementById('estado-texto');
const errorEl = document.getElementById('error');
const resultadosEl = document.getElementById('resultados');
const listaHistorialEl = document.getElementById('lista-historial');
const listaGuardadasEl = document.getElementById('lista-guardadas');
const btnBorrarHistorial = document.getElementById('borrar-historial');
const themeToggleBtn = document.getElementById('theme-toggle');
const themeLabel = document.getElementById('theme-label');

let guardadas = [];
let historial = [];
let recetasVistas = [];
let ultimaClaveBusqueda = '';
const recetasPorId = {};
const MAX_HISTORIAL = 15;

const store = {
  async get(key){
    try{
      const v = window.localStorage.getItem(key);
      return v ? JSON.parse(v) : null;
    }catch(e){
      return null;
    }
  },
  async set(key, value){
    try{
      window.localStorage.setItem(key, JSON.stringify(value));
    }catch(e){}
  }
};

function esperar(ms){
  return new Promise(resolve => setTimeout(resolve, ms));
}

function aplicarTema(tema){
  if(tema === 'dark'){
    document.documentElement.setAttribute('data-theme', 'dark');
    if(themeLabel) themeLabel.textContent = 'Claro';
  }else{
    document.documentElement.removeAttribute('data-theme');
    if(themeLabel) themeLabel.textContent = 'Oscuro';
  }
}

if(themeToggleBtn){
  themeToggleBtn.addEventListener('click', async () => {
    const esOscuro = document.documentElement.getAttribute('data-theme') === 'dark';
    const nuevoTema = esOscuro ? 'light' : 'dark';
    aplicarTema(nuevoTema);
    await store.set('recetario:tema', nuevoTema);
  });
}

function parseIngredientes(texto){
  return texto.split(/,| y /i).map(s => s.trim()).filter(s => s.length > 0);
}

function escapeHtml(str){
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

function nuevoId(){
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function formatoFecha(ts){
  try{
    return new Date(ts).toLocaleString('es', {day:'numeric', month:'short', hour:'2-digit', minute:'2-digit'});
  }catch(e){
    return '';
  }
}

function sincronizarBotonesDespensa(){
  if(!despensaRapidaEl) return;
  const actuales = parseIngredientes(input.value).map(i => i.toLowerCase());
  despensaRapidaEl.querySelectorAll('.btn-despensa').forEach(b => {
    const ing = (b.dataset.ing || '').toLowerCase();
    const activo = actuales.includes(ing);
    b.classList.toggle('activo', activo);
    b.textContent = (activo ? '✓ ' : '+ ') + b.dataset.ing;
  });
}

function renderChips(){
  chipsEl.innerHTML = parseIngredientes(input.value).map(i => `<span class="chip">${escapeHtml(i)}</span>`).join('');
  sincronizarBotonesDespensa();
}

function renderChipsRestricciones(){
  chipsRestriccionesEl.innerHTML = parseIngredientes(restriccionesInput.value).map(i => `<span class="chip evitar">${escapeHtml(i)}</span>`).join('');
}

if(despensaRapidaEl){
  despensaRapidaEl.addEventListener('click', (e) => {
    const boton = e.target.closest('.btn-despensa');
    if(!boton) return;
    const ingNuevo = boton.dataset.ing;
    const lista = parseIngredientes(input.value);
    const indice = lista.findIndex(i => i.toLowerCase() === ingNuevo.toLowerCase());

    if(indice >= 0){
      lista.splice(indice, 1);
    }else{
      lista.push(ingNuevo.toLowerCase());
    }

    input.value = lista.join(', ');
    renderChips();
    input.focus();
  });
}

input.addEventListener('input', renderChips);
restriccionesInput.addEventListener('input', renderChipsRestricciones);
input.addEventListener('keydown', e => { if(e.key === 'Enter') buscarRecetas(false); });
restriccionesInput.addEventListener('keydown', e => { if(e.key === 'Enter') buscarRecetas(false); });
btn.addEventListener('click', () => buscarRecetas(false));
btnActualizar.addEventListener('click', () => buscarRecetas(true));

btnLimpiar.addEventListener('click', () => {
  input.value = '';
  restriccionesInput.value = '';
  recetasVistas = [];
  ultimaClaveBusqueda = '';
  renderChips();
  renderChipsRestricciones();
  resultadosEl.innerHTML = '';
  btnActualizar.style.display = 'none';
  errorEl.classList.remove('visible');
  estadoEl.classList.remove('visible');
  input.focus();
});

function mostrarTab(nombre){
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('activa', t.dataset.tab === nombre));
  document.querySelectorAll('.panel').forEach(p => p.classList.toggle('activo', p.id === 'panel-' + nombre));
  if(nombre === 'historial') renderHistorial();
  if(nombre === 'guardadas') renderGuardadas();
}

document.querySelectorAll('.tab').forEach(t => {
  t.addEventListener('click', () => mostrarTab(t.dataset.tab));
});

function actualizarCuentas(){
  document.getElementById('cuenta-guardadas').textContent = guardadas.length ? guardadas.length : '';
  document.getElementById('cuenta-historial').textContent = historial.length ? historial.length : '';
}

function estaGuardada(id){
  return guardadas.some(g => g.id === id);
}

function calcularMedidaIngrediente(ingrediente, porciones){
  const nombre = ingrediente.toLowerCase();
  if(/huevo/.test(nombre)) return `${porciones * 2} uds`;
  if(/pl[aá]tano/.test(nombre)) return porciones === 1 ? '1/2 ud grande' : (porciones === 2 ? '1 ud grande' : '2 uds grandes');
  if(/aguacate/.test(nombre)) return porciones === 1 ? '1/2 ud' : (porciones === 2 ? '1 ud' : '2 uds');
  if(/tomate/.test(nombre)) return `${porciones} ${porciones === 1 ? 'mediano' : 'medianos'}`;
  if(/cebolla/.test(nombre)) return porciones === 1 ? '1/4 ud' : (porciones === 2 ? '1/2 ud' : '1 ud');
  if(/ajo/.test(nombre)) return `${porciones} ${porciones === 1 ? 'diente' : 'dientes'}`;
  if(/chile/.test(nombre)) return porciones === 1 ? '1/2 ud' : (porciones === 2 ? '1 ud' : '2 uds');
  if(/pollo|carne|res|cerdo|bistec|pechuga|molida|pescado|at[uú]n/.test(nombre)) return `${porciones * 150} g`;
  if(/salchicha|chorizo/.test(nombre)) return `${porciones} ${porciones === 1 ? 'ud' : 'uds'}`;
  if(/papa|patata|pipi[aá]n|g[uü]isquil/.test(nombre)) return `${porciones} ${porciones === 1 ? 'mediano' : 'medianos'}`;
  if(/arroz|frijol|lenteja|pasta|fideo/.test(nombre)) return porciones === 1 ? '1/2 taza' : `${porciones / 2} ${porciones === 2 ? 'taza' : 'tazas'}`;
  if(/queso|quesillo|cuajada|mozzarella|reques[oó]n/.test(nombre)) return `${porciones * 50} g`;
  if(/crema|leche/.test(nombre)) return `${porciones * 2} cdas`;
  if(/pan franc[eé]s|bolillo/.test(nombre)) return `${porciones} ${porciones === 1 ? 'ud' : 'uds'}`;
  if(/pan|tortilla/.test(nombre)) return `${porciones * 2} uds`;
  return `${porciones} ${porciones === 1 ? 'porción' : 'porciones'}`;
}

function renderCantidadesPorcion(r){
  const p = r.porciones || 2;
  const lista = (r.ingredientes_usados || []).map(ing => {
    const medida = calcularMedidaIngrediente(ing, p);
    return `<span class="porcion-item">${escapeHtml(ing)}: <strong>${escapeHtml(medida)}</strong></span>`;
  }).join('');
  return lista;
}

function recetaHtml(r){
  const porcionesActuales = r.porciones || 2;
  const completados = Array.isArray(r.pasos_completados) ? r.pasos_completados : [];
  const usados = (r.ingredientes_usados || []).map(i => `<span class="tag tienes">${escapeHtml(i)}</span>`).join('');
  const sazones = (r.sazones || []).length
    ? `<span class="tag" style="background:var(--surface-soft);color:var(--ink-soft);border:1px solid var(--line);">sazón: ${escapeHtml(r.sazones.join(', '))}</span>`
    : '';
  const extra = (r.ingredientes_extra || []).map(i => `<span class="tag falta">extra: ${escapeHtml(i)}</span>`).join('');

  const pasos = (r.pasos || []).map((p, idx) => {
    const marcado = completados.includes(idx);
    return `
      <li class="paso-item ${marcado ? 'completado' : ''}" data-accion="toggle-paso" data-id="${r.id}" data-idx="${idx}">
        <span class="paso-check">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        </span>
        <span class="paso-texto">${idx + 1}. ${escapeHtml(p)}</span>
      </li>`;
  }).join('');

  const g = estaGuardada(r.id);

  return `
    <div class="receta" data-id="${r.id}">
      <div class="receta-head">
        <p class="receta-nombre">${escapeHtml(r.nombre || 'Receta')}</p>
        <span class="receta-tiempo">${escapeHtml(r.tiempo || '')}</span>
      </div>
      <p class="receta-desc">${escapeHtml(r.descripcion || '')}</p>
      <div class="tags">${usados}${sazones}${extra}</div>

      <div class="porciones-box">
        <div class="porciones-header">
          <span class="porciones-titulo">Cantidades sugeridas</span>
          <div class="porciones-selector">
            ${[1, 2, 4].map(num => `
              <button type="button" class="btn-porcion ${porcionesActuales === num ? 'activa' : ''}" data-accion="porcion" data-id="${r.id}" data-num="${num}">
                ${num}${num === 1 ? 'persona' : 'personas'}
              </button>
            `).join('')}
          </div>
        </div>
        <div class="porciones-cantidades" data-cantidades-id="${r.id}">
          ${renderCantidadesPorcion(r)}
        </div>
      </div>

      <div class="pasos-cabecera">
        <p class="pasos-label">Preparación paso a paso</p>
        <span class="pasos-hint">Toca cada paso al completarlo</span>
      </div>
      <ol class="pasos">${pasos}</ol>
      <div class="receta-pie">
        <button class="btn-guardar ${g ? 'guardada' : ''}" data-accion="guardar" data-id="${r.id}">
          <svg width="14" height="14" viewBox="0 0 24 24"><path d="M6 3h12v18l-6-4-6 4z"/></svg>
          <span>${g ? 'Guardada' : 'Guardar receta'}</span>
        </button>
      </div>
    </div>`;
}

function registrarRecetas(lista){
  lista.forEach(r => { recetasPorId[r.id] = r; });
}

document.addEventListener('click', async (e) => {
  const botonActualizarInline = e.target.closest('[data-accion="actualizar"]');
  if(botonActualizarInline){
    buscarRecetas(true);
    return;
  }

  const botonPorcion = e.target.closest('[data-accion="porcion"]');
  if(botonPorcion){
    const id = botonPorcion.dataset.id;
    const num = parseInt(botonPorcion.dataset.num, 10);
    const receta = recetasPorId[id];
    if(!receta) return;

    receta.porciones = num;
    document.querySelectorAll(`[data-accion="porcion"][data-id="${id}"]`).forEach(b => {
      b.classList.toggle('activa', parseInt(b.dataset.num, 10) === num);
    });
    document.querySelectorAll(`[data-cantidades-id="${id}"]`).forEach(contenedor => {
      contenedor.innerHTML = renderCantidadesPorcion(receta);
    });

    if(estaGuardada(id)){
      await store.set('recetario:guardadas', guardadas);
    }
    return;
  }

  const itemPaso = e.target.closest('[data-accion="toggle-paso"]');
  if(itemPaso){
    const id = itemPaso.dataset.id;
    const idx = parseInt(itemPaso.dataset.idx, 10);
    const receta = recetasPorId[id];
    if(!receta) return;

    if(!Array.isArray(receta.pasos_completados)){
      receta.pasos_completados = [];
    }
    const pos = receta.pasos_completados.indexOf(idx);
    if(pos >= 0){
      receta.pasos_completados.splice(pos, 1);
    }else{
      receta.pasos_completados.push(idx);
    }

    const completado = receta.pasos_completados.includes(idx);
    document.querySelectorAll(`[data-accion="toggle-paso"][data-id="${id}"][data-idx="${idx}"]`).forEach(el => {
      el.classList.toggle('completado', completado);
    });

    if(estaGuardada(id)){
      await store.set('recetario:guardadas', guardadas);
    }
    return;
  }

  const boton = e.target.closest('[data-accion="guardar"]');
  if(!boton) return;
  const id = boton.dataset.id;
  const receta = recetasPorId[id];
  if(!receta) return;

  if(estaGuardada(id)){
    guardadas = guardadas.filter(g => g.id !== id);
  }else{
    guardadas.unshift(receta);
  }
  await store.set('recetario:guardadas', guardadas);
  actualizarCuentas();

  document.querySelectorAll(`[data-accion="guardar"][data-id="${id}"]`).forEach(b => {
    const g = estaGuardada(id);
    b.classList.toggle('guardada', g);
    b.querySelector('span').textContent = g ? 'Guardada' : 'Guardar receta';
  });

  if(document.getElementById('panel-guardadas').classList.contains('activo')) renderGuardadas();
});

function renderGuardadas(){
  if(guardadas.length === 0){
    listaGuardadasEl.innerHTML = `<p class="vacio">Todavía no has guardado ninguna receta. Cuando encuentres una que te guste, pulsa “Guardar receta” y aparecerá aquí cada vez que abras el programa.</p>`;
    return;
  }
  registrarRecetas(guardadas);
  listaGuardadasEl.innerHTML = guardadas.map(recetaHtml).join('');
}

function renderHistorial(){
  btnBorrarHistorial.style.display = historial.length ? 'inline' : 'none';
  if(historial.length === 0){
    listaHistorialEl.innerHTML = `<p class="vacio">Aquí aparecerán las búsquedas que hagas y las recetas que te hayan salido.</p>`;
    return;
  }
  listaHistorialEl.innerHTML = historial.map(h => {
    registrarRecetas(h.recetas);
    const sin = h.restricciones && h.restricciones.length
      ? `<div class="busq-sin">Sin: ${escapeHtml(h.restricciones.join(', '))}</div>` : '';
    return `
      <details class="busqueda">
        <summary>
          <div>
            <div class="busq-ing">${escapeHtml(h.ingredientes.join(', '))}</div>
            ${sin}
          </div>
          <span class="busq-meta">${formatoFecha(h.fecha)} · ${h.recetas.length} recetas</span>
        </summary>
        <div class="busq-cuerpo">${h.recetas.map(recetaHtml).join('')}</div>
      </details>`;
  }).join('');
}

let confirmandoBorrado = false;
btnBorrarHistorial.addEventListener('click', async () => {
  if(!confirmandoBorrado){
    confirmandoBorrado = true;
    btnBorrarHistorial.textContent = '¿Seguro? Pulsa otra vez';
    setTimeout(() => {
      confirmandoBorrado = false;
      btnBorrarHistorial.textContent = 'Borrar historial';
    }, 3000);
    return;
  }
  confirmandoBorrado = false;
  btnBorrarHistorial.textContent = 'Borrar historial';
  historial = [];
  await store.set('recetario:historial', historial);
  actualizarCuentas();
  renderHistorial();
});

async function buscarRecetas(esActualizacion = false){
  const ingredientes = parseIngredientes(input.value);
  const restricciones = parseIngredientes(restriccionesInput.value);
  errorEl.classList.remove('visible');

  if(ingredientes.length === 0){
    errorEl.textContent = 'Escribe o selecciona al menos un ingrediente.';
    errorEl.classList.add('visible');
    return;
  }

  const claveActual = ingredientes.join('|').toLowerCase() + '::' + restricciones.join('|').toLowerCase();
  if(!esActualizacion && claveActual !== ultimaClaveBusqueda){
    recetasVistas = [];
  }
  ultimaClaveBusqueda = claveActual;

  btn.disabled = true;
  btnActualizar.disabled = true;
  resultadosEl.innerHTML = '';
  estadoTexto.textContent = esActualizacion ? 'Actualizando recetas con nuevas ideas...' : 'Buscando recetas...';
  estadoEl.classList.add('visible');

  try{
    const system = `Eres un asistente de cocina. El usuario te da una lista de ingredientes que tiene disponibles en casa.
Prioriza recetas que usen TODOS los ingredientes del usuario y que solo requieran sazones básicos (sal, pimienta, orégano, aceite). Deja al final cualquier receta que requiera ingredientes extra como pan o tortillas.
Responde ÚNICAMENTE con un array JSON válido, sin texto adicional, sin markdown, sin backticks.`;

    const evitarTexto = recetasVistas.length ? ` No repitas estas recetas anteriores: ${recetasVistas.join(', ')}.` : '';

    const [response] = await Promise.all([
      fetch("proxy.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 2000,
          system: system,
          excluidas: recetasVistas,
          messages: [
            { role: "user", content: `Tengo estos ingredientes: ${ingredientes.join(', ')}.${restricciones.length ? ` No quiero recetas que incluyan: ${restricciones.join(', ')}.` : ''}${evitarTexto} Dame recetas.` }
          ]
        })
      }),
      esperar(2000)
    ]);

    if(!response.ok){
      throw new Error('Error de red al contactar el servicio de recetas.');
    }

    const data = await response.json();
    const textBlock = data.content.find(b => b.type === 'text');
    if(!textBlock){
      throw new Error('No se recibió una respuesta con recetas.');
    }

    let clean = textBlock.text.trim();
    clean = clean.replace(/^```json/i, '').replace(/^```/, '').replace(/```$/, '').trim();

    let recetas;
    try{
      recetas = JSON.parse(clean);
    }catch(e){
      const match = clean.match(/\[[\s\S]*\]/);
      if(match){
        recetas = JSON.parse(match[0]);
      }else{
        throw new Error('No se pudieron interpretar las recetas recibidas.');
      }
    }

    if(!Array.isArray(recetas) || recetas.length === 0){
      throw new Error('No se encontraron recetas con esos ingredientes.');
    }

    recetas.sort((a, b) => {
      const extraA = (a.ingredientes_extra || []).length;
      const extraB = (b.ingredientes_extra || []).length;
      return extraA - extraB;
    });

    recetas.forEach(r => {
      if(r.nombre && !recetasVistas.includes(r.nombre)){
        recetasVistas.push(r.nombre);
      }
    });

    recetas = recetas.map(r => ({ ...r, id: nuevoId(), porciones: 2, pasos_completados: [] }));
    registrarRecetas(recetas);
    renderResultados(recetas, ingredientes, restricciones);
    btnActualizar.style.display = 'inline-block';

    historial.unshift({
      id: nuevoId(),
      fecha: Date.now(),
      ingredientes,
      restricciones,
      recetas
    });
    historial = historial.slice(0, MAX_HISTORIAL);
    await store.set('recetario:historial', historial);
    actualizarCuentas();

  }catch(err){
    console.error(err);
    errorEl.textContent = 'Hubo un problema buscando recetas: ' + (err && err.message ? err.message : 'error desconocido') + '. Intenta de nuevo.';
    errorEl.classList.add('visible');
  }finally{
    btn.disabled = false;
    btnActualizar.disabled = false;
    estadoEl.classList.remove('visible');
  }
}

function renderResultados(recetas, ingredientesUsuario, restricciones){
  const encabezado = `
    <div class="resultados-barra">
      <div>
        <p class="resultados-titulo">Recetas para ti</p>
        <p class="resultados-sub">Con lo que tienes: ${escapeHtml(ingredientesUsuario.join(', '))}${restricciones.length ? ` · Sin: ${escapeHtml(restricciones.join(', '))}` : ''}</p>
      </div>
      <button class="secondary btn-actualizar-inline" data-accion="actualizar">Actualizar recetas</button>
    </div>`;
  resultadosEl.innerHTML = encabezado + recetas.map(recetaHtml).join('');
}

(async function init(){
  const temaGuardado = await store.get('recetario:tema');
  if(temaGuardado){
    aplicarTema(temaGuardado);
  }else if(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches){
    aplicarTema('dark');
  }

  const g = await store.get('recetario:guardadas');
  const h = await store.get('recetario:historial');
  guardadas = Array.isArray(g) ? g : [];
  historial = Array.isArray(h) ? h : [];
  registrarRecetas(guardadas);
  historial.forEach(x => registrarRecetas(x.recetas || []));
  actualizarCuentas();
  sincronizarBotonesDespensa();
  if(guardadas.length > 0) mostrarTab('guardadas');
})();