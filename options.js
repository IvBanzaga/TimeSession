
// --- FUNCIONES TRADICIONALES ---

function loadSettings(callback) {
  chrome.storage.local.get('config', function(result) {
    var config = result.config;
    if (config) {
      document.getElementById('validationInterval').value = config.validationInterval || 60;
      document.getElementById('askOnBrowserStart').checked = config.askOnBrowserStart !== false;
    }
    if (callback) callback();
  });
}

function loadClients(callback) {
  chrome.runtime.sendMessage({ action: 'getClients' }, function(response) {
    var rawClients = response || [];
    var cleanClients = [];
    var changed = false;
    for (var i = 0; i < rawClients.length; i++) {
      var c = rawClients[i];
      if (!c) { changed = true; continue; }
      if (typeof c === 'string') {
        cleanClients.push({ id: 'client_' + Date.now() + '_' + Math.random().toString(36).slice(2,8), name: c });
        changed = true;
        continue;
      }
      if (typeof c === 'object' && c.name) {
        if (!c.id) {
          c.id = 'client_' + Date.now() + '_' + Math.random().toString(36).slice(2,8);
          changed = true;
        }
        cleanClients.push(c);
        continue;
      }
      changed = true;
    }
    window.clients = cleanClients;
    if (changed) {
      chrome.storage.local.set({ clients: window.clients }, function() {
        console.log('Clients sanitized and saved');
      });
    }
    if (callback) callback();
  });
}

function updateClientsList() {
  var container = document.getElementById('clientsList');
  if (!container) return;
  container.innerHTML = '';
  if (!window.clients || window.clients.length === 0) {
    container.innerHTML = '<p style="color: #666; font-style: italic;">No hay clientes registrados</p>';
    return;
  }
  window.clients.forEach(function(client) {
    if (!client || !client.name || !client.id) return;
    var clientEl = document.createElement('div');
    clientEl.className = 'client-item';
    clientEl.innerHTML = '<span class="client-name">' + client.name + '</span>' +
      '<button class="delete-btn" data-id="' + client.id + '">Eliminar</button>';
    clientEl.querySelector('.delete-btn').addEventListener('click', function() {
      deleteClient(client.id);
    });
    container.appendChild(clientEl);
  });
}

function saveSettings() {
  var validationInterval = parseInt(document.getElementById('validationInterval').value);
  var askOnBrowserStart = document.getElementById('askOnBrowserStart').checked;
  if (validationInterval < 5 || validationInterval > 480) {
    showStatus('El intervalo debe estar entre 5 y 480 minutos', 'error');
    return;
  }
  chrome.storage.local.set({
    config: {
      validationInterval: validationInterval,
      askOnBrowserStart: askOnBrowserStart
    }
  }, function() {
    showStatus('Configuración guardada correctamente', 'success');
  });
}

function deleteClient(clientId) {
  if (!confirm('¿Estás seguro de que quieres eliminar este cliente?')) return;
  chrome.runtime.sendMessage({ action: 'deleteClient', clientId: clientId }, function(response) {
    if (response && response.success) {
      loadClients(function() {
        updateClientsList();
        showStatus('Cliente eliminado correctamente', 'success');
      });
    } else {
      showStatus('Error al eliminar el cliente', 'error');
    }
  });
}

function resetData() {
  if (!confirm('¿Estás seguro de que quieres restablecer todos los datos? Esta acción no se puede deshacer.')) return;
  chrome.storage.local.clear(function() {
    chrome.runtime.sendMessage({ action: 'resetData' }, function() {
      location.reload();
    });
  });
}

function showStatus(message, type) {
  var statusEl = document.getElementById('statusMessage');
  statusEl.textContent = message;
  statusEl.className = 'status ' + type;
  statusEl.style.display = 'block';
  setTimeout(function() {
    statusEl.style.display = 'none';
  }, 3000);
}

document.addEventListener('DOMContentLoaded', function() {
  // MODO OSCURO: cargar preferencia y aplicar
  chrome.storage.local.get(['darkMode'], function(data) {
    if (data.darkMode) {
      document.body.classList.add('dark-mode');
    }
  });
  // Listener para el botón de modo oscuro
  var darkBtn = document.getElementById('darkModeBtn');
  if (darkBtn) {
    darkBtn.addEventListener('click', function() {
      var isDark = document.body.classList.toggle('dark-mode');
      chrome.storage.local.set({ darkMode: isDark });
      darkBtn.textContent = isDark ? '☀️ Modo Claro' : '🌙 Modo Oscuro';
    });
    // Cambiar texto según estado inicial
    chrome.storage.local.get(['darkMode'], function(data) {
      darkBtn.textContent = data.darkMode ? '☀️ Modo Claro' : '🌙 Modo Oscuro';
    });
  }
  loadSettings(function() {
    loadClients(function() {
      updateClientsList();
    });
  });
  document.getElementById('saveBtn').addEventListener('click', saveSettings);
  document.getElementById('resetBtn').addEventListener('click', resetData);
});
