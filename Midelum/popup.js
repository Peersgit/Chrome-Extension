document.addEventListener('DOMContentLoaded', function() {
  const toggle = document.getElementById('tabToggle');
  const status = document.getElementById('status');

  // Find and manage new tab extensions
  function findNewTabExtensions() {
    return new Promise((resolve) => {
      chrome.management.getAll(function(extensions) {
        const newTabExtensions = extensions.filter(ext => {
          return ext.id !== chrome.runtime.id && // not our extension
                 ext.enabled && // is enabled
                 ext.permissions.some(permission => 
                   permission.includes('chrome://newtab') || 
                   permission.includes('newtab')
                 );
        });
        resolve(newTabExtensions);
      });
    });
  }

  // Initialize toggle state
  chrome.management.getSelf(function(self) {
    toggle.checked = self.enabled;
  });

  // Handle toggle changes
  toggle.addEventListener('change', async function(e) {
    const isEnabled = e.target.checked;
    
    if (isEnabled) {
      // Enable our extension's new tab
      const currentExtensions = await findNewTabExtensions();
      for (const ext of currentExtensions) {
        chrome.management.setEnabled(ext.id, false);
        status.textContent = `Disabled ${ext.name}`;
      }
    } else {
      // Find Momentum or other new tab extension and enable it
      chrome.management.getAll(function(extensions) {
        const momentum = extensions.find(ext => 
          ext.name.toLowerCase().includes('momentum')
        );
        if (momentum) {
          chrome.management.setEnabled(momentum.id, true);
          status.textContent = 'Enabled Momentum';
        } else {
          status.textContent = 'No alternative new tab extension found';
        }
      });
    }
  });
});