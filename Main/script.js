/* ---------- Referencias ---------- */
const input = document.getElementById('ingredientes');
const chipsEl = document.getElementById('chips');
const restriccionesInput = document.getElementById('restricciones');
const chipsRestriccionesEl = document.getElementById('chips-restricciones');
const btn = document.getElementById('buscar');
const btnLimpiar = document.getElementById('limpiar');
const estadoEl = document.getElementById('estado');
const estadoTexto = document.getElementById('estado-texto');
const errorEl = document.getElementById('error');
const resultadosEl = document.getElementById('resultados');
const listaHistorialEl = document.getElementById('lista-historial');
const listaGuardadasEl = document.getElementById('lista-guardadas');
const btnBorrarHistorial = document.getElementById('borrar-historial');

/* ---------- Estado ---------- */
let guardadas = [];   // recetas guardadas
let historial = [];   // búsquedas anteriores
const recetasPorId = {};
const MAX_HISTORIAL = 15;

/* ---------- Almacenamiento (persistente) ---------- */
const store = {
  async get(key){
    try{
      if(window.storage && window.storage.get){
        const r = await window.storage.get(key);
        return r && r.value ? JSON.parse(r.value) : null;
      }
    }catch(e){ /* clave inexistente u otro error */ }
    try{
      const v = window.localStorage.getItem(key);
      return v ? JSON.parse(v) : null;
    }catch(e){ return null; }
  },
  async set(key, value){
    const texto = JSON.stringify(value);
    try{
      if(window.storage && window.storage.set){
        await window.storage.set(key, texto);
        return;
      }
    }catch(e){ /* intenta con localStorage */ }
    try{ window.localStorage.setItem(key, texto); }catch(e){ /* sin almacenamiento */ }
  }
};

/* ---------- Utilidades ---------- */
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
  }catch(e){ return ''; }
}

/* ---------- Chips ---------- */
function renderChips(){
  chipsEl.innerHTML = parseIngredientes(input.value).map(i => `<span class="chip">${escapeHtml(i)}</span>`).join('');
}
function renderChipsRestricciones(){
  chipsRestriccionesEl.innerHTML = parseIngredientes(restriccionesInput.value).map(i => `<span class="chip evitar">${escapeHtml(i)}</span>`).join('');
}
input.addEventListener('input', renderChips);
restriccionesInput.addEventListener('input', renderChipsRestricciones);
input.addEventListener('keydown', e => { if(e.key === 'Enter') buscarRecetas(); });
restriccionesInput.addEventListener('keydown', e => { if(e.key === 'Enter') buscarRecetas(); });
btn.addEventListener('click', buscarRecetas);

/* ---------- Limpiar campos ---------- */
btnLimpiar.addEventListener('click', () => {
  input.value = '';
  restriccionesInput.value = '';
  renderChips();
  renderChipsRestricciones();
  resultadosEl.innerHTML = '';
  errorEl.classList.remove('visible');
  estadoEl.classList.remove('visible');
  input.focus();
});

/* ---------- Pestañas ---------- */
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

/* ---------- Tarjeta de receta ---------- */
function estaGuardada(id){
  return guardadas.some(g => g.id === id);
}

