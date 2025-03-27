let allFrequentBookmarks = [];

const clock_type_1 = document.getElementById("clock-type-1");
const clock_type_2 = document.getElementById("clock-type-2");

const modern_clock = document.getElementById("cube");
const normal_clock = document.getElementById("basic");


// Get references to both checkboxes
const frequentlyVisitedCheckbox = document.getElementById("freq-v");
const weatherCheckbox = document.getElementById("weather");
const searchCheckbox = document.getElementById("searchCheck");

// Add event listeners to both checkboxes
frequentlyVisitedCheckbox.addEventListener("change", handleFrequentlyVisitedChange);
weatherCheckbox.addEventListener("change", handleWeatherChange);
searchCheckbox.addEventListener("change", handleSearchBarChange);

const drag_bar = document.getElementById("drag");
const parent_container = drag_bar.parentElement; // Get the parent container
let isDragging = false;
let initialX, initialY; // Store the initial position
let offsetX, offsetY; // Store the initial offset

const add_to_favorites = document.getElementById("add-to-fav");

const favoritesDialog = document.getElementById("img-fav");

function addToFavorites() {
    // First, get the current background image information
    chrome.storage.local.get([
        'backgroundImage', 
        'photographer', 
        'photo_url', 
        'lastUpdateTime'
    ], (currentImg) => {
        if (chrome.runtime.lastError) {
            console.error('Error retrieving current image:', chrome.runtime.lastError);
            return;
        }
        
        // Create the new favorite item object
        const newFavorite = {
            backgroundImage: currentImg.backgroundImage,
            photographer: currentImg.photographer,
            photo_url: currentImg.photo_url,
            savedAt: new Date().toISOString()
        };
        
        // Now retrieve the existing favorites array (or create a new one if it doesn't exist)
        chrome.storage.local.get(['favorites'], (result) => {
            if (chrome.runtime.lastError) {
                console.error('Error retrieving favorites:', chrome.runtime.lastError);
                return;
            }
            
            // Get the current favorites array or initialize a new one if it doesn't exist
            const favorites = result.favorites || [];
            
            // Check if this image is already in favorites to avoid duplicates
            const isDuplicate = favorites.some(item => item.backgroundImage === newFavorite.backgroundImage);
            
            if (!isDuplicate) {
                // Add the new favorite to the array
                favorites.push(newFavorite);
                
                // Save the updated favorites array back to storage
                chrome.storage.local.set({ 'favorites': favorites }, () => {
                    if (chrome.runtime.lastError) {
                        console.error('Error saving favorites:', chrome.runtime.lastError);
                        return;
                    }
                });
                display_added_toast("Image added to Favorites", false);

            } else {
                display_added_toast("This image is already in your favorites!", true);
            }
        });
    });
}

function getFavorites() {
    return new Promise((resolve, reject) => {
        chrome.storage.local.get(['favorites'], (result) => {
            if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
                return;
            }
            
            // Return the favorites array or an empty array if it doesn't exist
            resolve(result.favorites || []);
        });
    });
}


function removeFromFavorites(imageUrl) {
    return new Promise((resolve, reject) => {
        getFavorites()
            .then(favorites => {
                const initialLength = favorites.length;
                const updatedFavorites = favorites.filter(item => item.backgroundImage !== imageUrl);
                
                if (updatedFavorites.length === initialLength) {
                    // No item was removed
                    resolve(false);
                    return;
                }
                
                // Save the updated array
                chrome.storage.local.set({ 'favorites': updatedFavorites }, () => {
                    if (chrome.runtime.lastError) {
                        reject(new Error(chrome.runtime.lastError.message));
                        return;
                    }
                    resolve(true);
                });
            })
            .catch(reject);
    });
}


add_to_favorites.addEventListener("click", function(e) {
    addToFavorites();
});


