const token = localStorage.getItem("token");
let listaGrupos = [];
let listaComercios = [];
let vendedoresGlobal = [];
let datosReporte = [];
let cuponesPorGrupo = {};
let paginaActual = {};

function verificarTokenValido() {
  if (!token) window.location.href = "ingresa.html";
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    if (payload.exp < Math.floor(Date.now() / 1000)) {
      Swal.fire("Sesión expirada", "Debes iniciar sesión nuevamente.", "warning").then(() => {
        localStorage.removeItem("token");
        window.location.href = "ingresa.html";
      });
    }
    document.getElementById("usuarioNombre").textContent = payload.nombre;
    return payload;
  } catch (err) {
    localStorage.removeItem("token");
    window.location.href = "ingresa.html";
  }
}

function cerrarSesion() {
  localStorage.removeItem("token");
  window.location.href = "ingresa.html";
}

function formatearFecha(fechaISO) {
  if (!fechaISO) return '-';
  const fecha = new Date(fechaISO);
  const dia = String(fecha.getDate()).padStart(2, '0');
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const año = fecha.getFullYear();
  return `${dia}-${mes}-${año}`;
}

async function cargarGrupos() {
  try {
    const res = await fetch(`${API}/api/admin/grupos`, { headers: { Authorization: "Bearer " + token } });
    listaGrupos = await res.json();

    const tbody = document.querySelector("#tabla-grupos-admin tbody");
    tbody.innerHTML = "";

    listaGrupos.forEach(grupo => {
      const tr = document.createElement("tr");
      tr.setAttribute("data-id", grupo.id);
      tr.innerHTML = `
        <td>${grupo.nombre}</td>
        <td><span>${grupo.descripcion}</span><input type="text" class="edit-input" style="display:none" value="${grupo.descripcion || ''}" /></td>
        <td><span>$${parseFloat(grupo.precio).toFixed(2)}</span><input type="number" class="edit-input" style="display:none" value="${grupo.precio}" /></td>
        <td><span>${formatearFecha(grupo.fecha_fin)}</span><input type="date" class="edit-input fecha-fin-edit" style="display:none" value="${grupo.fecha_fin || ''}" /></td>
        <td>
          <button onclick="habilitarEdicionGrupo(${grupo.id})">✏️ Editar</button>
          <button class="guardar-grupo-btn" style="display:none" onclick="guardarEdicionGrupo(${grupo.id})">💾 Guardar</button>
          <button class="cancelar-grupo-btn" style="display:none" onclick="cancelarEdicionGrupo(${grupo.id})">❌ Cancelar</button>
          <button class="eliminar-grupo-btn" onclick="eliminarGrupo(${grupo.id})">🗑 Eliminar</button>
        </td>
      `;
      tbody.appendChild(tr);
    });

    actualizarSelectGrupos();
  } catch (err) {
    console.error(err);
    Swal.fire("Error", "No se pudo cargar la información de los grupos.", "error");
  }
}

function actualizarSelectGrupos() {
  const selects = [document.getElementById("grupoSelect"), document.getElementById("grupoManualSelect"), document.getElementById("grupoSelectCodigos")];
  selects.forEach(select => {
    if (!select) return;
    select.innerHTML = `<option value="">-- Selecciona un grupo --</option>`;
    listaGrupos.forEach(g => {
      const option = document.createElement("option");
      option.value = g.id;
      option.textContent = g.nombre;
      select.appendChild(option);
    });
  });
}

function habilitarEdicionGrupo(id) {
  const row = document.querySelector(`#tabla-grupos-admin tr[data-id='${id}']`);
  row.querySelectorAll("span").forEach(el => el.style.display = "none");
  row.querySelectorAll(".edit-input").forEach(el => el.style.display = "inline-block");
  row.querySelector(".guardar-grupo-btn").style.display = "inline-block";
  row.querySelector(".cancelar-grupo-btn").style.display = "inline-block";
  row.querySelector(".eliminar-grupo-btn").style.display = "inline-block";
}

