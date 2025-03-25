let allFrequentBookmarks = [];


function saveToLocalStorage(key, value) {
    try {
      // Check if key is valid
      if (!key || typeof key !== 'string') {
        console.error('Invalid key provided to saveToLocalStorage');
        return false;
      }
      
      // Convert non-string values to JSON string
      const valueToStore = typeof value === 'string' 
        ? value 
        : JSON.stringify(value);
      
      // Save to localStorage
      localStorage.setItem(key, valueToStore);
      
      console.log(`Successfully saved ${key} to local storage`);
      return true;
    } catch (error) {
      // Handle errors (like exceeding storage quota)
      console.error(`Error saving to local storage: ${error.message}`);
      return false;
    }
  }


function initializeTopVisitedBookmarks() {
    chrome.history.search({
        text: '',           
        maxResults: 1000,   
        startTime: Date.now() - (30 * 24 * 60 * 60 * 1000)
    }, handleHistoryItems);
}

function handleHistoryItems(historyItems) {
    const sortedHistory = historyItems.sort((a, b) => b.visitCount - a.visitCount);
    chrome.bookmarks.search({}, (bookmarks) => handleBookmarks(bookmarks, sortedHistory));
}

function faviconURL(urlString) {
    // Extract the base domain from the provided URL
    const url = new URL(urlString);
    const baseUrl = url.origin; // Gets https://mail.google.com

    console.log(baseUrl);
    
    // Create the favicon URL using Chrome's API
    const faviconUrl = new URL(chrome.runtime.getURL("/_favicon/"));
    faviconUrl.searchParams.set("pageUrl", baseUrl);
    faviconUrl.searchParams.set("size", "32");
    
    return faviconUrl.toString();
  }


function handleBookmarks(bookmarks, sortedHistory) {
    const bookmarkUrls = new Set(bookmarks.map(b => b.url));
    const frequentBookmarks = sortedHistory.filter(item => bookmarkUrls.has(item.url));

    allFrequentBookmarks = frequentBookmarks;
    
    const linkContainer = document.getElementById('top-links-container');
    linkContainer.innerHTML = ''; // Clear the container

    // console.log(frequentBookmarks);
    // Add top 9 bookmarks
    frequentBookmarks.slice(0, 9).forEach(bm => {
        const link = document.createElement('a');
        link.href = bm.url;
        link.className = 'top-link';
        link.target = '_blank';

        const icon = document.createElement('img');
        icon.src = `https://www.google.com/s2/favicons?domain=${new URL(bm.url).hostname}&sz=32`;
        
        // icon.src = faviconURL(bm.url);
        icon.className = 'site-icon';
        icon.alt = `${bm.title} icon`;
        
        const span = document.createElement('span');
        span.textContent = bm.title;
        
        link.appendChild(icon);
        link.appendChild(span);
        linkContainer.appendChild(link);
    });

    const frequentlyVisitedLink = document.createElement('a');
    frequentlyVisitedLink.id = 'frequent';
    frequentlyVisitedLink.className = 'top-link';
    const span = document.createElement('span');
    span.textContent = 'Frequently Visited';
    frequentlyVisitedLink.appendChild(span);
    // Add event listener right after creating the element
    frequentlyVisitedLink.addEventListener('click', () => handleFrequentlyVisited());

    linkContainer.appendChild(frequentlyVisitedLink);
}

async function handleFrequentlyVisited() {
    try {
        const historyItems = await getHistoryItems();
        const sortedItems = processHistoryItems(historyItems);
        displayModal(sortedItems);
    } catch (error) {
        console.error('Error handling frequently visited:', error);
    }
}

function getHistoryItems() {
    const millisecondsPerDay = 1000 * 60 * 60 * 24;
    const thirtyDaysAgo = new Date().getTime() - (30 * millisecondsPerDay);

    return new Promise((resolve, reject) => {
        chrome.history.search({
            text: '',              // Return all history items
            startTime: thirtyDaysAgo,
            maxResults: 10000
        }, (historyItems) => {
            if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
            } else {
                resolve(historyItems);
            }
        });
    });
}

