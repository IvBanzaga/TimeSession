// background.js - Service Worker para TimeSession (versión con debug)

chrome.runtime.onStartup.addListener(() => {
    chrome.storage.local.get(['sessions', 'clients', '__backup_sessions', '__backup_clients'], (data) => {
        let needRestore = false;
        const restoreObj = {};

        if ((!data.sessions || data.sessions.length === 0) && data.__backup_sessions?.length) {
            restoreObj.sessions = data.__backup_sessions;
            needRestore = true;
        }

        if ((!data.clients || data.clients.length === 0) && data.__backup_clients?.length) {
            restoreObj.clients = data.__backup_clients;
            needRestore = true;
        }

        if (needRestore) {
            chrome.storage.local.set(restoreObj, () => {
            });
        }
    });
});


// Inicialización
chrome.runtime.onInstalled.addListener(() => {
    chrome.alarms.create('updateIconAlarm', { periodInMinutes: 1 });
});

// Log de storage al arrancar el worker
chrome.storage.local.get(null, (data) => {
    if (data.sessions) {
    }
});

// Mensajería
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {

    if (!request?.action) {
        return;
    }

    // Mapeo de acciones
    const map = {
        deleteClient,
        editClient,
        startSession: function(request, sendResponse) {
            startSession(request, sendResponse);
            return true;
        },
        pauseSession,
        resumeSession,
        endSession,
        startBreak,
        endBreak,
        deleteSession,
        editSession,
        resetData,
        continueSession: () => resetValidationAlarm(),
        showInitialModal: () => showModalInActiveTab('showInitialModal'),
        showBreakModal: () => showModalInActiveTab('showBreakModal'),
        checkState: () => checkState(sendResponse),
        openDashboard: () => openDashboard()
    };

/* TODO: Edita una sesión existente con nuevos datos */
function editSession({ sessionId, description, client, notes }, sendResponse) {
    chrome.storage.local.get(['sessions'], data => {
        const sessions = data.sessions || [];
        const idx = sessions.findIndex(s => s.id === sessionId);
        if (idx === -1) {
            if (sendResponse) sendResponse({ success: false, error: 'Sesión no encontrada' });
            return;
        }
        sessions[idx] = { 
            ...sessions[idx], 
            description, 
            client, 
            notes 
        };
        chrome.storage.local.set({ sessions }, () => {
            if (sendResponse) sendResponse({ success: true, sessions });
        });
    });
    return true; // 👈 importante
}

/* TODO: Edita el nombre de un cliente existente */
function editClient({ clientId, name }, sendResponse) {
    chrome.storage.local.get(['clients'], data => {
        const clients = data.clients || [];
        const idx = clients.findIndex(c => c.id === clientId);
        if (idx === -1) {
            if (sendResponse) sendResponse({ success: false, error: 'Cliente no encontrado' });
            return;
        }
        clients[idx] = { ...clients[idx], name };
        chrome.storage.local.set({ clients }, () => {
            if (sendResponse) sendResponse({ success: true, clients });
        });
    });
    return true; // 👈 importante
}
/* TODO: Abre el dashboard en una nueva pestaña */
function openDashboard() {
    chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html') });
}

    // Acciones que requieren sendResponse asíncrono explícito
    if (request.action === 'addClient') {
        addClient(request, sendResponse);
        return true; // << Importante para respuestas asíncronas
    }

    if (request.action === 'getClients') {
        chrome.storage.local.get('clients', ({ clients = [] }) => {
            sendResponse(clients);
        });
        return true; // << Importante para respuestas asíncronas
    }

    // Acciones con manejo directo
    if (map[request.action]) {
        try {
            const result = map[request.action](request, sendResponse);
            // Si la función maneja asíncrono, debe retornar true
            if (result === true) return true;
        } catch (err) {
            console.error(`TimeSession Background: Error ejecutando ${request.action}:`, err);
            if (sendResponse) sendResponse({ success: false, error: String(err) });
        }
    } else {
    }
});

// Alarmas
chrome.alarms.onAlarm.addListener((alarm) => {
    if (!alarm) return;
    if (alarm.name === 'sessionValidation') {
        showModalInActiveTab('showValidationModal');
    } else if (alarm.name === 'breakOver') {
        endBreak();
        showModalInActiveTab('showInitialModal');
    } else if (alarm.name === 'updateIconAlarm') {
        updateIcon();
    }
});

// Listener para cuando se abren nuevas pestañas
chrome.tabs.onActivated.addListener((activeInfo) => {
    // Pequeño delay para asegurar que el content script se haya cargado
    setTimeout(() => {
        checkAndShowModalIfNeeded(activeInfo.tabId);
    }, 500);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url && !tab.url.startsWith('chrome://')) {
        setTimeout(() => {
            checkAndShowModalIfNeeded(tabId);
        }, 1000);
    }
});