function cancelarEdicionGrupo(id) {
  cargarGrupos();
}

async function guardarEdicionGrupo(id) {
  const row = document.querySelector(`#tabla-grupos-admin tr[data-id='${id}']`);
  const inputs = row.querySelectorAll(".edit-input");

  const descripcion = inputs[0].value.trim();
  const precio = parseFloat(inputs[1].value);
  const fecha_fin = inputs[2].value;

  if (!descripcion || isNaN(precio) || !fecha_fin) {
    return Swal.fire("Campos incompletos", "Todos los campos son obligatorios.", "warning");
  }

  try {
    const res = await fetch(`${API}/api/admin/grupos/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
      body: JSON.stringify({ descripcion, precio, fecha_fin })
    });

    if (res.ok) {
      Swal.fire("Actualizado", "Grupo actualizado correctamente.", "success");
      cargarGrupos();
    } else {
      const data = await res.json();
      Swal.fire("Error", data.error || "No se pudo actualizar el grupo.", "error");
    }
  } catch (err) {
    console.error(err);
    Swal.fire("Error", "Error de conexión al actualizar grupo.", "error");
  }
}

async function crearGrupoNuevo(event) {
  event.preventDefault();
  
  const nombre = document.getElementById("grupo_nombre").value.trim();
  const descripcion = document.getElementById("grupo_descripcion").value.trim();
  const precio = parseFloat(document.getElementById("grupo_precio").value);
  const fecha_fin = document.getElementById("grupo_fecha_fin").value;

  if (!nombre || isNaN(precio) || !fecha_fin) {
    return Swal.fire("Campos incompletos", "Todos los campos son obligatorios.", "warning");
  }

  try {
    const res = await fetch(`${API}/api/admin/grupos`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
      body: JSON.stringify({ nombre, descripcion, precio, fecha_fin })
    });

    if (res.ok) {
      Swal.fire("Creado", "Grupo creado correctamente.", "success");
      document.getElementById("formCrearGrupo").reset();
      cargarGrupos();
    } else {
      const data = await res.json();
      Swal.fire("Error", data.error || "No se pudo crear el grupo.", "error");
    }
  } catch (err) {
    console.error(err);
    Swal.fire("Error", "Error de conexión al crear grupo.", "error");
  }
}

async function eliminarGrupo(id) {
  const confirm = await Swal.fire({
    title: "¿Eliminar grupo?",
    text: "Se eliminará el grupo y TODOS sus cupones relacionados.",
    icon: "warning",
    showCancelButton: true,
    confirmButtonText: "Sí, eliminar",
    cancelButtonText: "Cancelar"
  });

  if (!confirm.isConfirmed) return;

  try {
    const res = await fetch(`${API}/api/admin/grupos/${id}`, {
      method: "DELETE",
      headers: { Authorization: "Bearer " + token }
    });

    if (res.ok) {
      Swal.fire("Eliminado", "Grupo eliminado correctamente.", "success");
      cargarGrupos();
    } else {
      const data = await res.json();
      Swal.fire("Error", data.error || "No se pudo eliminar el grupo.", "error");
    }
  } catch (err) {
    console.error(err);
    Swal.fire("Error", "Error de conexión al eliminar grupo.", "error");
  }
}

async function cargarCuponesAdmin() {
  try {
    const res = await fetch(`${API}/api/admin/cupones`, { headers: { Authorization: "Bearer " + token } });
    const cupones = await res.json();
    const tbody = document.querySelector("#tabla-cupones-admin tbody");
    tbody.innerHTML = "";

    cupones.forEach(c => {
      const tr = document.createElement("tr");
      tr.setAttribute("data-id", c.id);
      tr.innerHTML = `
        <td><span>${c.titulo}</span><input type="text" class="edit-input" style="display:none" value="${c.titulo}" /></td>
        <td><span>${c.descripcion}</span><input type="text" class="edit-input" style="display:none" value="${c.descripcion}" /></td>
        <td><span>${c.descuento}</span><input type="text" class="edit-input" style="display:none" value="${c.descuento}" /></td>
        <td><span>${formatearFecha(c.fecha_expiracion)}</span><input type="date" class="edit-input fecha-expiracion-edit" style="display:none" value="${c.fecha_expiracion?.split('T')[0] || ''}" /></td>
        <td><span>${c.comercio}</span></td>
        <td><span>${c.grupo}</span></td>
        <td>
          <button onclick="habilitarEdicion(${c.id})">✏️ Editar</button>
          <button class="guardar-btn" style="display:none" onclick="guardarEdicion(${c.id})">💾 Guardar</button>
          <button class="cancelar-btn" style="display:none" onclick="cancelarEdicion(${c.id})">❌ Cancelar</button>
          <button onclick="eliminarCupon(${c.id})">🗑 Eliminar</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error(err);
    Swal.fire("Error", "No se pudo cargar los cupones", "error");
  }
}

async function cargarComercios() {
  try {
    const res = await fetch(`${API}/api/admin/comercios`, {
      headers: { Authorization: "Bearer " + token }
    });

    const comercios = await res.json();
    console.log("Comercios cargados:", comercios);

    const select = document.getElementById("comercioSelect");
    select.innerHTML = `<option value="">-- Selecciona un comercio --</option>`;

    comercios.forEach(comercio => {
      const option = document.createElement("option");
      option.value = comercio.id;
      option.textContent = comercio.nombre;
      select.appendChild(option);
    });

  } catch (err) {
    console.error("Error al cargar comercios:", err);
    Swal.fire("Error", "No se pudieron cargar los comercios.", "error");
  }
}

function habilitarEdicion(id) {
  const row = document.querySelector(`tr[data-id='${id}']`);
  row.querySelectorAll("span").forEach(el => el.style.display = "none");
  row.querySelectorAll(".edit-input").forEach(el => el.style.display = "inline-block");
  row.querySelector(".guardar-btn").style.display = "inline-block";
  row.querySelector(".cancelar-btn").style.display = "inline-block";
}

function cancelarEdicion(id) {
  cargarCuponesAdmin();
}

async function guardarEdicion(id) {
  const row = document.querySelector(`tr[data-id='${id}']`);
  const inputs = row.querySelectorAll(".edit-input");

  const titulo = inputs[0].value.trim();
  const descripcion = inputs[1].value.trim();
  const descuento = inputs[2].value.trim();
  const fecha_expiracion = row.querySelector(".fecha-expiracion-edit").value;

  if (!titulo || !descripcion || !descuento || !fecha_expiracion) {
    return Swal.fire("Campos incompletos", "Todos los campos son obligatorios.", "warning");
  }

  try {
    const res = await fetch(`${API}/api/admin/cupones/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
      body: JSON.stringify({ titulo, descripcion, descuento, fecha_expiracion })
    });

    const data = await res.json();

    if (res.ok) {
      Swal.fire("Actualizado", "Cupón actualizado correctamente.", "success");
      cargarCuponesAdmin();
    } else {
      Swal.fire("Error", data.error || "No se pudo actualizar el cupón.", "error");
    }
  } catch (err) {
    console.error(err);
    Swal.fire("Error", "Error al actualizar cupón", "error");
  }
}

async function eliminarCupon(id) {
  const confirmacion = await Swal.fire({
    title: "¿Eliminar cupón?",
    text: "Esta acción no se puede deshacer.",
    icon: "warning",
    showCancelButton: true,
    confirmButtonText: "Sí, eliminar",
    cancelButtonText: "Cancelar"
  });

  if (!confirmacion.isConfirmed) return;

  try {
    const res = await fetch(`${API}/api/admin/cupones/${id}`, {
      method: "DELETE",
      headers: { Authorization: "Bearer " + token }
    });

    if (res.ok) {
      Swal.fire("Eliminado", "Cupón eliminado correctamente.", "success");
      cargarCuponesAdmin();
    } else {
      const data = await res.json();
      Swal.fire("Error", data.error || "No se pudo eliminar el cupón.", "error");
    }
  } catch (err) {
    console.error(err);
    Swal.fire("Error", "Error de conexión al eliminar cupón", "error");
  }
}

async function crearCuponNuevo() {
  const titulo = document.getElementById("nuevoCuponTitulo").value.trim();
  const descripcion = document.getElementById("nuevoCuponDescripcion").value.trim();
  const descuento = document.getElementById("nuevoCuponDescuento").value.trim();
  const comercio_id = document.getElementById("nuevoCuponComercio").value;
  const grupo_id = document.getElementById("nuevoCuponGrupo").value;

  if (!titulo || !descripcion || !descuento || !comercio_id || !grupo_id) {
    return Swal.fire("Campos obligatorios", "Todos los campos son requeridos.", "warning");
  }

  try {
    const res = await fetch(`${API}/api/admin/cupones`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
      body: JSON.stringify({ titulo, descripcion, descuento, comercio_id, grupo_id })
    });

    const data = await res.json();

    if (res.ok) {
      Swal.fire("Creado", "Cupón creado correctamente.", "success");
      document.getElementById("nuevoCuponTitulo").value = "";
      document.getElementById("nuevoCuponDescripcion").value = "";
      document.getElementById("nuevoCuponDescuento").value = "";
      cargarCuponesAdmin();
    } else {
      Swal.fire("Error", data.error || "No se pudo crear el cupón.", "error");
    }
  } catch (err) {
    console.error(err);
    Swal.fire("Error", "Error de conexión al crear cupón", "error");
  }
}

function exportarExcel() {
  if (!datosReporte.length) {
    return Swal.fire("Sin datos", "No hay datos para exportar.", "info");
  }

  const dataExcel = datosReporte.map(row => ({
    Cliente: row.cliente,
    Cupón: row.cupon,
    Comercio: row.comercio,
    Descuento: row.descuento,
    Usado: row.utilizado ? 'Sí' : 'No',
    "Fecha de compra": formatearFecha(row.fecha_compra)
  }));

  const worksheet = XLSX.utils.json_to_sheet(dataExcel);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Reporte Cupones");
  XLSX.writeFile(workbook, "reporte-cupones.xlsx");

  Swal.fire("Exportado", "Reporte exportado en formato Excel.", "success");
}

// ----- Asignación manual de cupones -----

async function cargarClientes() {
  const res = await fetch(`${API}/api/admin/usuarios`, { headers: { Authorization: "Bearer " + token } });
  const usuarios = await res.json();
  const clientes = usuarios.filter(u => u.tipo === "cliente");

  const clienteSelect = document.getElementById("clienteSelect");
  clienteSelect.innerHTML = `<option value="">-- Selecciona un cliente --</option>`;
  clientes.forEach(c => {
    const option = document.createElement("option");
    option.value = c.id;
    option.textContent = `${c.nombre} - ${c.email}`;
    clienteSelect.appendChild(option);
  });
}

async function cargarVendedoresParaManual() {
  const vendedorSelect = document.getElementById("vendedorManualSelect");
  vendedorSelect.innerHTML = `<option value="">-- Selecciona un vendedor --</option>`;
  vendedoresGlobal.forEach(v => {
    const option = document.createElement("option");
    option.value = v.id;
    option.textContent = v.nombre;
    vendedorSelect.appendChild(option);
  });
}

async function asignarCuponesManual(e) {
  e.preventDefault();
  const cliente_id = document.getElementById("clienteSelect").value;
  const grupo_id = document.getElementById("grupoManualSelect").value;
  const vendedor_id = document.getElementById("vendedorManualSelect").value;
  const monto = parseFloat(document.getElementById("montoPagado").value);

  if (!cliente_id || !grupo_id || !vendedor_id || isNaN(monto)) {
    return Swal.fire("Campos obligatorios", "Todos los campos son requeridos.", "warning");
  }

  try {
    const res = await fetch(`${API}/api/admin/asignar-cupones-manual`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
      body: JSON.stringify({ cliente_id, grupo_id, vendedor_id, monto })
    });

    const data = await res.json();
    if (res.ok) {
      Swal.fire("Asignados", "Cupones asignados correctamente.", "success");
      document.getElementById("formAsignarCupones").reset();
    } else {
      Swal.fire("Error", data.error || "No se pudieron asignar los cupones.", "error");
    }
  } catch (err) {
    console.error(err);
    Swal.fire("Error", "Error de conexión.", "error");
  }
}


// ----- Reporte de cupones -----

let paginaActualGeneral = 1;
const elementosPorPagina = 15;
let datosGlobales = [];

function renderTablaPaginada(data) {
  datosGlobales = data;
  const tbody = document.querySelector("#tabla-reporte tbody");
  tbody.innerHTML = "";

  const inicio = (paginaActualGeneral - 1) * elementosPorPagina;
  const fin = inicio + elementosPorPagina;
  const paginaDatos = datosGlobales.slice(inicio, fin);

  paginaDatos.forEach(row => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${row.cliente}</td>
      <td>${row.cupon}</td>
      <td>${row.comercio}</td>
      <td>${row.descuento}</td>
      <td>${row.utilizado ? "✅" : "❌"}</td>
      <td>${formatearFecha(row.fecha_compra)}</td>
    `;
    tbody.appendChild(tr);
  });

  actualizarControlesPaginacion();
}

function actualizarControlesPaginacion() {
  const totalPaginas = Math.ceil(datosGlobales.length / elementosPorPagina);
  document.getElementById("pagina-actual").textContent = `Página ${paginaActualGeneral} de ${totalPaginas}`;
  document.getElementById("anterior").disabled = paginaActualGeneral === 1;
  document.getElementById("siguiente").disabled = paginaActualGeneral === totalPaginas;
}

function cambiarPagina(direccion) {
  const totalPaginas = Math.ceil(datosGlobales.length / elementosPorPagina);
  paginaActualGeneral += direccion;
  if (paginaActualGeneral < 1) paginaActualGeneral = 1;
  if (paginaActualGeneral > totalPaginas) paginaActualGeneral = totalPaginas;
  renderTablaPaginada(datosGlobales);
}

function cargarFiltroComercios(data) {
  const select = document.getElementById("filtroComercio");
  const comerciosUnicos = [...new Set(data.map(row => row.comercio))];
  select.innerHTML = `<option value="todos">Todos</option>`;
  comerciosUnicos.forEach(comercio => {
    const option = document.createElement("option");
    option.value = comercio;
    option.textContent = comercio;
    select.appendChild(option);
  });
}

function filtrarCupones() {
  const estado = document.getElementById("filtroEstado").value;
  const comercioSeleccionado = document.getElementById("filtroComercio").value;
  const textoBusqueda = document.getElementById("busqueda").value.toLowerCase();

  const filtrados = datosGlobales.filter(row => {
    const coincideEstado = estado === "todos" || 
      (estado === "usados" && row.utilizado) || 
      (estado === "no_usados" && !row.utilizado);

    const coincideComercio = comercioSeleccionado === "todos" || row.comercio === comercioSeleccionado;
    const coincideBusqueda = row.cliente.toLowerCase().includes(textoBusqueda) || row.cupon.toLowerCase().includes(textoBusqueda);

    return coincideEstado && coincideComercio && coincideBusqueda;
  });

  renderTablaPaginada(filtrados);
}

async function cargarReporte() {
  try {
    const res = await fetch(`${API}/api/admin/reporte-cupones`, { headers: { Authorization: "Bearer " + token } });
    const data = await res.json();
    datosReporte = data;
    cargarFiltroComercios(data);
    renderTablaPaginada(data);
  } catch (err) {
    console.error(err);
    Swal.fire("Error", "No se pudo cargar el reporte", "error");
  }
}


// ----- Generación de códigos -----

async function cargarGruposParaCodigos() {
  try {
    const res = await fetch(`${API}/api/admin/grupos`, { headers: { Authorization: "Bearer " + token } });
    const grupos = await res.json();
    const grupoSelect = document.getElementById("grupoSelectCodigos");
    grupoSelect.innerHTML = `<option value="">-- Selecciona un grupo --</option>`;
    grupos.forEach(g => {
      const option = document.createElement("option");
      option.value = g.id;
      option.textContent = g.nombre;
      grupoSelect.appendChild(option);
    });
  } catch (err) {
    console.error(err);
    Swal.fire("Error", "No se pudieron cargar los grupos para códigos", "error");
  }
}

async function generarCodigos() {
  const grupo_id = document.getElementById("grupoSelectCodigos").value;
  const cantidad = document.getElementById("cantidadCodigos").value;

  if (!grupo_id || !cantidad || cantidad <= 0) {
    return Swal.fire("Error", "Selecciona un grupo y cantidad válida", "warning");
  }

  try {
    const res = await fetch(`${API}/api/admin/codigos`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
      body: JSON.stringify({ grupo_id, cantidad })
    });

    const data = await res.json();

    if (res.ok) {
      Swal.fire("Generados", `${cantidad} códigos generados`, "success");
      mostrarCodigosGenerados(data.codigos);
    } else {
      Swal.fire("Error", data.error || "No se pudieron generar códigos", "error");
    }
  } catch (err) {
    console.error(err);
    Swal.fire("Error", "Error de conexión", "error");
  }
}

