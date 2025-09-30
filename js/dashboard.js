// dashboard.js - JavaScript optimizado para el dashboard


// Variable global para sesiones
let sessions = [];
let filteredSessions = null;
let currentSessionPage = 1;
const SESSIONS_PER_PAGE = 5;

document.addEventListener('DOMContentLoaded', () => {
    // MODO OSCURO: cargar preferencia y aplicar
    chrome.storage.local.get(['darkMode'], (data) => {
        if (data.darkMode) {
            document.body.classList.add('dark-mode');
        }
    });
    // Listener para el botón de modo oscuro
    const darkBtn = document.getElementById('darkModeBtn');
    if (darkBtn) {
        darkBtn.addEventListener('click', () => {
            const isDark = document.body.classList.toggle('dark-mode');
            chrome.storage.local.set({ darkMode: isDark });
            darkBtn.textContent = isDark ? '☀️ Modo Claro' : '🌙 Modo Oscuro';
        });
        // Cambiar texto según estado inicial
        chrome.storage.local.get(['darkMode'], (data) => {
            darkBtn.textContent = data.darkMode ? '☀️ Modo Claro' : '🌙 Modo Oscuro';
        });
    }
    if (typeof debugStorage === 'function') debugStorage();

    // Log completo de storage al cargar el dashboard
    chrome.storage.local.get(null, (data) => {
    });

    loadDashboardData();

    // Listeners para control de sesión
    const pauseBtn = document.getElementById('csPauseBtn');
    const resumeBtn = document.getElementById('csResumeBtn');
    const endBtn = document.getElementById('csEndBtn');

    if (pauseBtn) {
        pauseBtn.addEventListener('click', () => {
            chrome.runtime.sendMessage({ action: 'pauseSession' }, () => {
                pauseBtn.style.display = 'none';
                resumeBtn.style.display = 'inline-block';
            });
        });
    }
    if (resumeBtn) {
        resumeBtn.addEventListener('click', () => {
            chrome.runtime.sendMessage({ action: 'resumeSession' }, () => {
                resumeBtn.style.display = 'none';
                pauseBtn.style.display = 'inline-block';
            });
        });
    }
    if (endBtn) {
        endBtn.addEventListener('click', () => {
            chrome.runtime.sendMessage({ action: 'endSession' }, () => {
                document.getElementById('currentSessionBar').style.display = 'none';
                loadDashboardData();
            });
        });
    }
    // Mostrar barra de sesión o descanso actual (función reutilizable)
    let sessionTimerInterval = null;
    function updateSessionBar() {
        chrome.storage.local.get(['currentSession', 'breakInfo'], data => {
            const bar = document.getElementById('currentSessionBar');
            if (!bar) return;
            if (data.breakInfo) {
                // Mostrar barra de descanso
                bar.style.display = 'block';
                bar.innerHTML = `
                    <div style="background: #fff; padding: 16px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.06); display:flex; justify-content:space-between; align-items:center;">
                        <div>
                            <div style="font-weight:600;">☕ Descanso activo</div>
                            <div style="color:#666; font-size:14px;">Tiempo restante</div>
                        </div>
                        <div style="text-align:right">
                            <div id="breakTime" style="font-weight:700; font-size:18px; color:#ff9800;">${getBreakTime(data.breakInfo)}</div>
                            <div style="margin-top:8px; display:flex; gap:8px; justify-content:flex-end;">
                                <button id="endBreakBtn" class="btn-small btn-danger">⏹️ Finalizar descanso</button>
                            </div>
                        </div>
                    </div>
                `;
                document.getElementById('endBreakBtn').onclick = () => {
                    chrome.runtime.sendMessage({ action: 'endBreak' }, () => {
                        bar.style.display = 'none';
                        loadDashboardData();
                    });
                };
                if (sessionTimerInterval) clearInterval(sessionTimerInterval);
            } else if (data.currentSession) {
                // Mostrar barra de sesión normal (ya está en el HTML)
                bar.style.display = 'block';
                // Iniciar temporizador para actualizar el tiempo
                if (sessionTimerInterval) clearInterval(sessionTimerInterval);
                sessionTimerInterval = setInterval(() => {
                    const csTime = document.getElementById('csTime');
                    if (!csTime) return;
                    let elapsed = data.currentSession.initialDuration || 0;
                    if (!data.currentSession.isPaused && data.currentSession.startTime) {
                        elapsed += Date.now() - data.currentSession.startTime;
                    }
                    const totalSeconds = Math.floor(elapsed / 1000);
                    csTime.textContent = formatDuration(totalSeconds);
                }, 1000);
            } else {
                bar.style.display = 'none';
                if (sessionTimerInterval) clearInterval(sessionTimerInterval);
            }
        });
    }

    function formatDuration(totalSeconds) {
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;

        // Formatear para que siempre tenga 2 dígitos
        const hStr = hours.toString().padStart(2, '0');
        const mStr = minutes.toString().padStart(2, '0');
        const sStr = seconds.toString().padStart(2, '0');

        return `${hStr}:${mStr}:${sStr}`;
    }

    // Llamar al cargar
    updateSessionBar();
    // Escuchar cambios en el storage para breakInfo y currentSession
    chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'local' && (changes.breakInfo || changes.currentSession)) {
            updateSessionBar();
        }
    });
    /* TODO: Devuelve el tiempo restante del descanso activo en formato mm:ss */
    function getBreakTime(breakInfo) {
        if (!breakInfo || !breakInfo.endTime) return '';
        const ms = breakInfo.endTime - Date.now();
        if (ms <= 0) return '0m 00s';
        const min = Math.floor(ms / 60000);
        const sec = Math.floor((ms % 60000) / 1000);
        return `${min}m ${sec.toString().padStart(2, '0')}s`;
    }

    document.getElementById('exportBtn').addEventListener('click', exportToCSV);
    document.getElementById('cleanDataBtn').addEventListener('click', cleanCorruptedData);
    document.getElementById('resetAllBtn').addEventListener('click', resetAllData);
    document.getElementById('addClientBtn').addEventListener('click', addClient);

    // Importar datos
    document.getElementById('importBtn').addEventListener('click', () => {
        document.getElementById('importFileInput').click();
    });
    document.getElementById('importFileInput').addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = function(evt) {
            let importedData;
            try {
                if (file.name.endsWith('.json')) {
                    importedData = JSON.parse(evt.target.result);
                } else if (file.name.endsWith('.csv')) {
                    importedData = parseCSV(evt.target.result);
                } else {
                    alert('Formato no soportado. Usa JSON o CSV.');
                    return;
                }
            } catch (err) {
                alert('Error al leer el archivo: ' + err.message);
                return;
            }
            // Validar y convertir datos importados
            function parseEuropeanDate(dateStr, timeStr) {
                // dateStr: '29/9/2025', timeStr: '19:30:18'
                const [d, m, y] = dateStr.split('/').map(Number);
                const [hh, mm, ss] = timeStr.split(':').map(Number);
                return new Date(y, m - 1, d, hh, mm, ss).getTime();
            }
            function normalizeSession(s) {
                // Convertir campos a tipos correctos
                const session = { ...s };
                // Si vienen como Fecha, Inicio, Fin (formato europeo)
                if (session.Fecha && session.Inicio && session.Fecha.includes('/') && session.Inicio.includes(':')) {
                    session.startTime = parseEuropeanDate(session.Fecha, session.Inicio);
                }
                if (session.Fecha && session.Fin && session.Fecha.includes('/') && session.Fin.includes(':')) {
                    session.endTime = parseEuropeanDate(session.Fecha, session.Fin);
                }
                // Si vienen como string estándar
                if (typeof session.startTime === 'string') session.startTime = Date.parse(session.startTime);
                if (typeof session.endTime === 'string') session.endTime = Date.parse(session.endTime);
                if (typeof session.duration === 'string') session.duration = parseInt(session.duration, 10);
                if (session.startTime && session.endTime && (!session.duration || isNaN(session.duration))) {
                    session.duration = session.endTime - session.startTime;
                }
                // Normalizar tipo y descripción
                if (!session.type && session.Tipo) session.type = session.Tipo.toLowerCase();
                if (!session.description && session.Descripción) session.description = session.Descripción;
                if (!session.client && session.Cliente) session.client = session.Cliente;
                if (!session.id && session.ID) session.id = session.ID;
                if (!session.id) session.id = `imported_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
                return session;
            }
            function normalizeClient(c) {
                const client = { ...c };
                if (!client.id) client.id = `imported_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
                if (!client.name && client.Cliente) client.name = client.Cliente;
                return client;
            }
            // Si es objeto con sesiones y/o clientes
            if (importedData.sessions && Array.isArray(importedData.sessions)) {
                const normSessions = importedData.sessions.map(normalizeSession);
                const validSessions = normSessions.filter(s => typeof s.startTime === 'number' && typeof s.endTime === 'number' && !isNaN(s.startTime) && !isNaN(s.endTime));
                console.log('Sesiones importadas:', normSessions);
                console.log('Sesiones válidas:', validSessions);
                chrome.storage.local.set({ sessions: normSessions }, () => {
                    alert(`Sesiones importadas: ${normSessions.length}\nSesiones válidas para historial: ${validSessions.length}`);
                    loadDashboardData();
                });
            }
            if (importedData.clients && Array.isArray(importedData.clients)) {
                const normClients = importedData.clients.map(normalizeClient);
                console.log('Clientes importados:', normClients);
                chrome.storage.local.set({ clients: normClients }, () => {
                    alert(`Clientes importados: ${normClients.length}`);
                    loadDashboardData();
                });
            }
            // Si es solo sesiones (CSV o array)
            if (Array.isArray(importedData) && importedData.length && importedData[0].id) {
                const normSessions = importedData.map(normalizeSession);
                const validSessions = normSessions.filter(s => typeof s.startTime === 'number' && typeof s.endTime === 'number' && !isNaN(s.startTime) && !isNaN(s.endTime));
                console.log('Sesiones importadas:', normSessions);
                console.log('Sesiones válidas:', validSessions);
                chrome.storage.local.set({ sessions: normSessions }, () => {
                    alert(`Sesiones importadas: ${normSessions.length}\nSesiones válidas para historial: ${validSessions.length}`);
                    loadDashboardData();
                });
            }
        };
        reader.readAsText(file);
    });

    // Función para parsear CSV a array de sesiones
    function parseCSV(csv) {
        const lines = csv.split('\n').filter(l => l.trim().length > 0);
        const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());
        return lines.slice(1).map(line => {
            const values = line.split(',').map(v => v.replace(/"/g, '').trim());
            const obj = {};
            headers.forEach((h, i) => {
                obj[h] = values[i];
            });
            // Convertir campos numéricos
            if (obj['ID']) obj.id = obj['ID'];
            if (obj['Inicio']) obj.startTime = new Date(`${obj['Fecha']} ${obj['Inicio']}`).getTime();
            if (obj['Fin']) obj.endTime = new Date(`${obj['Fecha']} ${obj['Fin']}`).getTime();
            if (obj['Duración (minutos)']) obj.duration = parseInt(obj['Duración (minutos)'], 10) * 60000;
            obj.type = obj['Tipo'] || '';
            obj.description = obj['Descripción'] || '';
            obj.client = obj['Cliente'] || '';
            return obj;
        });
    }

    // Abrir página de opciones/configuración
    const optionsBtn = document.getElementById('openOptionsBtn');
    if (optionsBtn) {
        optionsBtn.addEventListener('click', () => {
            if (chrome.runtime.openOptionsPage) {
                chrome.runtime.openOptionsPage();
            } else {
                window.open(chrome.runtime.getURL('options.html'));
            }
        });
    }
});