function processHistoryItems(historyItems) {
    // Group items by URL to combine visit counts
    const urlMap = new Map();
    
    historyItems.forEach(item => {
        if (urlMap.has(item.url)) {
            const existing = urlMap.get(item.url);
            existing.visitCount += item.visitCount;
        } else {
            urlMap.set(item.url, {
                url: item.url,
                title: item.title || new URL(item.url).hostname,
                visitCount: item.visitCount,
                lastVisitTime: item.lastVisitTime
            });
        }
    });

    // Convert to array and sort by visit count
    return Array.from(urlMap.values())
        .sort((a, b) => b.visitCount - a.visitCount)
        .slice(0, 50); // Take top 20 most visited
}

function displayModal(items) {
    const modal = document.getElementById("myModal");
    const modalBody = modal.querySelector('.modal-body');
    
    // Clear existing content
    modalBody.innerHTML = '';
    
    // Add each history item to the modal
    items.forEach(item => {
        const row = createHistoryRow(item);
        modalBody.appendChild(row);
    });
    
    // Show the modal
    modal.style.display = "block";
}

function createIcon(url) {
    const iconContainer = document.createElement('div');
    // Try to create an img element with favicon first
    const img = document.createElement('img');
    img.style.width = '16px';
    img.style.height = '16px';
    img.style.marginRight = '12px';
    img.onerror = () => {
        // If favicon fails to load, replace with SVG
        iconContainer.innerHTML = `
            <svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" 
                      stroke-linejoin="round" 
                      stroke-width="2" 
                      d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9">
                </path>
            </svg>`;
    };

    try {
        const hostname = new URL(url).hostname;
        img.src = `https://www.google.com/s2/favicons?domain=${hostname}&sz=32`;
        iconContainer.appendChild(img);
    } catch (error) {
        // If URL parsing fails, use SVG immediately
        iconContainer.innerHTML = `
            <svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" 
                      stroke-linejoin="round" 
                      stroke-width="2" 
                      d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9">
                </path>
            </svg>`;
    }

    return iconContainer;
}

function createHistoryRow(item) {
    const row = document.createElement('div');
    row.className = 'item-row';
    
    // Create favicon element
    const icon = createIcon(item.url);
    
    // Create title element
    const title = document.createElement('span');
    title.className = 'item-text';
    title.textContent = item.title;
    title.title = item.url; // Show full URL on hover
    
    // Create visit count element
    const count = document.createElement('span');
    count.className = 'item-number';
    count.textContent = `Visited ${item.visitCount} Times`;
    
    // Add click handler to row
    row.addEventListener('click', () => {
        chrome.tabs.create({ url: item.url });
    });
    
    // Assemble row
    row.appendChild(icon);
    row.appendChild(title);
    row.appendChild(count);
    
    return row;
}


// Add this to your existing newtab.js
function setBackgroundImage() {
    chrome.storage.local.get(['backgroundImage'], function(result) {
        if (result.backgroundImage) {
            document.body.style.backgroundImage = `url(${result.backgroundImage})`;
            document.body.style.backgroundSize = 'cover';
            document.body.style.backgroundPosition = 'center';
            document.body.style.backgroundRepeat = 'no-repeat';
        }
    });

    chrome.storage.local.get(['photographer'], function(result) {
        if (result.photographer) {
            const photo_el = document.getElementById('photographer');
            photo_el.textContent = result.photographer;
        }
    })
    chrome.storage.local.get(['photo_url'], function(result) {
        if (result.photo_url) {
            const photo_el = document.getElementById('photographer-url');
            photo_el.href = result.photo_url;
        }
    })
}