function mostrarCodigosGenerados(codigos) {
  const lista = document.getElementById("listaCodigosGenerados");
  lista.innerHTML = "<h4>Códigos Generados:</h4><ul>" +
    codigos.map(c => `<li>${c}</li>`).join("") +
    "</ul>";
}

function mostrarSeccion(seccion) {
  document.querySelectorAll('section, #contenedor-cupones-por-grupo').forEach(el => el.style.display = 'none');

  const secciones = {
    'reporte': 0,
    'vendedores': 1,
    'clientes': 2,
    'asignar': 3,
    'grupos': 4,
    'cupones': 5
  };

  const index = secciones[seccion];
  if (typeof index !== 'undefined') {
    document.querySelectorAll('section')[index].style.display = 'block';
  }

  if (seccion === 'cupones') {
    document.getElementById('contenedor-cupones-por-grupo').style.display = 'block';
  }

  document.querySelectorAll('.sidebar ul li').forEach(li => li.classList.remove('active'));
  document.querySelector(`.sidebar ul li:nth-child(${index + 1})`).classList.add('active');
}

async function cargarVendedores() {
  try {
    const res = await fetch(`${API}/api/admin/vendedores`, {
      headers: { Authorization: "Bearer " + token }
    });
    const vendedores = await res.json();

    // 🔥 AQUI ESTA EL FIX IMPORTANTE
    vendedoresGlobal = vendedores;
    cargarVendedoresParaManual();
    cargarVendedoresParaClientes();

    const tbody = document.querySelector("#tabla-vendedores tbody");
    tbody.innerHTML = "";

    vendedores.forEach(v => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${v.nombre}</td>
        <td>${v.email}</td>
        <td>${v.telefono}</td>
        <td>${v.activo ? "Activo ✅" : "Inactivo ❌"}</td>
        <td>
          <button onclick="cambiarEstadoVendedor(${v.id}, ${v.activo ? 0 : 1})">${v.activo ? "Desactivar" : "Activar"}</button>
        </td>
      `;
      tbody.appendChild(tr);
    });

  } catch (err) {
    console.error(err);
    Swal.fire("Error", "No se pudieron cargar los vendedores", "error");
  }
}

async function cambiarEstadoVendedor(id, nuevoEstado) {
  try {
    const res = await fetch(`${API}/api/admin/vendedores/${id}/estado`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
      body: JSON.stringify({ activo: nuevoEstado })
    });

    const data = await res.json();

    if (res.ok) {
      Swal.fire("Actualizado", "Estado del vendedor actualizado.", "success");
      cargarVendedores(); // recarga la tabla
    } else {
      Swal.fire("Error", data.error || "No se pudo actualizar el estado.", "error");
    }

  } catch (err) {
    console.error(err);
    Swal.fire("Error", "Error de conexión", "error");
  }
}

function cargarVendedoresParaClientes() {
  const vendedorSelector = document.getElementById("vendedorSelector");
  vendedorSelector.innerHTML = `<option value="">-- Elegir --</option>`;
  vendedoresGlobal.forEach(v => {
    const option = document.createElement("option");
    option.value = v.id;
    option.textContent = v.nombre;
    vendedorSelector.appendChild(option);
  });
}

async function verClientesDelVendedor() {
  const vendedorId = document.getElementById("vendedorSelector").value;
  const tbody = document.querySelector("#tabla-clientes-vendedor tbody");
  tbody.innerHTML = "";

  if (!vendedorId) return;

  try {
    const res = await fetch(`${API}/api/admin/vendedores/${vendedorId}/clientes`, {
      headers: { Authorization: "Bearer " + token }
    });

    const clientes = await res.json();

    clientes.forEach(cliente => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${cliente.nombre}</td>
        <td>${cliente.email}</td>
        <td>${cliente.telefono}</td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error(err);
    Swal.fire("Error", "No se pudieron cargar los clientes del vendedor.", "error");
  }
}

async function crearVendedor() {
  const nombre = document.getElementById("vendedor_nombre").value.trim();
  const email = document.getElementById("vendedor_email").value.trim();
  const telefono = document.getElementById("vendedor_telefono").value.trim();

  if (!nombre || !email || !telefono) {
    return Swal.fire("Campos incompletos", "Todos los campos son obligatorios.", "warning");
  }

  try {
    const res = await fetch(`${API}/api/admin/vendedores`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token
      },
      body: JSON.stringify({ nombre, email, telefono })
    });

    const data = await res.json();

    if (res.ok) {
      Swal.fire("Vendedor creado", "El vendedor ha sido registrado correctamente.", "success");
      document.getElementById("formCrearVendedor").reset();
      cargarVendedores();
    } else {
      Swal.fire("Error", data.error || "No se pudo crear el vendedor.", "error");
    }
  } catch (err) {
    console.error(err);
    Swal.fire("Error", "Error de conexión al crear vendedor", "error");
  }
}


document.addEventListener("DOMContentLoaded", () => {
  mostrarSeccion('reporte');  
  lucide.createIcons();

  verificarTokenValido();
  cargarGrupos();
  cargarCuponesAdmin();
  cargarVendedores();
  cargarClientes();
  cargarReporte();
  cargarGruposParaCodigos();
  cargarComercios();

    // Menú hamburguesa
    const menuToggle = document.getElementById("menuToggle");
    const sidebar = document.querySelector(".sidebar");
  
    if (menuToggle && sidebar) {
      menuToggle.addEventListener("click", (e) => {
        e.stopPropagation();
        sidebar.classList.toggle("show");
      });
  
      document.addEventListener("click", (e) => {
        if (sidebar.classList.contains("show") && !sidebar.contains(e.target) && e.target !== menuToggle) {
          sidebar.classList.remove("show");
        }
      });
  
      sidebar.querySelectorAll("li").forEach(li => {
        li.addEventListener("click", () => sidebar.classList.remove("show"));
      });
    }
});