/* TODO: Añade listeners a los botones del modal principal */
function addModalListeners() {
    modal.querySelectorAll('.option-btn').forEach(btn => {
        btn.onclick = () => handleActivitySelection(btn.dataset.type);
    });

    // Aquí se conecta el botón “Agregar” con la función addNewClient
    modal.querySelector('#addClientBtn').onclick = addNewClient;

    modal.querySelector('#startBtn').onclick = startSession;
    modal.querySelector('#cancelBtn').onclick = resetModalView;
    modal.querySelector('#startBreakBtn').onclick = startBreak;
    modal.querySelector('#cancelBreakBtn').onclick = resetModalView;
}



/* TODO: Carga los datos de sesiones y clientes y actualiza la vista del dashboard */
function loadDashboardData() {
    chrome.storage.local.get(['sessions', 'clients'], (data) => {
    sessions = data.sessions || [];
    filteredSessions = null;
    currentSessionPage = 1; // Reiniciar a la primera página al cargar
        const clients = data.clients || [];


        updateStats(sessions, clients);
        renderClientsList(clients);
        updateClientSelect(clients);
        renderSessionsList(sessions);
    });
}

/* TODO: Actualiza las estadísticas principales del dashboard */
function updateStats(sessions, clients) {
    // Filtrar sesiones finalizadas (tienen endTime y duration)
    const completedSessions = sessions.filter(s => s.endTime && typeof s.duration === 'number');
    const totalTimeMins = completedSessions.reduce((sum, s) => sum + Math.round(s.duration / (1000 * 60)), 0);
    let totalTimeHours = 0;
    let avgSessionMins = 0;
    if (completedSessions.length > 0 && totalTimeMins > 0) {
        totalTimeHours = Math.round(totalTimeMins / 60 * 10) / 10;
        avgSessionMins = Math.round(totalTimeMins / completedSessions.length);
    }
    document.getElementById('totalSessions').textContent = completedSessions.length;
    document.getElementById('totalTime').textContent = (isNaN(totalTimeHours) ? 0 : totalTimeHours) + 'h';
    document.getElementById('totalClients').textContent = clients.length;
    document.getElementById('avgSession').textContent = (isNaN(avgSessionMins) ? 0 : avgSessionMins) + 'm';
}

