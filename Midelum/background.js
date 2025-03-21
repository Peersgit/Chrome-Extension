chrome.runtime.onInstalled.addListener(function() {
    chrome.storage.sync.set({ overrideNewTab: true });
  });
  
  // Listen for messages from popup
  chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.action === 'toggleOverride') {
      if (!request.value) {
        // If disabled, redirect to Momentum's new tab page
        chrome.management.getAll(function(extensions) {
          const momentum = extensions.find(ext => 
            ext.name.toLowerCase().includes('momentum')
          );
          
          if (momentum) {
            const momentumUrl = `chrome-extension://${momentum.id}/dashboard.html`;
            chrome.tabs.onCreated.addListener(function(tab) {
              if (tab.pendingUrl === chrome.runtime.getURL('newtab.html')) {
                chrome.tabs.update(tab.id, { url: momentumUrl });
              }
            });
          } else {
            // Fallback to Chrome's default if Momentum isn't installed
            chrome.tabs.onCreated.addListener(function(tab) {
              if (tab.pendingUrl === chrome.runtime.getURL('newtab.html')) {
                chrome.tabs.update(tab.id, { url: 'chrome://newtab' });
              }
            });
          }
        });
      }
    }
  });


// Set up daily alarm for 12 PM Mountain Time
function setupDailyAlarm() {
    // Convert 12 PM Mountain Time to UTC
    const now = new Date();
    const desiredTime = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
        19, // 12 PM MT = 19:00 UTC
        0
    );
    
    if (now > desiredTime) {
        desiredTime.setDate(desiredTime.getDate() + 1);
    }

    chrome.alarms.create('updateBackground', {
        when: desiredTime.getTime(),
        periodInMinutes: 24 * 60 // Repeat daily
    });
}

// Handle the alarm
chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'updateBackground') {
        fetchNewBackground();
    }
});

// Fetch new background from Pexels
async function fetchNewBackground() {
    const PEXELS_API_KEY = 'dzbjwuoWYT5z7GYPvxTgg8gOr90DcoSc3DlThon40FKkblrZdf0H7Q9F';
    
    try {
        const response = await fetch('https://api.pexels.com/v1/search?query=landscape&orientation=landscape&per_page=1&page=' + Math.floor(Math.random() * 100), {
            headers: {
                'Authorization': PEXELS_API_KEY
            }
        });
        
        const data = await response.json();
        if (data.photos && data.photos.length > 0) {
            const imageUrl = data.photos[0].src.original;
            // Store the image URL
            chrome.storage.local.set({ 'backgroundImage': imageUrl, 'photographer': data.photos[0].photographer, 'photo_url': data.photos[0].photographer_url });
        }
    } catch (error) {
        console.error('Error fetching background:', error);
    }
}

// Set up initial alarm
setupDailyAlarm();
// Fetch initial background
fetchNewBackground();