/* TODO: Verifica si se debe mostrar el modal inicial en la pestaña activa */
function checkAndShowModalIfNeeded(tabId) {
    chrome.storage.local.get(['currentSession', 'breakInfo'], (data) => {
        
        // Si no hay sesión activa ni descanso, mostrar modal
        if (!data.currentSession && !data.breakInfo) {
            chrome.tabs.sendMessage(tabId, { action: 'showInitialModal' }, (response) => {
                if (chrome.runtime.lastError) {
                }
            });
        }
    });
}

/* TODO: Normaliza la estructura de los datos en storage */
function normalizeStorage() {
    return new Promise((resolve) => {
        chrome.storage.local.get(['clients', 'sessions', 'currentSession', 'breakInfo', 'config'], (data) => {
            const rawClients = data.clients || [];
            const cleanClients = rawClients.reduce((acc, c) => {
                if (!c) return acc;
                if (typeof c === 'string') acc.push({ id: `client_${Date.now()}_${Math.random().toString(36).slice(2,8)}`, name: c });
                else if (typeof c === 'object' && c.name) acc.push({ id: c.id || `client_${Date.now()}_${Math.random().toString(36).slice(2,8)}`, name: c.name });
                return acc;
            }, []);
            // Solo limpiar clientes, nunca modificar ni filtrar sesiones
            chrome.storage.local.set({
                clients: cleanClients
            }, () => resolve());
        });
    });
}

/* TODO: Elimina un cliente por su ID */
function deleteClient({ clientId }, sendResponse) {
    chrome.storage.local.get('clients', ({ clients = [] }) => {
        const updated = (clients || []).filter(c => c && c.id !== clientId);
        chrome.storage.local.set({ clients: updated }, () => {
            backupStorage();
            if (sendResponse) sendResponse({ success: true, clients: updated });
        });
    });
    return true; // 👈 importante
}

/* TODO: Resetea todos los datos de la extensión a valores iniciales */
function resetData(request, sendResponse) {
    chrome.storage.local.clear(() => {
        chrome.storage.local.set({ clients: [], sessions: [], currentSession: null, breakInfo: null, config: { validationInterval: 60 } }, () => {
            updateIcon();
            if (sendResponse) sendResponse({ success: true });
        });
    });
}

/* TODO: Inicia una nueva sesión y termina el descanso si existe */
function startSession({ session }, sendResponse) {

    try {
        // Terminar descanso activo si existe
        endBreak();

        const timestamp = Date.now();
        const newSession = { 
            ...session,
            id: `sess_${timestamp}`,
            isPaused: false,
            initialDuration: 0,
            pauseTime: null,
            startTime: timestamp
        };

        // Guardar sesión activa
        chrome.storage.local.set({ currentSession: newSession }, () => {
            if (chrome.runtime.lastError) {
                console.error('TimeSession Background: Error guardando currentSession:', chrome.runtime.lastError);
                if (sendResponse) sendResponse({ success: false, error: chrome.runtime.lastError.message });
                return;
            }

            // Configurar alarma de validación
            resetValidationAlarm();
            // Actualizar icono en la barra de extensión
            updateIcon();

            if (sendResponse) sendResponse({ success: true, currentSession: newSession });
        });
    } catch (err) {
        console.error('TimeSession Background: Excepción en startSession:', err);
        if (sendResponse) sendResponse({ success: false, error: String(err) });
    }
}


/* TODO: Pausa la sesión activa */
function pauseSession() {
    chrome.storage.local.get('currentSession', ({ currentSession }) => {
        if (currentSession && !currentSession.isPaused) {
            const elapsed = currentSession.startTime ? (Date.now() - currentSession.startTime) : 0;
            currentSession.initialDuration = (currentSession.initialDuration || 0) + elapsed;
            currentSession.isPaused = true;
            currentSession.pauseTime = Date.now();
            currentSession.startTime = null;
            chrome.storage.local.set({ currentSession }, updateIcon);
        }
    });
}

/* TODO: Reanuda la sesión pausada */
function resumeSession() {
    chrome.storage.local.get('currentSession', ({ currentSession }) => {
        if (currentSession && currentSession.isPaused) {
            currentSession.isPaused = false;
            currentSession.startTime = Date.now();
            currentSession.pauseTime = null;
            chrome.storage.local.set({ currentSession }, updateIcon);
        }
    });
}

/* TODO: Finaliza la sesión activa y la guarda en el historial */
function endSession() {
    chrome.storage.local.get(['currentSession', 'sessions'], (data) => {
        const currentSession = data.currentSession;
        let sessions = Array.isArray(data.sessions) ? [...data.sessions] : [];
        if (!currentSession) {
            console.warn('TimeSession Background: No hay sesión actual para finalizar');
            return;
        }
        let finalDuration = currentSession.initialDuration || 0;
        if (!currentSession.isPaused && currentSession.startTime) finalDuration += (Date.now() - currentSession.startTime);
        const finalSession = { ...currentSession, endTime: Date.now(), duration: finalDuration };
    // Remove runtime-only fields, pero conservar startTime para historial
    delete finalSession.isPaused; delete finalSession.initialDuration; delete finalSession.pauseTime;
        sessions.push(finalSession);
        chrome.storage.local.set({ sessions, currentSession: null }, () => {
            chrome.storage.local.get(['sessions'], (d) => {
                if (!d.sessions || d.sessions.length === 0) {
                    console.error('TimeSession Background: ¡Error! La sesión no se guardó correctamente.');
                } else {
                }
            });
            chrome.alarms.clear('sessionValidation');
            backupStorage();
            updateIcon();
        });
    });
}