/* TODO: Renderiza la lista de sesiones en el dashboard */
function renderSessionsList(sessions) {
    const container = document.getElementById('sessionsList');
    // Usar sesiones filtradas si hay búsqueda activa
    const sourceSessions = filteredSessions !== null ? filteredSessions : sessions;
    if (!sourceSessions || sourceSessions.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <h3>🕐 No hay sesiones registradas</h3>
                <p>Inicia tu primera sesión para ver el historial aquí</p>
            </div>`;
        return;
    }

    // Filtrar y ordenar sesiones finalizadas
    const allSessions = sourceSessions.filter(s => s.endTime)
        .sort((a, b) => b.startTime - a.startTime);
    const totalPages = Math.max(1, Math.ceil(allSessions.length / SESSIONS_PER_PAGE));
    // Limitar a la página actual
    const startIdx = (currentSessionPage - 1) * SESSIONS_PER_PAGE;
    const pageSessions = allSessions.slice(startIdx, startIdx + SESSIONS_PER_PAGE);

    container.innerHTML = '';
    pageSessions.forEach(session => {
        let duration = 0;
        if (typeof session.startTime === 'number' && typeof session.endTime === 'number') {
            duration = Math.round((session.endTime - session.startTime) / (1000 * 60));
            if (isNaN(duration) || duration < 0) duration = 0;
        }
        const startDate = new Date(session.startTime);
        const endDate = new Date(session.endTime);

        const sessionItem = document.createElement('div');
        sessionItem.className = 'session-item';
        sessionItem.innerHTML = `
            <div class="session-info" style="display: flex; align-items: center; gap: 16px;">
                <div>
                    <div class="session-title">${getTypeIcon(session.type)} ${getTypeLabel(session.type)}</div>
                    <div class="session-meta">
                        ${startDate.toLocaleDateString('es-ES')} • 
                        ${startDate.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })} - 
                        ${endDate.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                        ${session.client ? ` • Cliente: ${session.client}` : ''}
                    </div>
                </div>
                <div class="session-description-box" style="background: #f8f9fa; border-radius: 8px; padding: 8px 16px; min-width: 120px; color: #333; font-size: 14px; text-align: center; align-self: center;">${session.description ? session.description : ''}</div>
            </div>
            <div class="session-actions">
                <div class="session-duration">${formatMinutes(duration)}</div>
                <div style="display: flex; gap: 5px; margin-top: 5px;">
                    <button class="btn-small btn-danger delete-session-btn" data-session-id="${session.id}">🗑️ Eliminar</button>
                    <button class="btn-small edit-session-btn" data-session-id="${session.id}">✏️ Editar</button>
                </div>
            </div>`;
        container.appendChild(sessionItem);
    });

    // Controles de paginación
    if (totalPages > 1) {
        const pagination = document.createElement('div');
        pagination.className = 'pagination-controls';
        pagination.style = 'display: flex; justify-content: center; align-items: center; gap: 10px; margin: 20px 0;';
        pagination.innerHTML = `
            <button id="prevSessionPage" class="btn" ${currentSessionPage === 1 ? 'disabled' : ''}>⬅️ Anterior</button>
            <span>Página ${currentSessionPage} de ${totalPages}</span>
            <button id="nextSessionPage" class="btn" ${currentSessionPage === totalPages ? 'disabled' : ''}>Siguiente ➡️</button>
        `;
        container.appendChild(pagination);

        // Listeners de paginación
        document.getElementById('prevSessionPage').onclick = () => {
            if (currentSessionPage > 1) {
                currentSessionPage--;
                renderSessionsList(sessions);
            }
        };
        document.getElementById('nextSessionPage').onclick = () => {
            if (currentSessionPage < totalPages) {
                currentSessionPage++;
                renderSessionsList(sessions);
            }
        };
    }

    createTimeChart(sourceSessions.filter(s => s.endTime));
    // Listener para búsqueda en el historial
    const searchInput = document.getElementById('sessionSearchInput');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const value = e.target.value.trim().toLowerCase();
            if (value.length === 0) {
                filteredSessions = null;
            } else {
                filteredSessions = sessions.filter(s => {
                    // Buscar en descripción, cliente y tipo
                    return (
                        (s.description && s.description.toLowerCase().includes(value)) ||
                        (s.client && s.client.toLowerCase().includes(value)) ||
                        (s.type && getTypeLabel(s.type).toLowerCase().includes(value))
                    );
                });
            }
            currentSessionPage = 1;
            renderSessionsList(sessions);
        });
    }
}

/* TODO: Devuelve el icono correspondiente al tipo de sesión */
function getTypeIcon(type) {
    const icons = { personal: '👤', client: '💼', learning: '📚', programming: '💻' };
    return icons[type] || '📝';
}

/* TODO: Devuelve la etiqueta legible para el tipo de sesión */
function getTypeLabel(type) {
    const labels = { personal: 'Para mí', client: 'Cliente', learning: 'Aprendizaje', programming: 'Programando' };
    return labels[type] || type;
}

/* TODO: Exporta las sesiones a un archivo CSV descargable */
function exportToCSV() {
    chrome.storage.local.get(['sessions'], (data) => {
        const sessions = data.sessions || [];
        if (sessions.length === 0) return alert('No hay sesiones para exportar');

        const headers = ['ID', 'Fecha', 'Inicio', 'Fin', 'Tipo', 'Descripción', 'Cliente', 'Duración (minutos)'];
        const rows = sessions.filter(s => s.endTime).map(s => {
            const duration = Math.round((s.endTime - s.startTime) / (1000 * 60));
            const startDate = new Date(s.startTime);
            const endDate = new Date(s.endTime);
            return [s.id, startDate.toLocaleDateString('es-ES'), startDate.toLocaleTimeString('es-ES'),
            endDate.toLocaleTimeString('es-ES'), getTypeLabel(s.type), s.description || '', s.client || '', duration];
        });

        const csvContent = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `time_session_export_${new Date().toISOString().split('T')[0]}.csv`;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    });
}

/* TODO: Elimina una sesión del historial por su ID */
function deleteSession(sessionId) {
    if (!confirm('¿Estás seguro de que quieres eliminar esta sesión?')) return;
    chrome.runtime.sendMessage({ action: 'deleteSession', sessionId: String(sessionId) }, () => {
        // Esperar un poco y recargar la lista, ignorar error de respuesta
        setTimeout(() => {
            loadDashboardData();
        }, 200);
    });
}

/* TODO: Edita los datos de una sesión existente */
function editSession(sessionId) {
    chrome.storage.local.get(['sessions'], data => {
        const sessions = data.sessions || [];
        const session = sessions.find(s => s.id === sessionId);
        if (!session) return alert('Sesión no encontrada');

        const newDescription = prompt('Tarea:', session.description || '');
        if (newDescription === null) return;
        const newClient = prompt('Cliente:', session.client || '');
        if (newClient === null) return;
        const newNotes = prompt('Descripción:', session.notes || '');
        if (newNotes === null) return;

        chrome.runtime.sendMessage({
            action: 'editSession',
            sessionId,
            description: newDescription,
            client: newClient,
            notes: newNotes
        }, response => {
            if (response?.success) {
                loadDashboardData();
            } else {
                alert('Error al editar la sesión');
            }
        });
    });
}

/* TODO: Renderiza la lista de clientes en el dashboard */
function renderClientsList(clients) {
    const container = document.getElementById('clientsList');
    if (!clients || clients.length === 0) {
        container.innerHTML = `<div class="empty-state"><p>👥 No hay clientes registrados</p></div>`;
        return;
    }

    container.innerHTML = '';
    clients.forEach(client => {
        const clientItem = document.createElement('div');
        clientItem.className = 'client-item';
        clientItem.innerHTML = `
            <div class="client-name">👤 ${client.name}</div>
            <div class="client-actions">
                <button class="btn-small btn-danger delete-client-btn" data-client-id="${client.id}">🗑️ Eliminar</button>
                <button class="btn-small btn-primary edit-client-btn" data-client-id="${client.id}">✏️ Editar</button>
            </div>`;
        container.appendChild(clientItem);
    });
}


/* TODO: Actualiza el select de clientes en el formulario de sesión */
function updateClientSelect(clients) {
    const select = document.getElementById('selectClient');
    if (!select) return;

    select.innerHTML = '<option value="">Seleccionar cliente</option>';
    clients.forEach(client => {
        const opt = document.createElement('option');
        opt.value = client.name;
        opt.textContent = client.name;
        select.appendChild(opt);
    });
}

/* TODO: Añade un nuevo cliente a la lista */
function addClient() {
    const input = document.getElementById('newClientName');
    if (!input) return alert('Error: No se encontró el campo de texto para el cliente');

    const clientName = input.value.trim();
    if (!clientName) return alert('Por favor ingresa un nombre para el cliente');

    const clientId = `client_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    chrome.storage.local.get(['clients'], data => {
        const clients = data.clients || [];
        clients.push({ id: clientId, name: clientName });
        chrome.storage.local.set({ clients }, () => {
            input.value = '';
            loadDashboardData(); // recarga la lista de clientes
            alert('Cliente agregado: ' + clientName);
        });
    });
}