function recetaHtml(r){
  const usados = (r.ingredientes_usados || []).map(i => `<span class="tag tienes">${escapeHtml(i)}</span>`).join('');
  const extra = (r.ingredientes_extra || []).map(i => `<span class="tag falta">falta: ${escapeHtml(i)}</span>`).join('');
  const pasos = (r.pasos || []).map(p => `<li>${escapeHtml(p)}</li>`).join('');
  const g = estaGuardada(r.id);
  return `
    <div class="receta" data-id="${r.id}">
      <div class="receta-head">
        <p class="receta-nombre">${escapeHtml(r.nombre || 'Receta')}</p>
        <span class="receta-tiempo">${escapeHtml(r.tiempo || '')}</span>
      </div>
      <p class="receta-desc">${escapeHtml(r.descripcion || '')}</p>
      <div class="tags">${usados}${extra}</div>
      <p class="pasos-label">Preparación</p>
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

/* Guardar / quitar con delegación de eventos */
document.addEventListener('click', async (e) => {
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

  // Si estamos viendo la pestaña de guardadas, refrescar la lista
  if(document.getElementById('panel-guardadas').classList.contains('activo')) renderGuardadas();
});

/* ---------- Render: Guardadas ---------- */
function renderGuardadas(){
  if(guardadas.length === 0){
    listaGuardadasEl.innerHTML = `<p class="vacio">Todavía no has guardado ninguna receta. Cuando encuentres una que te guste, pulsa “Guardar receta” y aparecerá aquí cada vez que abras el programa.</p>`;
    return;
  }
  registrarRecetas(guardadas);
  listaGuardadasEl.innerHTML = guardadas.map(recetaHtml).join('');
}

/* ---------- Render: Historial ---------- */
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

/* ---------- Búsqueda de recetas ---------- */
async function buscarRecetas(){
  const ingredientes = parseIngredientes(input.value);
  const restricciones = parseIngredientes(restriccionesInput.value);
  errorEl.classList.remove('visible');

  if(ingredientes.length === 0){
    errorEl.textContent = 'Escribe al menos un ingrediente.';
    errorEl.classList.add('visible');
    return;
  }

  btn.disabled = true;
  resultadosEl.innerHTML = '';
  estadoTexto.textContent = 'Buscando recetas...';
  estadoEl.classList.add('visible');

  try{
    const system = `Eres un asistente de cocina. El usuario te da una lista de ingredientes que tiene disponibles en casa.
Devuelve entre 3 y 4 recetas variadas que usen principalmente esos ingredientes.
Responde ÚNICAMENTE con un array JSON válido, sin texto adicional, sin markdown, sin backticks. Formato exacto:
[
  {
    "nombre": "Nombre del platillo",
    "descripcion": "Una frase breve (máx 20 palabras) describiendo el platillo",
    "tiempo": "20 min",
    "ingredientes_usados": ["ingrediente del usuario que se usa", "..."],
    "ingredientes_extra": ["ingrediente adicional necesario que el usuario no mencionó", "..."],
    "pasos": ["Paso 1 breve", "Paso 2 breve", "Paso 3 breve"]
  }
]
Usa español neutro. Los ingredientes_usados deben ser un subconjunto de los que el usuario mencionó (usa exactamente los mismos nombres que escribió). ingredientes_extra son cosas comunes de despensa que probablemente necesite además (pueden estar vacíos si no hace falta nada más). Los pasos deben ser 3 a 6, breves y accionables.
Si el usuario indica alergias o ingredientes que quiere evitar, NINGUNA receta debe incluirlos, ni en ingredientes_usados, ni en ingredientes_extra, ni en los pasos. Esto es una restricción estricta, no una preferencia.`;

    const response = await fetch("proxy.php", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 2000,
        system: system,
        messages: [
          { role: "user", content: `Tengo estos ingredientes: ${ingredientes.join(', ')}.${restricciones.length ? ` No quiero recetas que incluyan: ${restricciones.join(', ')}.` : ''} Dame recetas.` }
        ]
      })
    });

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

    recetas = recetas.map(r => ({ ...r, id: nuevoId() }));
    registrarRecetas(recetas);
    renderResultados(recetas, ingredientes, restricciones);

    // Añadir al historial
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
    estadoEl.classList.remove('visible');
  }
}

function renderResultados(recetas, ingredientesUsuario, restricciones){
  const titulo = `<p class="resultados-titulo">Recetas para ti</p>
    <p class="resultados-sub">Con lo que tienes: ${escapeHtml(ingredientesUsuario.join(', '))}${restricciones.length ? ` · Sin: ${escapeHtml(restricciones.join(', '))}` : ''}</p>`;
  resultadosEl.innerHTML = titulo + recetas.map(recetaHtml).join('');
}

/* ---------- Inicio: cargar datos guardados ---------- */
(async function init(){
  const g = await store.get('recetario:guardadas');
  const h = await store.get('recetario:historial');
  guardadas = Array.isArray(g) ? g : [];
  historial = Array.isArray(h) ? h : [];
  registrarRecetas(guardadas);
  historial.forEach(x => registrarRecetas(x.recetas || []));
  actualizarCuentas();
  // Si ya tienes recetas guardadas, se abren directamente
  if(guardadas.length > 0) mostrarTab('guardadas');
})();