// Add this to your DOMContentLoaded event listener
document.addEventListener('DOMContentLoaded', () => {

    

    initializeTopVisitedBookmarks();
    setBackgroundImage();

    getLocationAndWeather();
    
    // Get modal elements
    const frequentlyVisitedLink = document.getElementById('frequent');
    const modal = document.getElementById("myModal");

    // Function to close modal
    function closeModal() {
        modal.style.display = "none";
    }

    // Add click event listener to close button
    const closeBtn = document.querySelector('.close');
    if (closeBtn) {
        closeBtn.addEventListener('click', closeModal);
    }

    // Close modal when clicking outside
    window.onclick = function(event) {
        if (event.target == modal) {
            modal.style.display = "none";
        }
    }
});


document.querySelector('.close-button').addEventListener('click', (e) => {
    e.preventDefault();
    const modal = document.getElementById("myModal");
    modal.style.display = "none";
});


function getLocation() {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            reject('Geolocation is not supported by this browser');
        }

        navigator.geolocation.getCurrentPosition(
            position => resolve(position.coords),
            error => reject(error)
        );
    });
}

// Then fetch weather using OpenWeatherMap
async function getWeather(latitude, longitude) {

    const cachedWeather = localStorage.getItem('weatherData');
    const weatherTimestamp = localStorage.getItem('weatherTimestamp');
    const hasWeatherData = localStorage.getItem('hasWeatherData');
    
    // Check if we have cached data and it's less than 30 minutes old
    if (hasWeatherData === 'true' && cachedWeather && weatherTimestamp) {
        const cachedTime = parseInt(weatherTimestamp);
        const currentTime = new Date().getTime();
        const thirtyMinutes = 30 * 60 * 1000; // 30 minutes in milliseconds
        
        if (currentTime - cachedTime < thirtyMinutes) {
            return JSON.parse(cachedWeather);
        }
    }

    const APIKEY = '4630d89d8cf8b5704e8ce70a8f3cdaaf'; // Sign up at OpenWeatherMap for free API key
    const url = `https://api.openweathermap.org/data/2.5/weather?lat=${latitude}&lon=${longitude}&units=imperial&appid=${APIKEY}`;
    
    try {
        const response = await fetch(url);
        const data = await response.json();
        
        // Save the weather data and timestamp to localStorage
        localStorage.setItem('weatherData', JSON.stringify(data));
        localStorage.setItem('weatherTimestamp', new Date().getTime().toString());
        localStorage.setItem('hasWeatherData', 'true');
        
        return data;
    } catch (error) {
        console.error('Error fetching weather:', error);
        // If fetch fails and we have old cached data, return that as fallback
        if (cachedWeather) {
            return JSON.parse(cachedWeather);
        }
        throw error;
    }
}


// Function to update the current time indicator
function updateTimeIndicator(sunriseTime, sunsetTime) {
    const now = new Date();
    const sunrise = new Date(sunriseTime);
    const sunset = new Date(sunsetTime);

    const totalDayMinutes = (sunset - sunrise) / 1000 / 60;
    const minutesSinceSunrise = (now - sunrise) / 1000 / 60;
    const percentage = (minutesSinceSunrise / totalDayMinutes) * 100;

    const timeIndicator = document.querySelector('.current-time');
    timeIndicator.style.left = `${Math.min(Math.max(percentage, 0), 100)}%`;
}