/* TODO: Edita el nombre de un cliente existente */
function editClient(clientId) {
    if (!clientId) return alert('ID de cliente inválido');
    chrome.storage.local.get(['clients'], data => {
        const clients = data.clients || [];
        const client = clients.find(c => c.id === clientId);
        if (!client) return alert('Cliente no encontrado');

        const newName = prompt('Editar nombre del cliente:', client.name);
        if (newName === null) return; // Cancelado

        chrome.runtime.sendMessage({
            action: 'editClient',
            clientId,
            name: newName.trim()
        }, response => {
            if (response?.success) {
                loadDashboardData();
            } else {
                alert('Error al editar el cliente');
            }
        });
    });
}




/* TODO: Elimina un cliente por su ID */
function deleteClient(clientId) {
    if (!confirm('¿Estás seguro de que quieres eliminar este cliente?')) return;
    chrome.runtime.sendMessage({ action: 'deleteClient', clientId }, response => {
        if (response?.success) {
            loadDashboardData();
        } else {
            alert('Error al eliminar el cliente');
        }
    });
}


// Gráfico
let timeChart = null;

/* TODO: Crea y renderiza el gráfico de barras de tiempo por tipo de sesión */
function createTimeChart(sessions) {
    if (typeof Chart === 'undefined') return console.error('Chart.js no está disponible');

    const canvas = document.getElementById('timeChart');
    if (!canvas) return console.error('Canvas para gráfico no encontrado');
    const ctx = canvas.getContext('2d');

    if (timeChart) timeChart.destroy();

    if (!sessions || sessions.length === 0) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.font = '16px Arial';
        ctx.fillStyle = '#666';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('No hay datos para mostrar', canvas.width / 2, canvas.height / 2);
        return;
    }

    // Agrupar tiempos por tipo
    const timeByType = {};
    sessions.forEach(s => {
        const type = s.type || 'Otros';
        let duration = 0;
        if (typeof s.duration === 'number') duration = s.duration / 60000; // minutos
        else if (s.startTime && s.endTime) duration = (new Date(s.endTime) - new Date(s.startTime)) / 60000;
        if (duration > 0) timeByType[type] = (timeByType[type] || 0) + duration;
    });

    const labels = Object.keys(timeByType).map(getTypeLabel);
    const data = Object.values(timeByType);
    const backgroundColor = generateColors(labels.length);

    // Crear gráfico de barras
    timeChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                label: 'Tiempo total (minutos)',
                data,
                backgroundColor,
                borderColor: '#333',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: ctx => {
                            const minutes = ctx.parsed.y;
                            return `${ctx.label}: ${formatMinutes(minutes)} (${Math.round(minutes)} min)`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: { display: true, text: 'Minutos' }
                },
                x: {
                    title: { display: true, text: 'Tipo de sesión' }
                }
            }
        }
    });
}


