document.addEventListener('DOMContentLoaded', () => {

    const typeEl = document.getElementById('compactType');
    const descEl = document.getElementById('compactDescription');
    const timerEl = document.getElementById('compactDuration');
    const noActivityEl = document.getElementById('noActivity');
    const startBtn = document.getElementById('startQuickSessionBtn');
    const dashboardBtn = document.getElementById('viewDashboardBtn');
    const sessionControls = document.getElementById('sessionControls');
    const pauseBtn = document.getElementById('pauseSessionBtn');
    const resumeBtn = document.getElementById('resumeSessionBtn');
    const endBtn = document.getElementById('endSessionBtn');

    let currentSession = null;
    let breakInfo = null;
    let timerInterval;

    /* TODO: Actualiza la vista del popup según el estado actual (sesión, descanso, inactivo) */
    function updateView() {
        const breakControls = document.getElementById('breakControls');

        const typeLabels = {
            personal: 'Personal',
            client: 'Cliente',
            learning: 'Aprendizaje',
            programming: 'Programando',
            break: 'Descanso'
        };

        if (breakInfo) {
            noActivityEl.style.display = 'none';
            typeEl.textContent = '☕ Descanso';
            descEl.textContent = `Duración: ${breakInfo.duration} min`;
            startBreakTimer();
            sessionControls.style.display = 'none';
            breakControls.style.display = 'flex';
        } else if (currentSession) {
            noActivityEl.style.display = 'none';
            typeEl.textContent = typeLabels[currentSession.type] || currentSession.type || '';
            descEl.textContent = currentSession.description || '';
            startSessionTimer();
            sessionControls.style.display = 'flex';
            breakControls.style.display = 'none';
            // Mostrar/ocultar botones según estado
            if (currentSession.isPaused) {
                pauseBtn.style.display = 'none';
                resumeBtn.style.display = 'inline-block';
            } else {
                pauseBtn.style.display = 'inline-block';
                resumeBtn.style.display = 'none';
            }
            endBtn.style.display = 'inline-block';
        } else {
            noActivityEl.style.display = 'block';
            typeEl.textContent = '';
            descEl.textContent = '';
            timerEl.textContent = '0h 0m 00s';
            if (timerInterval) clearInterval(timerInterval);
            sessionControls.style.display = 'none';
            breakControls.style.display = 'none';
        }
    }

    /* TODO: Inicia y actualiza el temporizador de la sesión activa */
    function startSessionTimer() {
        if (timerInterval) clearInterval(timerInterval);
        timerInterval = setInterval(() => {
            if (!currentSession) return;
            let elapsed = currentSession.initialDuration || 0;
            if (!currentSession.isPaused && currentSession.startTime) {
                elapsed += Date.now() - currentSession.startTime;
            }
            const totalSeconds = Math.floor(elapsed / 1000);
            timerEl.textContent = formatDuration(totalSeconds);
        }, 1000);
    }

    /* TODO: Inicia y actualiza el temporizador del descanso */
    function startBreakTimer() {
        if (timerInterval) clearInterval(timerInterval);
        timerInterval = setInterval(() => {
            if (!breakInfo) return;
            const remainingMs = Math.max(0, (breakInfo.endTime || 0) - Date.now());
            const totalSeconds = Math.floor(remainingMs / 1000);
            timerEl.textContent = formatDuration(totalSeconds);
            if (remainingMs <= 0) {
                clearInterval(timerInterval);
                timerEl.textContent = '0m 00s';
            }
        }, 1000);
    }

    /* TODO: Formatea la duración en formato mm:ss */
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


    /* TODO: Al cargar el popup, solicita el estado actual al background */
    chrome.runtime.sendMessage({ action: 'checkState' }, (response) => {
        currentSession = response?.currentSession || null;
        breakInfo = response?.breakInfo || null;
        updateView();
    });

    /* TODO: Evento para iniciar una sesión rápida desde el popup */
    startBtn.addEventListener('click', () => {
        chrome.runtime.sendMessage({ action: 'showInitialModal' });
        window.close();
    });

    dashboardBtn.addEventListener('click', () => {
        window.open(chrome.runtime.getURL('html/dashboard.html'), '_blank');
        window.close();
    });

    /* TODO: Evento para pausar la sesión activa */
    pauseBtn.addEventListener('click', () => {
        chrome.runtime.sendMessage({ action: 'pauseSession' }, () => {
            // Actualizar estado tras pausar
            chrome.runtime.sendMessage({ action: 'checkState' }, (response) => {
                currentSession = response?.currentSession || null;
                breakInfo = response?.breakInfo || null;
                updateView();
            });
        });
    });

    /* TODO: Evento para reanudar la sesión pausada */
    resumeBtn.addEventListener('click', () => {
        chrome.runtime.sendMessage({ action: 'resumeSession' }, () => {
            chrome.runtime.sendMessage({ action: 'checkState' }, (response) => {
                currentSession = response?.currentSession || null;
                breakInfo = response?.breakInfo || null;
                updateView();
            });
        });
    });

    /* TODO: Evento para finalizar la sesión activa */
    endBtn.addEventListener('click', () => {
        chrome.runtime.sendMessage({ action: 'endSession' }, () => {
            chrome.runtime.sendMessage({ action: 'checkState' }, (response) => {
                currentSession = response?.currentSession || null;
                breakInfo = response?.breakInfo || null;
                updateView();
            });
        });
    });

    /* TODO: Evento para finalizar el descanso activo */
    const endBreakBtn = document.getElementById('endBreakBtn');
    if (endBreakBtn) {
        endBreakBtn.addEventListener('click', () => {
            chrome.runtime.sendMessage({ action: 'endBreak' }, () => {
                chrome.runtime.sendMessage({ action: 'checkState' }, (response) => {
                    currentSession = response?.currentSession || null;
                    breakInfo = response?.breakInfo || null;
                    updateView();
                });
            });
        });
    }
});