function get_sun_set_rise(date) {
    const new_date = new Date(date * 1000);
    return new_date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// Example function to update weather data
function updateWeatherData(data) {

    const sunriseString = get_sun_set_rise(data.sys.sunrise);
    const sunsetString = get_sun_set_rise(data.sys.sunset);
    
    // Get actual Date objects for sunrise and sunset
    const sunriseDate = new Date(data.sys.sunrise * 1000);
    const sunsetDate = new Date(data.sys.sunset * 1000);

    const current_date = new Date;


    document.querySelector('.sunrise').textContent = `Sunrise: ${sunriseString}`;
    document.querySelector('.sunset').textContent = `Sunset: ${sunsetString}`;

    // Update time indicator with actual sunrise/sunset times
    updateTimeIndicator(sunriseDate, sunsetDate);

    // Update location
    document.querySelector('.location h1').textContent = data.name;
    document.querySelector('.coordinates').textContent = 
        `${data.coord.lat}\u00B0 ${data.coord.lat >= 0 ? 'N' : 'S'} | ${data.coord.lon}\u00B0 ${data.coord.lon >= 0 ? 'E' : 'W'}`;

    document.getElementById('fl').textContent = Math.round(data.main.feels_like);
    document.getElementById('hum').textContent = data.main.humidity;
    document.getElementById('pres').textContent = data.main.pressure;
    document.getElementById('temp').textContent = Math.round(data.main.temp);
    document.getElementById('max-temp').textContent = Math.round(data.main.temp_max);
    document.getElementById('min-temp').textContent = Math.round(data.main.temp_min);

    const date = new Date();  // Create current date
    date.setTime(date.getTime() + (data.timezone * 1000));

    const timeZone = new Intl.DateTimeFormat('en-US', {
        timeZoneName: 'long'
    }).format(date);

    document.getElementById('tz').textContent = timeZone;

}

// Usage
async function getLocationAndWeather() {
    try {
        const coords = await getLocation();
        const weather = await getWeather(coords.latitude, coords.longitude);

        const weatherButton = document.getElementById('open-weather');

        weatherButton.textContent = `${weather.name} ${Math.round(weather.main.temp)}\u00B0F`;

        const currentHour = new Date().getHours();

        const modal = document.querySelector('.weather-card');

        // First, remove any previous gradient classes
        modal.classList.remove('sunrise-gradient', 'midday-gradient', 'sunset-gradient', 'night-gradient');

        // Then add the appropriate gradient class based on time
        if (currentHour >= 5 && currentHour < 8) {
            modal.classList.add('sunrise-gradient');
        } else if (currentHour >= 8 && currentHour < 16) {
            modal.classList.add('midday-gradient');
        } else if (currentHour >= 16 && currentHour < 20) {
            modal.classList.add('sunset-gradient');
        } else {
            modal.classList.add('night-gradient');
        }

        weatherButton.addEventListener('click', (e) => {
            modal.style.display = "block";
            modal.classList.remove('slide-down-fade-out');
            modal.classList.add('slide-up-fade-in');
            updateWeatherData(weather);

            document.querySelector('.close-button-2').addEventListener('click', (e) => {
                e.preventDefault();
                modal.classList.remove('slide-up-fade-in');
                modal.classList.add('slide-down-fade-out');
            });
        });
        // updateWeatherData(weather);
    } catch (error) {
        console.error('Error:', error);
    }
}



function date_time() {
    date = new Date;
    h = date.getHours();
    if(h>12) {
        h = h - 12;
    }
    if(h<10) {
        if(h===0) {
            h = "12";
        } else {
            h = "0"+h;
        }
    }
    m = date.getMinutes();
    if(m<10) {
        m = "0"+m;
    }
    s = date.getSeconds();
    if(s<10) {
        s = "0"+s;
    }

    const clock_status = localStorage.getItem('clock');

    if (clock_status === "1") {
        document.getElementById("s").innerHTML = ''+s;
        document.getElementById("m").innerHTML = ''+m;
        document.getElementById("h").innerHTML = ''+h;
    } else {
        document.getElementById("b-s").innerHTML = ':'+s;
        document.getElementById("b-m").innerHTML = ':'+m;
        document.getElementById("b-h").innerHTML = ''+h;
    }

}

window.onload = function() {
    // Run immediately once
    date_time();
    
    // Then run every second
    setInterval(date_time, 1000);
};

const clock_type_1 = document.getElementById('clock-type-1');
const clock_type_2 = document.getElementById('clock-type-2');

const modern_clock = document.getElementById('cube');
const normal_clock = document.getElementById('basic');

function display_modern_clock() {
    normal_clock.style.display = "none";
    modern_clock.style.display = "block";
}

function display_normal_clock() {
    modern_clock.style.display = "none";
    normal_clock.style.display = "flex";
}


clock_type_1.addEventListener('change', (e) => {
    if (clock_type_1.checked) {
        clock_type_2.checked = false;
        saveToLocalStorage("clock", "1");
        display_modern_clock();
    } else {
        // Prevent unchecking if user clicked on an already checked box
        clock_type_1.checked = true;
    }
});

clock_type_2.addEventListener('change', (e) => {
    if (clock_type_2.checked) {
        clock_type_1.checked = false;
        saveToLocalStorage("clock", "2");
        display_normal_clock();
    } else {
        // Prevent unchecking if user clicked on an already checked box
        clock_type_2.checked = true;
    }
});

document.addEventListener("DOMContentLoaded", function() {
    const clock_status = localStorage.getItem('clock');

    if (clock_status) {
        if (clock_status === "1") {
            clock_type_1.checked = true;
            clock_type_2.checked = false;
            display_modern_clock();
        } else if (clock_status === "2") {
            clock_type_1.checked = false;
            clock_type_2.checked = true;
            display_normal_clock();
        }
    } else {
        saveToLocalStorage("clock", "1");
        clock_type_1.checked = true;
        clock_type_2.checked = false;
        display_modern_clock();
    }
});


// Get references to both checkboxes
const frequentlyVisitedCheckbox = document.getElementById('freq-v');
const weatherCheckbox = document.getElementById('weather');

// Function for the Frequently Visited Bar checkbox
function handleFrequentlyVisitedChange() {
  const top_links = document.getElementById('top-links-container');
  top_links.style.display = 'flex';
  saveToLocalStorage('freq-v', frequentlyVisitedCheckbox.checked);
  if (frequentlyVisitedCheckbox.checked) {
    top_links.classList.remove('slide-down-fade-in');
    top_links.classList.add('slide-up-fade-out');
  } else {
    top_links.classList.remove('slide-up-fade-out');
    top_links.classList.add('slide-down-fade-in');
  }
}

// Function for the Weather checkbox
function handleWeatherChange() {
  const weatherButton = document.getElementById('open-weather');
  weatherButton.style.display = 'flex';
  saveToLocalStorage('weather-v', weatherCheckbox.checked);
  if (weatherCheckbox.checked) {
    weatherButton.classList.remove('slide-up-fade-in');
    weatherButton.classList.add('slide-down-fade-out');
  } else {
    weatherButton.classList.remove('slide-down-fade-out');
    weatherButton.classList.add('slide-up-fade-in');
  }
}

// Add event listeners to both checkboxes
frequentlyVisitedCheckbox.addEventListener('change', handleFrequentlyVisitedChange);
weatherCheckbox.addEventListener('change', handleWeatherChange);


function initializeFromLocalStorage() {
    const freqValue = localStorage.getItem('freq-v');
    const weatherValue = localStorage.getItem('weather-v');
    if (freqValue === "true") {
        const top_links = document.getElementById('top-links-container');
        // top_links.classList.add('slide-up-fade-out');
        top_links.style.display = 'none';
        frequentlyVisitedCheckbox.checked = true;
    }
    if (weatherValue === "true") {
        const weatherButton = document.getElementById('open-weather');
        weatherButton.style.display = 'none';
        weatherCheckbox.checked = true;

    }
}

document.addEventListener('DOMContentLoaded', initializeFromLocalStorage);

document.addEventListener('DOMContentLoaded', function() {
    // Get the settings button element
    const settingsButton = document.getElementById('settings');
    const exitButton = document.getElementById('close-settings');

    const settingsContainer = document.querySelector('.settings-container');

    exitButton.addEventListener('click', function(event) {
        event.preventDefault();

        // Check if the button has the 'open' class
        if (settingsButton.classList.contains('open')) {
            // If open, we want to close it
            settingsContainer.classList.remove('slide-up-fade-in');
            settingsContainer.classList.add('slide-down-fade-out');
            
            // Update button classes
            settingsButton.classList.remove('open');
            settingsButton.classList.add('closed');
        }

    });
    
    // Add click event listener to the settings button
    settingsButton.addEventListener('click', function(event) {
        // Prevent default link behavior if this is an anchor tag
        event.preventDefault();
                
        // Check if the button has the 'open' class
        if (settingsButton.classList.contains('open')) {
            // If open, we want to close it
            settingsContainer.classList.remove('slide-up-fade-in');
            settingsContainer.classList.add('slide-down-fade-out');
            
            // Update button classes
            settingsButton.classList.remove('open');
            settingsButton.classList.add('closed');
        } else if (settingsButton.classList.contains('closed')) {
            // If closed, we want to open it
            settingsContainer.classList.remove('slide-down-fade-out');
            settingsContainer.classList.add('slide-up-fade-in');
            
            // Update button classes
            settingsButton.classList.remove('closed');
            settingsButton.classList.add('open');
        }
    });
});



const drag_bar = document.getElementById('drag');
const parent_container = drag_bar.parentElement; // Get the parent container
let isDragging = false;
let initialX, initialY; // Store the initial position
let offsetX, offsetY; // Store the initial offset

// Listen for mousedown on the drag bar
drag_bar.addEventListener('mousedown', (e) => {
  // Prevent default behavior (like text selection)
  e.preventDefault();
  
  // Start dragging
  isDragging = true;
  
  // Get the current mouse position
  initialX = e.clientX;
  initialY = e.clientY;
  
  // Get the current position of the parent container
  const parentRect = parent_container.getBoundingClientRect();
  offsetX = initialX - parentRect.left;
  offsetY = initialY - parentRect.top;
  
  // Add a class to the body to disable text selection
  document.body.classList.add('no-select');
  
  console.log('Started dragging');
});

function loadSavedPosition() {
  const savedX = localStorage.getItem('containerX');
  const savedY = localStorage.getItem('containerY');
  
  if (savedX !== null && savedY !== null) {
    parent_container.style.left = `${savedX}px`;
    parent_container.style.top = `${savedY}px`;
    parent_container.style.right = 'auto'; // Switch to left positioning
    console.log(`Loaded saved position: X: ${savedX}, Y: ${savedY}`);
  }
}

document.addEventListener('DOMContentLoaded', loadSavedPosition);

// Listen for mousemove on the entire document
document.addEventListener('mousemove', (e) => {
  // Only track movement if currently dragging
  if (isDragging) {
    // Prevent default behavior
    e.preventDefault();
    
    // Get the current mouse position
    const x = e.clientX;
    const y = e.clientY;
    
    // Calculate the new position of the container
    const newLeft = x - offsetX;
    const newTop = y - offsetY;
    
    // Update the position of the parent container
    parent_container.style.left = `${newLeft}px`;
    parent_container.style.top = `${newTop}px`;
    // If the container was using 'right' positioning, we need to change to 'left'
    parent_container.style.right = 'auto';
    
    // Print the coordinates during drag
    console.log(`Dragging at: X: ${x}, Y: ${y}`);
  }
});

function savePosition(x, y) {
    localStorage.setItem('containerX', x);
    localStorage.setItem('containerY', y);
}

// Listen for mouseup on the entire document
document.addEventListener('mouseup', (e) => {
    // Only do something if we were dragging
    if (isDragging) {
      // Stop dragging
      isDragging = false;
      
      // Remove the no-select class
      document.body.classList.remove('no-select');
      
      console.log('Stopped dragging');
      
      // Get the final position of the parent container
      const parentRect = parent_container.getBoundingClientRect();
      const finalLeft = parentRect.left;
      const finalTop = parentRect.top;
      
      // Save the final position
      savePosition(finalLeft, finalTop);
    }
  });
  
  // Add this to ensure dragging stops if mouse leaves the window
  document.addEventListener('mouseleave', (e) => {
    if (isDragging) {
      isDragging = false;
      
      // Remove the no-select class
      document.body.classList.remove('no-select');
      
      console.log('Drag canceled (mouse left window)');
      
      // Get the current position of the parent container
      const parentRect = parent_container.getBoundingClientRect();
      const finalLeft = parentRect.left;
      const finalTop = parentRect.top;
      
      // Save the position even if drag was canceled
      savePosition(finalLeft, finalTop);
    }
  });