/* TODO: Filtra las sesiones según el rango de fechas seleccionado */
function filterSessionsByRange(sessions, range) {
    const now = new Date();
    return sessions.filter(s => {
        const start = new Date(s.startTime);
        if (range === 'day') return start.toDateString() === now.toDateString();
        if (range === 'week') {
            const weekStart = new Date(now);
            weekStart.setDate(now.getDate() - now.getDay());
            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekStart.getDate() + 6);
            return start >= weekStart && start <= weekEnd;
        }
        if (range === 'month') return start.getMonth() === now.getMonth() && start.getFullYear() === now.getFullYear();
        return true;
    });
}

/* TODO: Formatea minutos en formato Xh Ym */
function formatMinutes(minutes) {
    const h = Math.floor(minutes / 60);
    const m = Math.round(minutes % 60);
    return `${h}h ${m}m`;
}

/* TODO: Genera una paleta de colores HSL para el gráfico */
function generateColors(n) {
    const colors = [];
    for (let i = 0; i < n; i++) {
        const hue = i * (360 / n);
        colors.push(`hsl(${hue}, 70%, 60%)`);
    }
    return colors;
}


// Inicializar select y evento después de cargar el DOM
document.addEventListener('DOMContentLoaded', () => {
    const chartRange = document.getElementById('chartRange');
    if (chartRange) {
        chartRange.addEventListener('change', () => {
            const filtered = filterSessionsByRange(sessions, chartRange.value);
            createTimeChart(filtered);
        });
    }
    // Llamar inicialmente el gráfico solo si hay sesiones cargadas
    createTimeChart(sessions);
});