/* TODO: Inicia un descanso por la cantidad de minutos indicada */
function startBreak({ minutes }, sendResponse) {
    endSession(); // Terminar sesión activa si existe
    const mins = typeof minutes === 'number' && minutes > 0 ? minutes : 15;
    const breakInfo = { endTime: Date.now() + mins * 60000, duration: mins };
    chrome.storage.local.set({ breakInfo }, () => {
        chrome.alarms.create('breakOver', { delayInMinutes: mins });
        updateIcon();
        if (sendResponse) sendResponse({ success: true, breakInfo });
    });
}

/* TODO: Finaliza el descanso activo */
function endBreak() {
    chrome.storage.local.set({ breakInfo: null }, () => {
        chrome.alarms.clear('breakOver');
        updateIcon();
    });
}

/* TODO: Elimina una sesión del historial por su ID */
function deleteSession({ sessionId }, sendResponse) {
    chrome.storage.local.get('sessions', ({ sessions = [] }) => {
        const filtered = (sessions || []).filter(s => String(s.id) !== String(sessionId));
        chrome.storage.local.set({ sessions: filtered }, () => {
            if (sendResponse) sendResponse({ success: true });
        });
    });
    return true; // 👈 importante para canal asíncrono
}

/* TODO: Obtiene datos de storage por clave */
function getFromStorage(key, sendResponse) {
    chrome.storage.local.get(key, (data) => sendResponse(data[key] || []));
}

/* TODO: Devuelve el estado actual de la sesión y descanso */
function checkState(sendResponse) {
    chrome.storage.local.get(['currentSession', 'breakInfo'], (data) => {
        sendResponse({
            currentSession: data.currentSession || null,
            breakInfo: data.breakInfo || null,
            shouldShowInitial: !data.currentSession && !data.breakInfo
        });
    });
    return true; // Para mantener el canal de respuesta abierto
}

/* TODO: Reinicia la alarma de validación de sesión */
function resetValidationAlarm() {
    chrome.storage.local.get('config', ({ config = {} }) => {
        const interval = (config && config.validationInterval) || 60;
        chrome.alarms.clear('sessionValidation');
        chrome.alarms.create('sessionValidation', { delayInMinutes: interval });
    });
}

/* TODO: Muestra el modal correspondiente en la pestaña activa */
function showModalInActiveTab(action) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (!tabs || !tabs[0] || !tabs[0].id) {
            return;
        }
        const url = tabs[0].url || '';
        if (url.startsWith('chrome://') || url.startsWith('https://chrome.google.com')) {
            return;
        }
        console.log('TimeSession Background: Enviando mensaje a pestaña:', tabs[0].id);
        chrome.tabs.sendMessage(tabs[0].id, { action }, (response) => {
            if (chrome.runtime.lastError) {
                console.log('TimeSession Background: Error enviando mensaje (normal):', chrome.runtime.lastError.message);
            }
        });
    });
}

/* TODO: Actualiza el icono y badge de la extensión según el estado */
function updateIcon() {
    chrome.storage.local.get(['currentSession', 'breakInfo'], (data) => {
        const cs = data && data.currentSession;
        const bi = data && data.breakInfo;
        if (cs) {
            let elapsedMs = cs.initialDuration || 0;
            if (!cs.isPaused && cs.startTime) elapsedMs += (Date.now() - cs.startTime);
            const elapsedMinutes = Math.floor(elapsedMs / 60000);
            chrome.action.setBadgeText({ text: `${elapsedMinutes}m` });
            chrome.action.setBadgeBackgroundColor({ color: cs.isPaused ? '#FFA500' : '#4CAF50' });
        } else if (bi) {
            const remainingMs = Math.max(0, (bi.endTime || 0) - Date.now());
            const remainingMinutes = Math.max(0, Math.ceil(remainingMs / 60000));
            chrome.action.setBadgeText({ text: `${remainingMinutes}m` });
            chrome.action.setBadgeBackgroundColor({ color: '#FF9800' });
        } else {
            chrome.action.setBadgeText({ text: '' });
        }
    });
}

/* TODO: Guarda un respaldo de los datos críticos en storage */
function backupStorage() {
    chrome.storage.local.get(['sessions', 'clients'], (data) => {
        chrome.storage.local.set({
            __backup_sessions: data.sessions || [],
            __backup_clients: data.clients || []
        }, () => {
            console.log('TimeSession: Backup de storage guardado');
        });
    });
}


console.log('TimeSession Background: Service Worker cargado');