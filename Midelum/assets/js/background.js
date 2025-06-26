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

  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'updateBackground') {
        checkAndFetchBackground();
    }
});

// Check if we need to fetch a new background based on last update time
async function checkAndFetchBackground() {
    try {
        // Get the last update timestamp and current query index from storage
        const data = await chrome.storage.local.get(['lastUpdateTime', 'lastQueryIndex']);
        const currentDate = new Date();
        
        // If no previous update or it's a different day, fetch new background
        if (!data.lastUpdateTime) {
            console.log('No previous update time found. Fetching new background.');
            await fetchNewBackground();
        } else {
            const lastUpdate = new Date(data.lastUpdateTime);
            const lastUpdateDay = lastUpdate.toDateString();
            const currentDay = currentDate.toDateString();
            
            if (lastUpdateDay !== currentDay) {
                console.log('New day detected. Fetching new background.');
                
                // Advance to next query for the new day
                const currentQueryIndex = data.lastQueryIndex || 0;
                const nextQueryIndex = (currentQueryIndex + 1) % 12; // 12 queries total
                
                // Update the query index before fetching
                await chrome.storage.local.set({ 'lastQueryIndex': nextQueryIndex });
                
                await fetchNewBackground();
            } else {
                console.log('Same day - no update needed. Using cached background.');
            }
        }
    } catch (error) {
        console.error('Error checking background update time:', error);
    }
}

// Fetch new background from Pexels
async function fetchNewBackground() {
    const PEXELS_API_KEY = 'dzbjwuoWYT5z7GYPvxTgg8gOr90DcoSc3DlThon40FKkblrZdf0H7Q9F';

    const queries = [
      "landscape",
      "nature",
      "cityscape",
      "mountains",
      "pets",
      "ocean",
      "sunset",
      "sunrise",
      "architecture",
      "wildlife",
      "ski",
      "snow"
    ];

    try {
        // Get current state from storage
        const storageData = await chrome.storage.local.get(['lastQueryIndex', 'currentPage', 'allDetails']);
        
        let queryIndex = storageData.lastQueryIndex || 0;
        let page = storageData.currentPage || 0;
        let allDetails = storageData.allDetails || [];
        
        // Convert allDetails to a Set for faster lookup (if it's an array)
        const usedImages = new Set();
        if (Array.isArray(allDetails)) {
            allDetails.forEach(detail => {
                usedImages.add(`${detail.query}-${detail.pageNum}`);
            });
        }
        
        let attempts = 0;
        const maxAttempts = 50; // Prevent infinite loops
        let imageFound = false;
        
        while (!imageFound && attempts < maxAttempts) {
            const query = queries[queryIndex];
            const imageKey = `${query}-${page}`;
            
            // Check if this image has been used before
            if (!usedImages.has(imageKey)) {
                try {
                    const response = await fetch(`https://api.pexels.com/v1/search?query=${query}&orientation=landscape&per_page=1&page=${page}`, {
                        headers: {
                            'Authorization': PEXELS_API_KEY
                        }
                    });
                    
                    const data = await response.json();
                    if (data.photos && data.photos.length > 0) {
                        const imageUrl = data.photos[0].src.original;
                        
                        // Add to used images
                        allDetails.push({ 'pageNum': page, 'query': query });
                        usedImages.add(imageKey);
                        
                        // Update storage
                        await chrome.storage.local.set({ 
                            'backgroundImage': imageUrl, 
                            'photographer': data.photos[0].photographer, 
                            'photo_url': data.photos[0].photographer_url,
                            'lastUpdateTime': new Date().toISOString(),
                            'lastQueryIndex': queryIndex,
                            'currentPage': page,
                            'allDetails': allDetails
                        });
                        
                        console.log(`New background fetched: ${query} (page ${page})`);
                        imageFound = true;
                        break;
                    }
                } catch (error) {
                    console.error(`Error fetching image for ${query} page ${page}:`, error);
                }
            }
            
            // Move to next page or query
            page++;
            
            // If we've tried too many pages for this query, move to next query
            if (page > 100) { // Arbitrary limit per query
                queryIndex = (queryIndex + 1) % queries.length;
                page = 0;
            }
            
            attempts++;
        }
        
        if (!imageFound) {
            console.warn('Could not find unused image after maximum attempts. Resetting to first query/page.');
            // Reset everything and try again
            await chrome.storage.local.set({
                'lastQueryIndex': 0,
                'currentPage': 0,
                'allDetails': []
            });
        }
        
    } catch (error) {
        console.error('Error in fetchNewBackground:', error);
    }
}

// Set up alarm for midnight MST (7am UTC)
function setupDailyAlarm() {
    // Calculate time until next midnight MST
    const now = new Date();
    const mstOffset = -7 * 60; // MST is UTC-7 (in minutes)
    
    // Convert current time to MST
    const nowMST = new Date(now.getTime() + (now.getTimezoneOffset() + mstOffset) * 60000);
    
    // Set target time to next midnight MST
    const targetMST = new Date(nowMST);
    if (nowMST.getHours() >= 0) {
        // If we're past midnight MST, set for next day
        targetMST.setDate(targetMST.getDate() + 1);
    }
    targetMST.setHours(0, 0, 0, 0);
    
    // Convert back to local time for the alarm
    const targetLocal = new Date(targetMST.getTime() - (now.getTimezoneOffset() + mstOffset) * 60000);
    const delayInMinutes = (targetLocal.getTime() - now.getTime()) / (1000 * 60);
    
    // Create the alarm
    chrome.alarms.create('updateBackground', {
        delayInMinutes: delayInMinutes,
        periodInMinutes: 24 * 60 // 24 hours
    });
    
    console.log(`Alarm set to trigger in ${delayInMinutes.toFixed(2)} minutes and then every 24 hours`);
}

// Initialize on extension load
async function initialize() {
    // Set up the daily alarm
    setupDailyAlarm();
    
    // Check if we need to fetch a background now
    await checkAndFetchBackground();
}