favoritesDialog.addEventListener("click", (event) => {
    const modal = document.getElementById("fav-modal");
    const modalBody = modal.querySelector(".modal-bod");
    
    // Clear any existing list items
    modalBody.innerHTML = '';
    
    // Show the modal immediately
    modal.style.display = "flex";
    
    // Create a loading indicator
    const loadingElement = document.createElement("div");
    loadingElement.className = "loading-favorites";
    loadingElement.textContent = "Loading favorites...";
    modalBody.appendChild(loadingElement);
    
    // Get the favorites and populate the modal
    getFavorites()
        .then(favorites => {
            // Remove loading indicator
            modalBody.removeChild(loadingElement);
            
            // Check if there are any favorites
            if (favorites.length === 0) {
                const noFavoritesElement = document.createElement("div");
                noFavoritesElement.className = "no-favorites";
                noFavoritesElement.textContent = "No favorites added yet";
                modalBody.appendChild(noFavoritesElement);
                return;
            }
            
            // Create a list element to hold the favorites
            const favoritesList = document.createElement("ul");
            favoritesList.className = "favorites-list";
            
            // Add each favorite to the list
            favorites.forEach(favorite => {
                const listItem = document.createElement("li");
                listItem.className = "favorite-item";
                
                // Create the item's HTML structure
                listItem.innerHTML = `
                    <div class="favorite-image">
                        <img src="${favorite.backgroundImage}" alt="Background image" class="thumbnail">
                    </div>
                    <div class="favorite-info">
                        <span class="photographer-name">${favorite.photographer || 'Unknown'}</span>
                        <i class="fa-solid fa-file-arrow-down" title="Download Image"></i>
                        <i class="fa-solid fa-trash" title="Remove Image"></i>
                    </div>
                `;
                
                // Add the item to the list first
                favoritesList.appendChild(listItem);
                
                // Now find the icons within this specific list item
                const downloadButton = listItem.querySelector(".fa-file-arrow-down");
                const trashButton = listItem.querySelector(".fa-trash");
                
                // Add event listener to the download button
                downloadButton.addEventListener("click", function(e) {
                    e.stopPropagation(); // Prevent triggering the parent list item's click
                    
                    // Use Chrome's download API to download the image
                    chrome.downloads.download({
                        url: favorite.backgroundImage,
                        filename: "background.jpg"
                    });
                });
                
                // Add event listener to the trash button
                trashButton.addEventListener("click", function(e) {
                    e.stopPropagation(); // Prevent triggering the parent list item's click
                    
                    // Get the image URL from the favorite object
                    const imageUrl = favorite.backgroundImage;
                    
                    // Use your removeFromFavorites function to delete this item
                    removeFromFavorites(imageUrl)
                        .then(removed => {
                            if (removed) {
                                // Item was successfully removed from storage

                                display_added_toast("Image removed from Favorites", false);
                                
                                // Remove the list item from the DOM
                                listItem.classList.add('removing'); // Optional: add animation class
                                
                                // Remove element after animation or immediately
                                setTimeout(() => {
                                    listItem.remove();
                                    
                                    // Check if the list is now empty
                                    if (favoritesList.children.length === 0) {
                                        // Show "no favorites" message
                                        const noFavoritesElement = document.createElement("div");
                                        noFavoritesElement.className = "no-favorites";
                                        noFavoritesElement.textContent = "No favorites added yet";
                                        modalBody.appendChild(noFavoritesElement);
                                    }
                                }, 300); // Adjust timeout to match your animation duration if used
                            } else {
                                display_added_toast("Error: Item not found in favorites", true);
                            }
                        })
                        .catch(error => {
                            display_added_toast("Error removing favorite", true);

                        });
                });
            });
            
            // Add the list to the modal body
            modalBody.appendChild(favoritesList);
        })
        .catch(error => {
            console.error("Error loading favorites:", error);
            modalBody.innerHTML = `<div class="error-message">Error loading favorites: ${error.message}</div>`;
        });

    // Set up the close button event listener
    const closeButton = document.querySelector(".close-fav-modal");
    closeButton.addEventListener("click", () => {
        modal.style.display = "none";
    });

});

function saveToLocalStorage(key, value) {
    try {
        // Check if key is valid
        if (!key || typeof key !== "string") {
            console.error("Invalid key provided to saveToLocalStorage");
            return false;
        }

        // Convert non-string values to JSON string
        const valueToStore = typeof value === "string"
            ? value
            : JSON.stringify(value);

        // Save to localStorage
        localStorage.setItem(key, valueToStore);

        return true;
    } catch (error) {
        // Handle errors (like exceeding storage quota)
        console.error(`Error saving to local storage: ${error.message}`);
        return false;
    }
}


