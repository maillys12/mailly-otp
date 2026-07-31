(() => {
  const maintenanceMessages = {
    'youtube.html': 'อยู่ระหว่างปรับปรุงระบบต่อยูทูป'
  };
  let lastFocusedElement = null;

  function getMaintenanceModal() {
    let modal = document.getElementById('featureMaintenanceModal');
    if (modal) return modal;

    modal = document.createElement('div');
    modal.id = 'featureMaintenanceModal';
    modal.className = 'feature-maintenance-overlay';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'featureMaintenanceTitle');
    modal.innerHTML = '<div class="feature-maintenance-dialog"><div class="feature-maintenance-icon"><i class="fa-solid fa-screwdriver-wrench"></i></div><h2 id="featureMaintenanceTitle">แจ้งปรับปรุงระบบ</h2><p id="featureMaintenanceMessage"></p><button type="button" class="feature-maintenance-close">รับทราบ</button></div>';
    modal.addEventListener('click', event => {
      if (event.target === modal || event.target.closest('.feature-maintenance-close')) closeMaintenanceNotice();
    });
    document.body.appendChild(modal);
    return modal;
  }

  function openMaintenanceNotice(message, trigger) {
    const modal = getMaintenanceModal();
    lastFocusedElement = trigger || document.activeElement;
    modal.querySelector('#featureMaintenanceMessage').textContent = message;
    requestAnimationFrame(() => {
      modal.classList.add('is-open');
      modal.querySelector('.feature-maintenance-close').focus();
    });
  }

  function closeMaintenanceNotice() {
    const modal = document.getElementById('featureMaintenanceModal');
    if (!modal) return;
    modal.classList.remove('is-open');
    if (lastFocusedElement && typeof lastFocusedElement.focus === 'function') lastFocusedElement.focus();
  }

  document.addEventListener('click', event => {
    const link = event.target.closest('a[href]');
    if (!link) return;
    const targetPage = (link.getAttribute('href') || '').split('?')[0].split('#')[0].split('/').pop().toLowerCase();
    const message = maintenanceMessages[targetPage];
    if (!message) return;

    event.preventDefault();
    openMaintenanceNotice(message, link);
  });

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') closeMaintenanceNotice();
  });
})();
