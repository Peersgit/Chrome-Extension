document.addEventListener('DOMContentLoaded', function() {
  // Get a reference to the button and container
  const addButton = document.getElementById('add-site');
  const container = document.querySelector('.sites-container');
  
  // Keep track of current state to detect changes
  let currentStorageState = '';
  
  // Load existing sites from localStorage when popup opens
  loadSitesFromStorage();
  
  // Set up periodic check for localStorage changes
  const checkInterval = setInterval(checkForStorageChanges, 500); // Check every 500ms
  
  // Clean up interval when popup closes
  window.addEventListener('unload', function() {
    clearInterval(checkInterval);
  });
  
  // Add click event for new sites
  addButton.addEventListener('click', function() {
    // Get the current URL from the active tab
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      const currentUrl = tabs[0].url;
      const currentTitle = tabs[0].title || 'Unnamed Site';
      const faviconUrl = tabs[0].favIconUrl || 'default-favicon.png';
      
      // Check if the site already exists before adding
      if (!siteExists(currentUrl)) {
        // Add the URL to the sites list
        const curr_el = addSite(currentUrl, currentTitle, faviconUrl);        
        // Save the updated list to localStorage
        saveSitesToStorage();
      } else {
        console.log('Site already exists:', currentUrl);
        // Optional: Show a notification to the user
        // alert('This site is already in your list.');
      }
    });
  });
  
  // Function to check if a site already exists in localStorage
  function siteExists(url) {
    const savedSites = localStorage.getItem('savedSites');
    
    if (savedSites) {
      const sites = JSON.parse(savedSites);
      
      // Check if any site in the array has the same URL
      return sites.some(site => {
        // Optional: Use URL normalization to handle slight variations
        const normalizedSavedUrl = normalizeUrl(site.url);
        const normalizedNewUrl = normalizeUrl(url);
        return normalizedSavedUrl === normalizedNewUrl;
      });
    }
    
    return false;
  }
  
  // Helper function to normalize URLs for comparison
  function normalizeUrl(url) {
    try {
      // Create URL object to standardize the format
      const urlObj = new URL(url);
      
      // Return hostname + pathname (ignoring protocol, query parameters, etc.)
      // You can customize this based on how strict you want the comparison
      return urlObj.hostname + urlObj.pathname;
    } catch (e) {
      // If URL is invalid, return the original
      return url;
    }
  }
  
  // Function to add a site to the container
  function addSite(url, title, faviconUrl) {
    const siteElement = document.createElement('div');
    siteElement.className = 'site-wrapper';

    title = title.replace(/^.*[|-]\s*/, '');

    
    siteElement.innerHTML = `
      <a class="site" data-zurl="${url}" data-favicon="${faviconUrl}">
        ${title}
      </a>
      <a class="remove-btn">
        <i class="fa-solid fa-trash"></i>
      </a>
      `;
    
    // Add event listener to the link
    siteElement.querySelector('.site').addEventListener('click', function(e) {
      e.preventDefault();
      chrome.tabs.create({ url: this.getAttribute('data-zurl') });
    });
    
    // Add event listener to remove button
    siteElement.querySelector('.remove-btn').addEventListener('click', function() {
      siteElement.remove();
      saveSitesToStorage();
    });
    
    container.appendChild(siteElement);
  }
  
  // Function to save all sites to localStorage
  function saveSitesToStorage() {
    const siteElements = container.querySelectorAll('.site');
    const sites = [];
    
    siteElements.forEach(element => {
      sites.push({
        url: element.getAttribute('data-zurl'),
        title: element.textContent.trim(),
        faviconUrl: element.getAttribute('data-favicon')
      });
    });
    
    // Save to localStorage as a JSON string
    localStorage.setItem('savedSites', JSON.stringify(sites));
  }
  
  // Function to load sites from localStorage
  function loadSitesFromStorage() {
    const savedSites = localStorage.getItem('savedSites');
    
    if (savedSites) {
      const sites = JSON.parse(savedSites);
      
      // Add each saved site to the container
      sites.forEach(site => {
        addSite(site.url, site.title, site.faviconUrl);
      });
      
      // Update our tracking variable
      currentStorageState = savedSites;
    }
  }
  
  // Function to check for changes in localStorage
  function checkForStorageChanges() {
    const latestStorage = localStorage.getItem('savedSites');
    
    // If storage has changed and we have a valid value
    if (latestStorage !== currentStorageState && latestStorage) {
      // Update our tracking variable
      currentStorageState = latestStorage;
      
      // Clear current container
      container.innerHTML = '';
      
      // Reload sites from storage
      const sites = JSON.parse(latestStorage);
      sites.forEach(site => {
        addSite(site.url, site.title, site.faviconUrl);
      });
    }
    // Check if sites were removed externally (storage is empty but we have items)
    else if (!latestStorage && container.querySelectorAll('.site').length > 0) {
      container.innerHTML = '';
      currentStorageState = '';
    }
  }

  const exportButton = document.getElementById('export-site');

  if (exportButton) {
    exportButton.addEventListener('click', exportSites);
  }


  function download(filename, text) {
    const element = document.createElement('a');
    element.style.display = 'none';
    element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
    element.setAttribute('download', filename);
  
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  }
  
  function exportSites() {
    const sites = localStorage.getItem('savedSites');
    
    if (sites) {
      // Get current date for filename
      const now = new Date();
      const dateStr = now.toISOString().split('T')[0]; // Format: YYYY-MM-DD
      const filename = `saved_sites_${dateStr}.json`;
      
      // Download the sites JSON as a text file
      download(filename, sites);
      
      console.log('Sites exported successfully!');
    } else {
      alert('No sites to export.');
    }
  }

  const current_sites = document.querySelectorAll('.site');
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    // tabs is an array of tab objects matching the query
    if (tabs && tabs.length > 0) {
      const currentUrl = tabs[0].url;
      current_sites.forEach(site => {
        if (site.getAttribute('data-zurl') === currentUrl) {
          site.parentElement.classList.add('active');
        };
      });
    };
  });
});