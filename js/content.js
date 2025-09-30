// content.js - Script de contenido para TimeSession (versión con debug)
(function () {
    if (window.hasRun) return;
    window.hasRun = true;

    let modal = null;
    let validationModal = null;
    let selectedType = null;

    // --- INACTIVIDAD ---
    let inactivityTimer = null;
    let inactivityInterval = 60; // minutos por defecto

    // Leer intervalo de validación desde la configuración
    chrome.storage.local.get('config', ({ config = {} }) => {
        if (typeof config.validationInterval === 'number') {
            inactivityInterval = config.validationInterval;
        }
    });

    // Modal de pausa por inactividad
    let inactivityModal = null;
    let inactivityModalIsDark = null;
    function renderInactivityModal(isDark) {
        if (!inactivityModal) return;
        inactivityModal.innerHTML = `
            <div class="timesession-overlay" style="position: fixed; inset: 0; width: 100vw; height: 100vh; background: ${isDark ? 'rgba(30,30,30,0.55)' : 'rgba(0,0,0,0.25)'}; z-index: 2147483646;"></div>
            <div class="timesession-modal" style="position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); max-width: 340px; min-width: 260px; z-index: 2147483647; background: ${isDark ? '#222' : '#fff'}; color: ${isDark ? '#eee' : '#222'}; border-radius: 14px; box-shadow: 0 8px 32px rgba(0,0,0,0.22); padding: 36px 28px; display: flex; flex-direction: column; align-items: center;">
                <h2 style="margin-bottom: 18px; text-align:center; color:white">⏸️ Tiempo detenido por inactividad</h2>
                <p style="margin-bottom: 18px; color: ${isDark ? '#bbb' : '#555'}; text-align:center;">La sesión se ha pausado automáticamente.<br>¿Quieres reanudar el conteo?</p>
                <div style="display: flex; gap: 12px; justify-content: center;">
                    <button id="resumeInactivityBtn" class="btn btn-primary">▶️ Reanudar</button>
                    <button id="acceptInactivityBtn" class="btn btn-secondary">Aceptar</button>
                </div>
            </div>
        `;
        document.body.style.overflow = 'hidden';
        inactivityModal.querySelector('#resumeInactivityBtn').onclick = function() {
            chrome.runtime.sendMessage({ action: 'resumeSession' }, () => {
                hideInactivityModal();
                resetInactivityTimer();
            });
        };
        inactivityModal.querySelector('#acceptInactivityBtn').onclick = function() {
            hideInactivityModal();
        };
    }

    function showInactivityModal() {
        if (inactivityModal) return;
        inactivityModal = document.createElement('div');
        inactivityModal.id = 'timesession-inactivity-modal';
        chrome.storage.local.get(['darkMode'], function(data) {
            inactivityModalIsDark = !!data.darkMode;
            renderInactivityModal(inactivityModalIsDark);
            document.body.appendChild(inactivityModal);
        });
    }
    function hideInactivityModal() {
        if (inactivityModal) {
            inactivityModal.remove();
            inactivityModal = null;
            inactivityModalIsDark = null;
            document.body.style.overflow = 'auto';
        }
// Listener para cambios en darkMode y actualizar el modal si está abierto
chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.darkMode && inactivityModal) {
        inactivityModalIsDark = !!changes.darkMode.newValue;
        renderInactivityModal(inactivityModalIsDark);
    }
});
    }

    // Función para pausar sesión por inactividad SOLO si hay sesión activa
    function pauseSessionForInactivity() {
        chrome.storage.local.get(['currentSession'], ({ currentSession }) => {
            if (currentSession && !currentSession.isPaused) {
                chrome.runtime.sendMessage({ action: 'pauseSession' }, () => {
                    showInactivityModal();
                    console.log('[TimeSession] Sesión pausada por inactividad');
                });
            }
        });
    }

    // Reinicia el temporizador de inactividad
    function resetInactivityTimer() {
        if (inactivityTimer) clearTimeout(inactivityTimer);
        inactivityTimer = setTimeout(() => {
            pauseSessionForInactivity();
        }, inactivityInterval * 60 * 1000);
    }

    // Escuchar eventos de usuario para detectar actividad
    ['mousemove', 'keydown', 'scroll', 'mousedown', 'touchstart'].forEach(evt => {
        window.addEventListener(evt, resetInactivityTimer, true);
    });

    // Iniciar el temporizador al cargar el script
    resetInactivityTimer();

    /* TODO: Muestra el modal inicial para iniciar sesión o descanso */
    function showInitialModal() {
        if (modal) {
            return;
        }
        modal = document.createElement('div');
        modal.id = 'timesession-modal-container';
        modal.innerHTML = `
            <div class="timesession-overlay"></div>
            <div class="timesession-modal" style="position: relative;">
                <button id="closeModalBtn" style="position: absolute; top: 12px; right: 16px; background: none; border: none; font-size: 22px; color: #888; cursor: pointer; z-index: 10;">&times;</button>
                <button id="darkModeModalBtn" style="position: absolute; top: 12px; right: 48px; background: none; border: none; font-size: 22px; color: #888; cursor: pointer; z-index: 10;">🌙</button>
                <h2>⏱️ ¿Qué vas a hacer?</h2>
                <button class="option-btn work-btn" data-type="personal">👤 Para mí</button>
                <button class="option-btn work-btn" data-type="client">🏢 Para un cliente</button>
                <button class="option-btn work-btn" data-type="learning">📚 Aprendizaje</button>
                <button class="option-btn work-btn" data-type="programming">💻 Programando</button>
                <button class="option-btn break-btn" data-type="break">☕ No voy a trabajar</button>

                <div id="clientSection" class="hidden">
                    <select id="clientSelect"><option>Cargando clientes...</option></select>
                </div>

                <div id="taskSection" class="hidden">
                    <textarea id="taskDescription" placeholder="Describe la tarea..."></textarea>
                    <button id="startBtn">🚀 Iniciar Sesión</button>
                    <button id="cancelBtn">Cancelar</button>
                </div>

                <div id="breakSection" class="hidden">
                    <input type="number" id="breakMinutes" value="15" min="1">
                    <button id="startBreakBtn">☕ Iniciar Descanso</button>
                    <button id="cancelBreakBtn">Cancelar</button>
                </div>
            </div>
        `;
        if (document.body) {
            document.body.appendChild(modal);
            document.body.style.overflow = 'hidden';
            // Modal agregado al DOM
            loadClients();
            addModalListeners();
            // Listener para cerrar con la X
            const closeBtn = modal.querySelector('#closeModalBtn');
            if (closeBtn) closeBtn.onclick = hideInitialModal;
            // Listener para modo oscuro
            const darkBtn = modal.querySelector('#darkModeModalBtn');
            if (darkBtn) {
                chrome.storage.local.get(['darkMode'], function(data) {
                    if (data.darkMode) {
                        document.body.classList.add('dark-mode');
                        darkBtn.textContent = '☀️';
                    } else {
                        document.body.classList.remove('dark-mode');
                        darkBtn.textContent = '🌙';
                    }
                });
                darkBtn.onclick = function() {
                    const isDark = !document.body.classList.contains('dark-mode');
                    if (isDark) {
                        document.body.classList.add('dark-mode');
                        darkBtn.textContent = '☀️';
                    } else {
                        document.body.classList.remove('dark-mode');
                        darkBtn.textContent = '🌙';
                    }
                    chrome.storage.local.set({ darkMode: isDark });
                };
            }
        } else {
            window.addEventListener('DOMContentLoaded', () => {
                if (!document.body.contains(modal)) {
                    document.body.appendChild(modal);
                    document.body.style.overflow = 'hidden';
                    // Modal agregado al DOM (tras DOMContentLoaded)
                    loadClients();
                    addModalListeners();
                    // Listener para cerrar con la X
                    const closeBtn = modal.querySelector('#closeModalBtn');
                    if (closeBtn) closeBtn.onclick = hideInitialModal;
                }
            }, { once: true });
        }
    }

    /* TODO: Oculta y elimina el modal inicial del DOM */
    function hideInitialModal() {
        if (modal) {
            modal.remove();
            modal = null;
            document.body.style.overflow = 'auto';
        }
    }

    /* TODO: Añade listeners a los botones del modal inicial */
    function addModalListeners() {
        modal.querySelectorAll('.option-btn').forEach(btn => {
            btn.onclick = () => handleActivitySelection(btn.dataset.type);
        });
        
        const startBtn = modal.querySelector('#startBtn');
        if (startBtn) startBtn.onclick = startSession;

        const cancelBtn = modal.querySelector('#cancelBtn');
        if (cancelBtn) cancelBtn.onclick = resetModalView;

        const startBreakBtn = modal.querySelector('#startBreakBtn');
        if (startBreakBtn) startBreakBtn.onclick = startBreak;

        const cancelBreakBtn = modal.querySelector('#cancelBreakBtn');
        if (cancelBreakBtn) cancelBreakBtn.onclick = resetModalView;
    }

    /* TODO: Maneja la selección de tipo de actividad en el modal */
    function handleActivitySelection(type) {
        selectedType = type;
        modal.querySelector('#clientSection').classList.add('hidden');
        modal.querySelector('#taskSection').classList.add('hidden');
        modal.querySelector('#breakSection').classList.add('hidden');

        if (type === 'break') {
            modal.querySelector('#breakSection').classList.remove('hidden');
        } else {
            if (type === 'client') {
                modal.querySelector('#clientSection').classList.remove('hidden');
            }
            modal.querySelector('#taskSection').classList.remove('hidden');
        }
    }

    /* TODO: Resetea la vista del modal a estado inicial */
    function resetModalView() {
        modal.querySelector('#clientSection').classList.add('hidden');
        modal.querySelector('#taskSection').classList.add('hidden');
        modal.querySelector('#breakSection').classList.add('hidden');
        selectedType = null;
    }

    /* TODO: Carga la lista de clientes en el select del modal */
    function loadClients() {
        const select = modal.querySelector('#clientSelect');
        select.innerHTML = '<option value="">Seleccionar cliente...</option>';

        chrome.runtime.sendMessage({ action: "getClients" }, (response) => {
            if (response && response.length) {
                response.forEach(client => {
                    if (!client || !client.name) return;
                    const option = document.createElement('option');
                    option.value = client.name;
                    option.textContent = client.name;
                    select.appendChild(option);
                });
            }
        });
    }

    /* TODO: Inicia una nueva sesión con los datos del modal */
    function startSession() {

        const description = modal.querySelector('#taskDescription').value.trim();
        let client = null;

        // Mapeo de nombres legibles
        const typeLabels = {
            personal: 'Personal',
            client: 'Cliente',
            learning: 'Aprendizaje',
            programming: 'Programando',
            break: 'Descanso'
        };


        if (selectedType === 'client') {
            const select = modal.querySelector('#clientSelect');
            client = select ? select.value : null;
            if (!client) {
                alert("Por favor, selecciona un cliente.");
                return;
            }
        }

        let defaultDesc = '';
        if (description) {
            defaultDesc = description;
        } else if (selectedType === 'client' && client) {
            defaultDesc = `Sesión Cliente ${client}`;
        } else {
            defaultDesc = `Sesión de ${typeLabels[selectedType] || selectedType}`;
        }

        const sessionData = {
            action: "startSession",
            session: {
                type: selectedType,
                description: defaultDesc,
                client,
                startTime: Date.now()
            }
        };


        chrome.runtime.sendMessage(sessionData, (response) => {
            if (response && response.success) {
                hideInitialModal();
            } else {
            }
        });
    }

    /* TODO: Inicia un descanso con la duración indicada en el modal */
    function startBreak() {
        const minutes = parseInt(modal.querySelector('#breakMinutes').value, 10);
        if (minutes > 0) {
            chrome.runtime.sendMessage({ action: "startBreak", minutes }, (response) => {
                hideInitialModal();
            });
        }
    }

    // Listener para mensajes del background
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        
        if (request.action === "showInitialModal") {
            chrome.storage.local.get('config', ({ config = {} }) => {
                if (config.askOnBrowserStart === true) {
                    showInitialModal();
                } else {
                    console.log('[TimeSession] Modal bloqueado por configuración askOnBrowserStart:', config.askOnBrowserStart);
                }
            });
        } else if (request.action === "showValidationModal") {
            // Aquí puedes agregar la lógica para el modal de validación
        }
    });

    // Función para forzar mostrar modal (para debugging)
    window.timeSessionForceModal = function() {
        showInitialModal();
    };

    // Auto-check cuando se carga la página
    
    // Verificar estado actual
    chrome.runtime.sendMessage({ action: "checkState" }, (response) => {
        
        // Si no hay sesión activa ni descanso, consultar config antes de mostrar modal
        if (!response || (!response.currentSession && !response.breakInfo)) {
            chrome.storage.local.get('config', ({ config = {} }) => {
                console.log('[TimeSession] Valor askOnBrowserStart:', config.askOnBrowserStart);
                if (config.askOnBrowserStart === true) {
                    showInitialModal();
                }
            });
        } else {
            // Hay sesión/descanso activo, no mostrar modal
        }
    });

    // También escuchar cuando la página se enfoca (por si acaso)
    window.addEventListener('focus', () => {
        chrome.runtime.sendMessage({ action: "checkState" }, (response) => {
            if (!response || (!response.currentSession && !response.breakInfo)) {
                chrome.storage.local.get('config', ({ config = {} }) => {
                    console.log('[TimeSession] Valor askOnBrowserStart (focus):', config.askOnBrowserStart);
                    if (!modal && config.askOnBrowserStart === true) {
                        // Mostrando modal por enfoque de ventana
                        showInitialModal();
                    }
                });
            }
        });
    });

    // Escuchar cambios en storage para actualizar temporizador y popup
    chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'local' && changes.currentSession) {
            const cs = changes.currentSession.newValue;
            if (cs && !cs.isPaused) {
                resetInactivityTimer();
            } else if (cs && cs.isPaused) {
                // Si la sesión se pausa desde otro tab, mostrar el popup
                showInactivityModal();
            } else if (!cs) {
                // Si se elimina la sesión, limpiar popup y temporizador
                hideInactivityModal();
                if (inactivityTimer) clearTimeout(inactivityTimer);
            }
        }
    });

    // Content script configurado completamente
})();