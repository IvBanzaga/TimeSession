/* TODO: Clase principal para manejar el popup de validación de sesión */
class ValidationPopup {
  /* TODO: Constructor: inicializa el popup y listeners */
  constructor() {
    this.init();
  }

  /* TODO: Añade listeners a los botones del popup de validación */
  init() {
    document.getElementById('yesBtn').addEventListener('click', () => this.continueSession());
    document.getElementById('noBtn').addEventListener('click', () => this.changeActivity());
  }

  /* TODO: Continúa la sesión actual y reinicia la alarma de validación */
  async continueSession() {
    try {
      const { config } = await chrome.storage.local.get('config');
      const interval = config?.validationInterval || 60;
      await chrome.alarms.create('sessionValidation', {
        delayInMinutes: interval
      });
      window.close();
    } catch (error) {
      // Manejo de error al continuar sesión
    }
  }

  /* TODO: Finaliza la sesión actual y cierra el popup de validación */
  async changeActivity() {
    try {
      await chrome.runtime.sendMessage({ action: 'endSession' });
      window.close();
    } catch (error) {
      // Manejo de error al cambiar actividad
    }
  }
}

/* TODO: Inicializa el popup de validación al cargar el DOM */
document.addEventListener('DOMContentLoaded', () => {
  new ValidationPopup();
});