function initializeTopVisitedBookmarks() {
    chrome.history.search({
        text: "",
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

    // Create the favicon URL using Chrome"s API
    const faviconUrl = new URL(chrome.runtime.getURL("/_favicon/"));
    faviconUrl.searchParams.set("pageUrl", baseUrl);
    faviconUrl.searchParams.set("size", "32");

    return faviconUrl.toString();
}


function handleBookmarks(bookmarks, sortedHistory) {
    const bookmarkUrls = new Set(bookmarks.map(b => b.url));
    const frequentBookmarks = sortedHistory.filter(item => bookmarkUrls.has(item.url));

    allFrequentBookmarks = frequentBookmarks;

    const linkContainer = document.getElementById("top-links-container");
    linkContainer.innerHTML = ""; // Clear the container

    // Add top 9 bookmarks
    frequentBookmarks.slice(0, 9).forEach(bm => {
        const link = document.createElement("a");
        link.href = bm.url;
        link.className = "top-link";
        link.target = "_blank";

        const icon = document.createElement("img");
        icon.src = `https://www.google.com/s2/favicons?domain=${new URL(bm.url).hostname}&sz=32`;

        // icon.src = faviconURL(bm.url);
        icon.className = "site-icon";
        icon.alt = `${bm.title} icon`;

        const span = document.createElement("span");
        span.textContent = bm.title;

        link.appendChild(icon);
        link.appendChild(span);
        linkContainer.appendChild(link);
    });

    const frequentlyVisitedLink = document.createElement("a");
    frequentlyVisitedLink.id = "frequent";
    frequentlyVisitedLink.className = "top-link";
    const span = document.createElement("span");
    span.textContent = "Frequently Visited";
    frequentlyVisitedLink.appendChild(span);
    // Add event listener right after creating the element
    frequentlyVisitedLink.addEventListener("click", () => handleFrequentlyVisited());

    linkContainer.appendChild(frequentlyVisitedLink);
}

async function handleFrequentlyVisited() {
    try {
        const historyItems = await getHistoryItems();
        const sortedItems = processHistoryItems(historyItems);
        displayModal(sortedItems);
    } catch (error) {
        console.error("Error handling frequently visited:", error);
    }
}

function getHistoryItems() {
    const millisecondsPerDay = 1000 * 60 * 60 * 24;
    const thirtyDaysAgo = new Date().getTime() - (30 * millisecondsPerDay);

    return new Promise((resolve, reject) => {
        chrome.history.search({
            text: "",              // Return all history items
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
    const modalBody = modal.querySelector(".modal-body");

    // Clear existing content
    modalBody.innerHTML = "";

    // Add each history item to the modal
    items.forEach(item => {
        const row = createHistoryRow(item);
        modalBody.appendChild(row);
    });

    // Show the modal
    modal.style.display = "block";
}

function createIcon(url) {
    const iconContainer = document.createElement("div");
    // Try to create an img element with favicon first
    const img = document.createElement("img");
    img.style.width = "16px";
    img.style.height = "16px";
    img.style.marginRight = "12px";
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
    const row = document.createElement("div");
    row.className = "item-row";

    // Create favicon element
    const icon = createIcon(item.url);

    // Create title element
    const title = document.createElement("span");
    title.className = "item-text";
    title.textContent = item.title;
    title.title = item.url; // Show full URL on hover

    // Create visit count element
    const count = document.createElement("span");
    count.className = "item-number";
    count.textContent = `Visited ${item.visitCount} Times`;

    // Add click handler to row
    row.addEventListener("click", () => {
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
    chrome.storage.local.get(["backgroundImage"], function (result) {
        if (result.backgroundImage) {
            document.body.style.backgroundImage = `url(${result.backgroundImage})`;
            document.body.style.backgroundSize = "cover";
            document.body.style.backgroundPosition = "center";
            document.body.style.backgroundRepeat = "no-repeat";
        }
    });

    chrome.storage.local.get(["photographer"], function (result) {
        if (result.photographer) {
            const photo_el = document.getElementById("photographer");
            photo_el.textContent = result.photographer;
        }
    })
    chrome.storage.local.get(["photo_url"], function (result) {
        if (result.photo_url) {
            const photo_el = document.getElementById("photographer-url");
            photo_el.href = result.photo_url;
        }
    })
}

document.querySelector(".close-button").addEventListener("click", (e) => {
    e.preventDefault();
    const modal = document.getElementById("myModal");
    modal.style.display = "none";
});


function getLocation() {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            reject("Geolocation is not supported by this browser");
        }

        navigator.geolocation.getCurrentPosition(
            position => resolve(position.coords),
            error => reject(error)
        );
    });
}

// Then fetch weather using OpenWeatherMap
async function getWeather(latitude, longitude) {

    const cachedWeather = localStorage.getItem("weatherData");
    const weatherTimestamp = localStorage.getItem("weatherTimestamp");
    const hasWeatherData = localStorage.getItem("hasWeatherData");

    // Check if we have cached data and it"s less than 30 minutes old
    if (hasWeatherData === "true" && cachedWeather && weatherTimestamp) {
        const cachedTime = parseInt(weatherTimestamp);
        const currentTime = new Date().getTime();
        const thirtyMinutes = 30 * 60 * 1000; // 30 minutes in milliseconds

        if (currentTime - cachedTime < thirtyMinutes) {
            return JSON.parse(cachedWeather);
        }
    }

    const APIKEY = "4630d89d8cf8b5704e8ce70a8f3cdaaf"; // Sign up at OpenWeatherMap for free API key
    const url = `https://api.openweathermap.org/data/2.5/weather?lat=${latitude}&lon=${longitude}&units=imperial&appid=${APIKEY}`;

    try {
        const response = await fetch(url);
        const data = await response.json();

        // Save the weather data and timestamp to localStorage
        localStorage.setItem("weatherData", JSON.stringify(data));
        localStorage.setItem("weatherTimestamp", new Date().getTime().toString());
        localStorage.setItem("hasWeatherData", "true");

        return data;
    } catch (error) {
        console.error("Error fetching weather:", error);
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

    const timeIndicator = document.querySelector(".current-time");
    timeIndicator.style.left = `${Math.min(Math.max(percentage, 0), 100)}%`;
}

function get_sun_set_rise(date) {
    const new_date = new Date(date * 1000);
    return new_date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// Example function to update weather data
function updateWeatherData(data) {

    const sunriseString = get_sun_set_rise(data.sys.sunrise);
    const sunsetString = get_sun_set_rise(data.sys.sunset);

    // Get actual Date objects for sunrise and sunset
    const sunriseDate = new Date(data.sys.sunrise * 1000);
    const sunsetDate = new Date(data.sys.sunset * 1000);

    document.querySelector(".sunrise").textContent = `Sunrise: ${sunriseString}`;
    document.querySelector(".sunset").textContent = `Sunset: ${sunsetString}`;

    // Update time indicator with actual sunrise/sunset times
    updateTimeIndicator(sunriseDate, sunsetDate);

    // Update location
    document.querySelector(".location h1").textContent = data.name;
    document.querySelector(".coordinates").textContent =
        `${data.coord.lat}\u00B0 ${data.coord.lat >= 0 ? "N" : "S"} | ${data.coord.lon}\u00B0 ${data.coord.lon >= 0 ? "E" : "W"}`;

    document.getElementById("fl").textContent = Math.round(data.main.feels_like);
    document.getElementById("hum").textContent = data.main.humidity;
    document.getElementById("pres").textContent = data.main.pressure;
    document.getElementById("temp").textContent = Math.round(data.main.temp);
    document.getElementById("max-temp").textContent = Math.round(data.main.temp_max);
    document.getElementById("min-temp").textContent = Math.round(data.main.temp_min);

    const date = new Date();  // Create current date
    date.setTime(date.getTime() + (data.timezone * 1000));

    const timeZone = new Intl.DateTimeFormat("en-US", {
        timeZoneName: "long"
    }).format(date);

    document.getElementById("tz").textContent = timeZone;

}

// Usage
async function getLocationAndWeather() {
    try {
        const coords = await getLocation();
        const weather = await getWeather(coords.latitude, coords.longitude);

        const weatherButton = document.getElementById("open-weather");

        weatherButton.textContent = `${weather.name} ${Math.round(weather.main.temp)}\u00B0F`;

        const currentHour = new Date().getHours();

        const modal = document.querySelector(".weather-card");

        // First, remove any previous gradient classes
        modal.classList.remove("sunrise-gradient", "midday-gradient", "sunset-gradient", "night-gradient");

        // Then add the appropriate gradient class based on time
        if (currentHour >= 5 && currentHour < 8) {
            modal.classList.add("sunrise-gradient");
        } else if (currentHour >= 8 && currentHour < 16) {
            modal.classList.add("midday-gradient");
        } else if (currentHour >= 16 && currentHour < 20) {
            modal.classList.add("sunset-gradient");
        } else {
            modal.classList.add("night-gradient");
        }

        weatherButton.addEventListener("click", (e) => {
            modal.style.display = "block";
            modal.classList.remove("slide-down-fade-out");
            modal.classList.add("slide-up-fade-in");
            updateWeatherData(weather);

            document.querySelector(".close-button-2").addEventListener("click", (e) => {
                e.preventDefault();
                modal.classList.remove("slide-up-fade-in");
                modal.classList.add("slide-down-fade-out");
            });
        });
        // updateWeatherData(weather);
    } catch (error) {
        console.error("Error:", error);
    }
}



function date_time() {
    date = new Date;
    h = date.getHours();
    if (h > 12) {
        h = h - 12;
    }
    if (h < 10) {
        if (h === 0) {
            h = "12";
        } else {
            h = "0" + h;
        }
    }
    m = date.getMinutes();
    if (m < 10) {
        m = "0" + m;
    }
    s = date.getSeconds();
    if (s < 10) {
        s = "0" + s;
    }

    const clock_status = localStorage.getItem("clock");

    if (clock_status === "1") {
        document.getElementById("s").innerHTML = "" + s;
        document.getElementById("m").innerHTML = "" + m;
        document.getElementById("h").innerHTML = "" + h;
    } else {
        document.getElementById("b-s").innerHTML = ":" + s;
        document.getElementById("b-m").innerHTML = ":" + m;
        document.getElementById("b-h").innerHTML = "" + h;
    }

}

window.onload = function () {
    date_time();

    setInterval(date_time, 1000);
};


function display_modern_clock() {
    normal_clock.style.display = "none";
    modern_clock.style.display = "block";
}

function display_normal_clock() {
    modern_clock.style.display = "none";
    normal_clock.style.display = "flex";
}

const clockSettingsToggle = document.getElementById('clockSettingsToggle');
let isRotated = false;

clockSettingsToggle.addEventListener('click', () => {
    isRotated =!isRotated;

    if (isRotated) {
        clockSettingsToggle.classList.add('rotate');
        displayClockSettings(true);
    } else {
        clockSettingsToggle.classList.remove('rotate');
        displayClockSettings(false);
    }
});

function displaySettingsToggle(show = true) {

    if (show) {
        // clockSettingsToggle.classList.add('rotate');
        clockSettingsToggle.style.display = 'block';
        clockUpdates();
    } else {
        clockSettingsToggle.style.display = 'none';
    }
};

function displayClockSettings(show = true) {
    // Get all the setting row elements
    const settingRows = [
        document.getElementById('clock-setting-1'),
        document.getElementById('clock-setting-2'),
        document.getElementById('clock-setting-3'),
        document.getElementById('clock-setting-4')
    ];
    
    if (show) {
        // Show animation sequence
        settingRows.forEach((row, index) => {
            if (row) {
                row.style.display = 'flex'; // Set to flex first to enable animation
                
                // Use setTimeout to create a sequential reveal
                setTimeout(() => {
                    row.classList.remove('hidden');
                    row.classList.add('animate');
                }, index * 100); // 100ms delay between each row
            }
        });
    } else {
        // Hide animation sequence (in reverse order for a nice effect)
        for (let i = settingRows.length - 1; i >= 0; i--) {
            const row = settingRows[i];
            if (row) {
                // Calculate delay based on reverse position
                const delay = (settingRows.length - 1 - i) * 100;
                
                setTimeout(() => {
                    row.classList.remove('animate');
                    row.classList.add('hidden');
                    
                    // Set display:none after the animation completes
                    setTimeout(() => {
                        row.style.display = 'none';
                    }, 500); // Match this to your transition duration
                }, delay);
            }
        }
    }
}

clock_type_1.addEventListener("change", (e) => {
    if (clock_type_1.checked) {
        clock_type_2.checked = false;
        saveToLocalStorage("clock", "1");
        display_modern_clock();
        display_toast("clock-modern", clock_type_1);
        displaySettingsToggle(true);
        // displayClockSettings(true);
        // clockUpdates();
    } else {
        // Prevent unchecking if user clicked on an already checked box
        clock_type_1.checked = true;
    }
});

clock_type_2.addEventListener("change", (e) => {
    if (clock_type_2.checked) {
        clock_type_1.checked = false;
        saveToLocalStorage("clock", "2");
        display_normal_clock();
        display_toast("clock-basic", clock_type_2);
        displaySettingsToggle(false);
        // displayClockSettings(false);
    } else {
        // Prevent unchecking if user clicked on an already checked box
        clock_type_2.checked = true;
    }
});



function display_added_toast(message, error) {
    const toast = document.getElementById("toast");
    const toast_message = toast.querySelector(".toast-message");
    
    // Store original HTML content
    const originalHTML = toast.innerHTML;
    
    // Set message text
    toast_message.textContent = message;
    
    // Replace icon if error is true
    if (error) {
        const toast_icon = toast.querySelector(".fa-circle-check");
        if (toast_icon) {
            toast_icon.className = "fa-solid fa-circle-xmark";
        }
    }
    
    // Show toast with animation
    toast.classList.remove("toast-hidden");
    toast.classList.remove("slide-down");
    toast.classList.add("slide-up");
    
    // Hide toast and reset original HTML
    setTimeout(() => {
        toast.classList.remove("slide-up");
        toast.classList.add("slide-down");
        
        // Reset original HTML after slide down animation completes
        setTimeout(() => {
            toast.innerHTML = originalHTML;
        }, 300); // Adjust timing based on your slide-down animation duration
    }, 1000);
}

function display_toast(type, box) {
    const toast = document.getElementById("toast");
    const toast_message = toast.querySelector(".toast-message");

    const messageMap = {
        "freq-v": {
            checked: "Frequently visited bar hidden",
            unchecked: "Frequently visited bar enabled"
        },
        "weather-v": {
            checked: "Weather information hidden",
            unchecked: "Weather information enabled"
        },
        "clock-modern": {
            checked: "Modern clock enabled"
        },
        "clock-basic": {
            checked: "Basic clock enabled"
        },
        "search": {
            checked: "Search Bar hidden",
            unchecked: "Search Bar enabled"
        }
    };

    const state = box.checked ? "checked" : "unchecked";
    if (messageMap[type] && messageMap[type][state]) {
        toast_message.textContent = messageMap[type][state];
    }

    toast.classList.remove("toast-hidden");
    toast.classList.remove("slide-down");
    toast.classList.add("slide-up");

    setTimeout(() => {
        toast.classList.remove("slide-up");
        toast.classList.add("slide-down");
    }, 1000);
}

function handleSearchBarChange() {
    const searchBar = document.getElementById("search-bar");
    searchBar.style.display = "flex";
    saveToLocalStorage("search", searchCheckbox.checked);
    display_toast("search", searchCheckbox);

    if (searchCheckbox.checked) {
        searchBar.classList.remove("slide-up-animate");
        searchBar.classList.add("slide-down-animate");
    } else {
        searchBar.classList.remove("slide-down-animate");
        searchBar.classList.add("slide-up-animate");
    }
}

// Function for the Frequently Visited Bar checkbox
function handleFrequentlyVisitedChange() {
    const top_links = document.getElementById("top-links-container");
    top_links.style.display = "flex";
    saveToLocalStorage("freq-v", frequentlyVisitedCheckbox.checked);
    display_toast("freq-v", frequentlyVisitedCheckbox);
    if (frequentlyVisitedCheckbox.checked) {
        top_links.classList.remove("slide-down-fade-in");
        top_links.classList.add("slide-up-fade-out");
    } else {
        top_links.classList.remove("slide-up-fade-out");
        top_links.classList.add("slide-down-fade-in");
    }
}

// Function for the Weather checkbox
function handleWeatherChange() {
    const weatherButton = document.getElementById("open-weather");
    weatherButton.style.display = "flex";
    saveToLocalStorage("weather-v", weatherCheckbox.checked);
    display_toast("weather-v", weatherCheckbox);
    if (weatherCheckbox.checked) {
        weatherButton.classList.remove("slide-up-fade-in");
        weatherButton.classList.add("slide-down-fade-out");
    } else {
        weatherButton.classList.remove("slide-down-fade-out");
        weatherButton.classList.add("slide-up-fade-in");
    }
}


function initializeFromLocalStorage() {
    const freqValue = localStorage.getItem("freq-v");
    const weatherValue = localStorage.getItem("weather-v");
    const searchValue = localStorage.getItem("search");
    if (freqValue === "true") {
        const top_links = document.getElementById("top-links-container");
        // top_links.classList.add("slide-up-fade-out");
        top_links.style.display = "none";
        frequentlyVisitedCheckbox.checked = true;
    }
    if (weatherValue === "true") {
        const weatherButton = document.getElementById("open-weather");
        weatherButton.style.display = "none";
        weatherCheckbox.checked = true;
    }
    if (searchValue === "true") {
        const searchBar = document.getElementById("search-bar");
        searchBar.style.display = "none";
        searchCheckbox.checked = true;
    }
}


// Listen for mousedown on the drag bar
let parentWidth, parentHeight;

// Get parent container dimensions
function updateContainerDimensions() {
    const parentRect = parent_container.getBoundingClientRect();
    parentWidth = parentRect.width;
    parentHeight = parentRect.height;
}

drag_bar.addEventListener("mousedown", (e) => {
    // Prevent default behavior (like text selection)
    e.preventDefault();

    // Update container dimensions
    updateContainerDimensions();

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
    document.body.classList.add("no-select");
});

function loadSavedPosition() {
    const savedX = localStorage.getItem("containerX");
    const savedY = localStorage.getItem("containerY");

    // Update container dimensions
    updateContainerDimensions();

    if (savedX !== null && savedY !== null) {
        // Ensure the position is within the viewport
        const adjustedX = constrainToViewport(parseInt(savedX), 'x');
        const adjustedY = constrainToViewport(parseInt(savedY), 'y');

        parent_container.style.left = `${adjustedX}px`;
        parent_container.style.top = `${adjustedY}px`;
        parent_container.style.right = "auto"; // Switch to left positioning
    }
}

// Constrain a coordinate to ensure the element stays within the viewport
function constrainToViewport(value, axis) {
    if (axis === 'x') {
        // Get the viewport width
        const viewportWidth = window.innerWidth;

        // Ensure the element isn't off the left edge
        value = Math.max(0, value);

        // Ensure the element isn't off the right edge
        value = Math.min(value, viewportWidth - parentWidth);
    } else if (axis === 'y') {
        // Get the viewport height
        const viewportHeight = window.innerHeight;

        // Ensure the element isn't off the top edge
        value = Math.max(0, value);

        // Ensure the element isn't off the bottom edge
        value = Math.min(value, viewportHeight - parentHeight);
    }

    return value;
}

// Listen for mousemove on the entire document
document.addEventListener("mousemove", (e) => {
    // Only track movement if currently dragging
    if (isDragging) {
        // Prevent default behavior
        e.preventDefault();

        // Get the current mouse position
        const x = e.clientX;
        const y = e.clientY;

        // Calculate the new position of the container
        let newLeft = x - offsetX;
        let newTop = y - offsetY;

        // Constrain the position to the viewport
        newLeft = constrainToViewport(newLeft, 'x');
        newTop = constrainToViewport(newTop, 'y');

        // Update the position of the parent container
        parent_container.style.left = `${newLeft}px`;
        parent_container.style.top = `${newTop}px`;
        // If the container was using "right" positioning, we need to change to "left"
        parent_container.style.right = "auto";
    }
});

function savePosition(x, y) {
    localStorage.setItem("containerX", x);
    localStorage.setItem("containerY", y);
}

// Listen for mouseup on the entire document
document.addEventListener("mouseup", (e) => {
    // Only do something if we were dragging
    if (isDragging) {
        // Stop dragging
        isDragging = false;

        // Remove the no-select class
        document.body.classList.remove("no-select");

        // Get the final position of the parent container
        const parentRect = parent_container.getBoundingClientRect();
        const finalLeft = parentRect.left;
        const finalTop = parentRect.top;

        // Save the final position
        savePosition(finalLeft, finalTop);
    }
});

// Add this to ensure dragging stops if mouse leaves the window
document.addEventListener("mouseleave", (e) => {
    if (isDragging) {
        isDragging = false;

        // Remove the no-select class
        document.body.classList.remove("no-select");

        // Get the current position of the parent container
        const parentRect = parent_container.getBoundingClientRect();
        const finalLeft = parentRect.left;
        const finalTop = parentRect.top;

        // Save the position even if drag was canceled
        savePosition(finalLeft, finalTop);
    }
});

// Listen for window resize and adjust position if needed
window.addEventListener("resize", () => {
    // Update container dimensions
    updateContainerDimensions();

    // Get the current position
    const parentRect = parent_container.getBoundingClientRect();
    let currentLeft = parentRect.left;
    let currentTop = parentRect.top;

    // Constrain to the new viewport size
    const adjustedLeft = constrainToViewport(currentLeft, 'x');
    const adjustedTop = constrainToViewport(currentTop, 'y');

    // Only update if the position needs to change
    if (currentLeft !== adjustedLeft || currentTop !== adjustedTop) {
        parent_container.style.left = `${adjustedLeft}px`;
        parent_container.style.top = `${adjustedTop}px`;

        // Save the adjusted position
        savePosition(adjustedLeft, adjustedTop);
    }
});

// Call this when the page loads to initialize
updateContainerDimensions();
loadSavedPosition();



function applyShake(element) {
    // Add the shake class
    element.classList.add('shake');

    // Remove the class after animation completes to allow it to be triggered again
    element.addEventListener('animationend', function () {
        element.classList.remove('shake');
    }, { once: true }); // Using {once: true} ensures the event listener is removed after use
}


function google_search(textInput, bar) {
    if (textInput === '') {
        applyShake(bar);
        return false;
    }

    const searchQuery = textInput.trim();

    // Create and navigate to a Google search URL
    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(searchQuery)}`;
    window.location.href = searchUrl;

    return true;
};


// Search box logic
document.addEventListener('DOMContentLoaded', function () {
    const searchInput = document.getElementById('search-input');
    const magnifyingGlassIcon = document.querySelector('.mag-icon');
    const searchBar = document.getElementById('search-bar');

    searchBar.addEventListener('click', function () {
        searchInput.focus();
    });

    searchInput.addEventListener('focus', function () {
        magnifyingGlassIcon.classList.add('active');
    });

    searchInput.addEventListener('blur', function () {
        if (this.value.length === 0) {
            magnifyingGlassIcon.classList.remove('active');
        }
    });

    searchInput.addEventListener('input', function () {
        if (this.value.length > 0) {
            magnifyingGlassIcon.classList.add('active');
        } else {
            magnifyingGlassIcon.classList.remove('active');
        }
    });

    searchInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
            const valid_input = google_search(searchInput.value, searchBar);
            if (valid_input) {
                searchInput.blur();
            }
        }
    });

    magnifyingGlassIcon.addEventListener('click', function (e) {
        e.stopPropagation();
        // Trigger Google Search
        const valid_input = google_search(searchInput.value, searchBar);
        if (valid_input) {
            searchInput.blur();
        } else {
            searchInput.focus();
        }

    });

    magnifyingGlassIcon.addEventListener('mousedown', function () {
        magnifyingGlassIcon.classList.add('active');
    });

    magnifyingGlassIcon.addEventListener('mouseup', function () {
        magnifyingGlassIcon.classList.remove('active');
    });

});


// Color change handler functions defined outside the DOMContentLoaded
function handleBorderColorChange(color, borderPicker) {
    const trueColor = color.toRGBA();
    const red = trueColor[0];
    const green = trueColor[1];
    const blue = trueColor[2];

    const cube_faces = document.querySelectorAll('.face');

    const clockBorderColor = `rgba(${red}, ${green}, ${blue}, 0.3)`;

    cube_faces.forEach(face => {
        face.style.borderColor = clockBorderColor;
    });

    saveToLocalStorage("clockBorderColor", clockBorderColor);
    
    borderPicker.hide();
}

function handleBackgroundColorChange(color, backgroundPicker) {
    const colorValue = color.toRGBA().toString();

    const cube_face_1 = document.querySelector('.face.top');
    const cube_face_2 = document.querySelector('.face.front');
    const cube_face_3 = document.querySelector('.face.left');

    cube_face_1.style.backgroundColor = colorValue;
    cube_face_2.style.backgroundColor = colorValue;
    cube_face_3.style.backgroundColor = colorValue;

    saveToLocalStorage("clockBackground", colorValue);
    
    backgroundPicker.hide();
}

function handleShadowColorChange(color, shadowPicker, textElements) {
    const trueColor = color.toRGBA();
    const red = trueColor[0];
    const green = trueColor[1];
    const blue = trueColor[2];

    const clockShadowColor = `rgba(${red}, ${green}, ${blue}, 0.8)`;

    // Update only the shadow color for each element
    textElements.forEach(element => {
        if (element) {
            // Create new text-shadow with the selected color
            const newTextShadow = `0px 0px 5px #000, 
                -1px -1px 0 ${clockShadowColor},
                1px -1px 0 ${clockShadowColor}, 
                -1px 1px 0 ${clockShadowColor},
                1px 1px 0 ${clockShadowColor}`;
                
            // Apply the new text-shadow
            element.style.textShadow = newTextShadow;
        }
    });
    
    saveToLocalStorage("clockShadowColor", clockShadowColor);
}

function handleTextColorChange(color, textPicker, textElements) {
    const trueColor = color.toRGBA();
    const red = trueColor[0];
    const green = trueColor[1];
    const blue = trueColor[2];

    const clockTextColor = `rgba(${red}, ${green}, ${blue}, 0.8)`;

    textElements.forEach(element => {
        if (element) {
            element.style.color = clockTextColor;
        }
    });

    saveToLocalStorage("clockTextColor", clockTextColor);
}

function getUserColors() {
    const clockBackground = localStorage.getItem("clockBackground");
    const clockBorderColor = localStorage.getItem("clockBorderColor");
    const clockShadowColor = localStorage.getItem("clockShadowColor");
    const clockTextColor = localStorage.getItem("clockTextColor");
    
    // Object to store all found colors
    const savedColors = {};
    
    if (clockBackground) {
        savedColors.background = clockBackground;
        
        const faces = document.querySelectorAll('.face');
        faces.forEach(face => {
            face.style.backgroundColor = clockBackground;
        });
    }
    
    if (clockBorderColor) {
        savedColors.border = clockBorderColor;
                
        const cube_faces = document.querySelectorAll('.face');
        cube_faces.forEach(face => {
            face.style.borderColor = clockBorderColor;
        });
        
    }
    
    if (clockShadowColor) {
        savedColors.shadow = clockShadowColor;
        
        
        const textElements = [
            document.getElementById('s'),
            document.getElementById('m'),
            document.getElementById('h')
        ];
        
        textElements.forEach(element => {
            if (element) {
                const newTextShadow = `0px 0px 5px #000, 
                    -1px -1px 0 ${clockShadowColor},
                    1px -1px 0 ${clockShadowColor}, 
                    -1px 1px 0 ${clockShadowColor},
                    1px 1px 0 ${clockShadowColor}`;
                
                element.style.textShadow = newTextShadow;
            }
        });
        
    }
    
    if (clockTextColor) {

        savedColors.text = clockTextColor;
        
        // Parse the rgba string from localStorage
        const rgbaMatch = clockTextColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*(\d*(?:\.\d+)?))?\)/);
        if (rgbaMatch) {
            const red = parseInt(rgbaMatch[1]);
            const green = parseInt(rgbaMatch[2]);
            const blue = parseInt(rgbaMatch[3]);
            
            const textColor = `rgba(${red}, ${green}, ${blue}, 0.8)`;
            
            const textElements = [
                document.getElementById('s'),
                document.getElementById('m'),
                document.getElementById('h')
            ];
            
            textElements.forEach(element => {
                if (element) {
                    element.style.color = textColor;
                }
            });
        }
    }
    
    return savedColors;
}



function colorPicker(id, opacity, defaultColor) {
    return Pickr.create({
        el: id,
        theme: 'nano', // 'classic', 'monolith', or 'nano'
        defaultRepresentation: 'RGBA',
        default: defaultColor, // Default color
        components: {
            preview: true,
            opacity: opacity === 1 ? true : false,
            hue: true,
            interaction: {
                hex: true,
                rgba: true,
                hsla: false,
                input: true,
                clear: false,
                save: true
            }
        }
    });
};

const colorReset = document.querySelector('.fa-rotate-left');

colorReset.addEventListener('click', function () {
    // Remove the clock settings from localStorage
    localStorage.removeItem("clockBackground");
    localStorage.removeItem("clockBorderColor");
    localStorage.removeItem("clockShadowColor");
    localStorage.removeItem("clockTextColor");
    
    // Reload the page
    location.reload();
});

function clockUpdates() {

    const saved_colors = getUserColors();

    // Use 'let' instead of 'const' for variables that will be reassigned
    let backgroundColor = "";
    let shadowColor = "";
    let textColor = "";
    let borderColor = "";

    if (saved_colors.background) {
        backgroundColor = saved_colors.background;
    } else {
        backgroundColor = "rgb(34, 34, 34)";
    }

    if (saved_colors.shadow) {
        shadowColor = saved_colors.shadow;
    } else {
        shadowColor = "rgba(255, 255, 255, 1)";  // Added alpha value
    }

    if (saved_colors.text) {
        textColor = saved_colors.text;
    } else {
        textColor = "rgba(255, 255, 255, 1)";  // Added alpha value
    }

    if (saved_colors.border) {
        borderColor = saved_colors.border;
    } else {
        borderColor = "rgba(255, 255, 255, 1)";  // Added alpha value
    }

    // Initialize color picker
    const backgroundPicker = colorPicker('#color-picker-background', 1, backgroundColor);
    const shadowPicker = colorPicker('#color-picker-shadow', 0, shadowColor);
    const textPicker = colorPicker('#color-picker-text', 0, textColor);
    const borderPicker = colorPicker('#color-picker-border', 0, borderColor);

    const text_1 = document.getElementById('s');
    const text_2 = document.getElementById('m');
    const text_3 = document.getElementById('h');

    const textElements = [text_1, text_2, text_3];

    // Attach handlers to pickers with their required parameters
    borderPicker.on('save', (color) => handleBorderColorChange(color, borderPicker));
    backgroundPicker.on('save', (color) => handleBackgroundColorChange(color, backgroundPicker));
    shadowPicker.on('save', (color) => handleShadowColorChange(color, shadowPicker, textElements));
    textPicker.on('save', (color) => handleTextColorChange(color, textPicker, textElements));
}


document.addEventListener("DOMContentLoaded", function () {

    initializeTopVisitedBookmarks();
    setBackgroundImage();

    getLocationAndWeather();

    initializeFromLocalStorage();
    loadSavedPosition();

    displayClockSettings(false);

    const clock_status = localStorage.getItem("clock");

    if (clock_status) {
        if (clock_status === "1") {
            clock_type_1.checked = true;
            clock_type_2.checked = false;
            display_modern_clock();
            displaySettingsToggle(true);
            // displayClockSettings(true);
            // clockUpdates();
        } else if (clock_status === "2") {
            clock_type_1.checked = false;
            clock_type_2.checked = true;
            display_normal_clock();
            displaySettingsToggle(false);
            // displayClockSettings(false);
        }
    } else {
        saveToLocalStorage("clock", "1");
        clock_type_1.checked = true;
        clock_type_2.checked = false;
        display_modern_clock();
        displaySettingsToggle(false);
        // displayClockSettings(false);
        // clockUpdates();
    }

    const modal = document.getElementById("myModal");

    // Function to close modal
    function closeModal() {
        modal.style.display = "none";
    }

    // Add click event listener to close button
    const closeBtn = document.querySelector(".close");
    if (closeBtn) {
        closeBtn.addEventListener("click", closeModal);
    }

    // Close modal when clicking outside
    window.onclick = function (event) {
        if (event.target == modal) {
            modal.style.display = "none";
        }
    }

    // Get the settings button element
    const settingsButton = document.getElementById("settings");
    const exitButton = document.getElementById("close-settings");

    const settingsContainer = document.querySelector(".settings-container");

    exitButton.addEventListener("click", function (event) {
        event.preventDefault();

        // Check if the button has the "open" class
        if (settingsButton.classList.contains("open")) {
            // If open, we want to close it
            settingsContainer.classList.remove("slide-up-fade-in");
            settingsContainer.classList.add("slide-down-fade-out");

            // Update button classes
            settingsButton.classList.remove("open");
            settingsButton.classList.add("closed");
        }

    });

    // Add click event listener to the settings button
    settingsButton.addEventListener("click", function (event) {
        // Prevent default link behavior if this is an anchor tag
        event.preventDefault();

        // Check if the button has the "open" class
        if (settingsButton.classList.contains("open")) {
            // If open, we want to close it
            settingsContainer.classList.remove("slide-up-fade-in");
            settingsContainer.classList.add("slide-down-fade-out");

            // Update button classes
            settingsButton.classList.remove("open");
            settingsButton.classList.add("closed");
        } else if (settingsButton.classList.contains("closed")) {
            // If closed, we want to open it
            settingsContainer.classList.remove("slide-down-fade-out");
            settingsContainer.classList.add("slide-up-fade-in");

            // Update button classes
            settingsButton.classList.remove("closed");
            settingsButton.classList.add("open");
        }
    });

});