/* TODO: Limpia datos corruptos de clientes y sesiones en storage */
function cleanCorruptedData() {
    if (!confirm('¿Estás seguro de limpiar datos corruptos? Esta acción no se puede deshacer.')) return;
    chrome.storage.local.get(['clients', 'sessions'], data => {
        const cleanClients = (data.clients || []).filter(c => c?.id && c?.name);
        const cleanSessions = (data.sessions || []).filter(s => s?.id && s?.startTime);

        chrome.storage.local.set({ clients: cleanClients, sessions: cleanSessions }, () => {
            alert(`Limpieza completada:\n- ${data.clients.length - cleanClients.length} clientes corruptos eliminados\n- ${data.sessions.length - cleanSessions.length} sesiones corruptas eliminadas`);
            loadDashboardData();
        });
    });
}

// Event listeners dinámicos
document.addEventListener('click', e => {
    if (e.target.classList.contains('edit-session-btn')) editSession(e.target.dataset.sessionId);
    if (e.target.classList.contains('delete-session-btn')) deleteSession(e.target.dataset.sessionId);
    if (e.target.classList.contains('edit-client-btn')) editClient(e.target.dataset.clientId); // ✅ AGREGADO
    if (e.target.classList.contains('delete-client-btn')) deleteClient(e.target.dataset.clientId);
});


/* TODO: Elimina todos los datos y reinicia la extensión */
function resetAllData() {
    if (!confirm('⚠️ Esto eliminará TODOS los datos. ¿Continuar?')) return;
    if (!confirm('🚨 ÚLTIMA CONFIRMACIÓN: Se perderán TODOS los datos permanentemente. ¿Continuar?')) return;

    chrome.runtime.sendMessage({ action: 'resetData' }, response => {
        if (response?.success) {
            alert('✅ Todos los datos han sido eliminados.');
            window.location.reload();
        } else alert('❌ Error al reiniciar los datos');
    });
}
