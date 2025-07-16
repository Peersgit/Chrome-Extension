let allFrequentBookmarks = [];
let accentPickerInitialized = false;

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

// Drag functionality removed - no longer needed with new HTML structure

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

const alldownloadButton = document.getElementById("download-all");


alldownloadButton.addEventListener("click", function (e) {
    e.preventDefault();
    
    chrome.storage.local.get(['favorites'], function (result) {
        const favorites = result.favorites || [];
        
        if (favorites.length === 0) {
            alert("No favorites to download");
            return;
        }
        
        // Create a new ZIP file
        const zip = new JSZip();
        let filesProcessed = 0;
        
        favorites.forEach((favorite, index) => {
            // Fetch each image
            fetch(favorite.backgroundImage)
                .then(response => response.blob())
                .then(blob => {
                    // Add file to ZIP with a unique name
                    const fileName = `image_${index + 1}.jpg`;
                    zip.file(fileName, blob);
                    
                    filesProcessed++;
                    
                    // When all files are processed, generate and download the ZIP
                    if (filesProcessed === favorites.length) {
                        zip.generateAsync({type: "blob"})
                            .then(content => {
                                // Create a download URL for the ZIP
                                const zipUrl = URL.createObjectURL(content);
                                
                                // Download the ZIP file
                                chrome.downloads.download({
                                    url: zipUrl,
                                    filename: "favorites.zip",
                                    saveAs: true
                                });
                            });
                    }
                })
                .catch(error => {
                    console.error("Error fetching image:", error);
                    filesProcessed++;
                });
        });
    });
});

add_to_favorites.addEventListener("click", function (e) {
    addToFavorites();
});

favoritesDialog.addEventListener("click", (event) => {
    const modal = document.getElementById("fav-modal");
    const modalBody = modal.querySelector(".modal-bod");
    const popOut = document.querySelector(".pop-out");

    // Hide the pop-out if it's visible
    if (popOut && !popOut.classList.contains("hidden")) {
        popOut.classList.add("hidden");
        const caretIcon = document.querySelector('.dev-pull-out-tab i');
        if (caretIcon) {
            caretIcon.className = 'fa-solid fa-caret-right';
        }
    }

    // Clear any existing list items
    modalBody.innerHTML = '';

    // Show the modal immediately
    modal.style.display = "flex";
    
    // Add a small delay to trigger the fade-in animation
    setTimeout(() => {
        modal.classList.add("show");
    }, 10);

                // Create a loading indicator
            const loadingElement = document.createElement("div");
            loadingElement.className = "loading-favorites";
            loadingElement.textContent = "Loading favorites...";
            modalBody.appendChild(loadingElement);
            
            // Create a progress indicator
            const progressElement = document.createElement("div");
            progressElement.className = "loading-progress";
            progressElement.textContent = "Loading... 0 of 0 images";
            modalBody.appendChild(progressElement);

    // Get the favorites and populate the modal
    getFavorites()
        .then(favorites => {
            // Remove loading indicator
            modalBody.removeChild(loadingElement);
            
            // Update progress indicator with actual count
            const progressElement = modalBody.querySelector('.loading-progress');
            if (progressElement) {
                progressElement.textContent = `Loading... 0 of ${favorites.length} images`;
            }

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

            // Add each favorite to the list progressively
            const addFavoritesProgressively = async (favorites, startIndex = 0) => {
                const batchSize = 3; // Load 3 images at a time
                const endIndex = Math.min(startIndex + batchSize, favorites.length);
                
                // Update loading progress
                const progressElement = modalBody.querySelector('.loading-progress');
                if (progressElement) {
                    progressElement.textContent = `Loading... ${endIndex} of ${favorites.length} images`;
                }
                
                for (let i = startIndex; i < endIndex; i++) {
                    const favorite = favorites[i];
                    const listItem = document.createElement("li");
                    listItem.className = "favorite-item";

                    // Create the item's HTML structure with a placeholder
                    listItem.innerHTML = `
                        <div class="favorite-image">
                            <div class="image-placeholder">
                                <i class="fa-solid fa-image"></i>
                            </div>
                            <img src="${favorite.backgroundImage}" alt="Background image" class="thumbnail" loading="lazy">
                            <div class="favorite-info">
                                <span class="photographer-name">${favorite.photographer || 'Unknown'}</span>
                                <div class="favorite-actions">
                                    <i class="fa-solid fa-file-arrow-down" title="Download Image"></i>
                                    <i class="fa-solid fa-trash" title="Remove Image"></i>
                                </div>
                            </div>
                        </div>
                    `;

                    // Add the item to the list
                    favoritesList.appendChild(listItem);

                    // Handle image loading
                    const img = listItem.querySelector('.thumbnail');
                    const placeholder = listItem.querySelector('.image-placeholder');
                    
                    img.onload = () => {
                        placeholder.style.display = 'none';
                        img.style.opacity = '1';
                    };
                    
                    img.onerror = () => {
                        placeholder.innerHTML = '<i class="fa-solid fa-exclamation-triangle"></i>';
                        placeholder.style.color = '#ff4444';
                    };

                    // Add event listeners
                    const downloadButton = listItem.querySelector(".fa-file-arrow-down");
                    const trashButton = listItem.querySelector(".fa-trash");

                    // Add event listener to the download button
                    downloadButton.addEventListener("click", function (e) {
                        e.stopPropagation(); // Prevent triggering the parent list item's click

                        // Use Chrome's download API to download the image
                        chrome.downloads.download({
                            url: favorite.backgroundImage,
                            filename: "background.jpg"
                        });
                    });

                    // Add event listener to the trash button
                    trashButton.addEventListener("click", function (e) {
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
                }

                // If there are more items to load, schedule the next batch
                if (endIndex < favorites.length) {
                    setTimeout(() => {
                        addFavoritesProgressively(favorites, endIndex);
                    }, 150); // Small delay between batches
                } else {
                    // All images loaded, remove progress indicator
                    const progressElement = modalBody.querySelector('.loading-progress');
                    if (progressElement) {
                        progressElement.remove();
                    }
                }
            };

            // Start loading favorites progressively
            addFavoritesProgressively(favorites);

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
        modal.classList.remove("show");
        setTimeout(() => {
            modal.style.display = "none";
        }, 300);
    });

    // Close modal when clicking outside
    modal.addEventListener("click", (event) => {
        if (event.target === modal) {
            modal.classList.remove("show");
            setTimeout(() => {
                modal.style.display = "none";
            }, 300);
        }
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
        try {
            const hostname = new URL(bm.url).hostname;
            icon.src = `https://www.google.com/s2/favicons?domain=${hostname}&sz=32`;
        } catch (error) {
            // If URL parsing fails, use a fallback icon
            icon.src = "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdCb3g9IjAgMCAxNiAxNiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTggMTZDMzU4NCAxNiAxNiAzNTg0IDE2IDhDMTYgMy41ODE3MiAxOS41ODE3IDAgMjQgMEMyOC40MTgzIDAgMzIgMy41ODE3MiAzMiA4QzMyIDEyLjQxODMgMjguNDE4MyAxNiAyNCAxNloiIGZpbGw9IiM2NjY2NjYiLz4KPC9zdmc+";
        }
        
        icon.className = "site-icon";
        icon.alt = `${bm.title} icon`;
        
        // Add error handling for favicon loading
        icon.onerror = () => {
            icon.src = "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdCb3g9IjAgMCAxNiAxNiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTggMTZDMzU4NCAxNiAxNiAzNTg0IDE2IDhDMTYgMy41ODE3MiAxOS41ODE3IDAgMjQgMEMyOC40MTgzIDAgMzIgMy41ODE3MiAzMiA4QzMyIDEyLjQxODMgMjguNDE4MyAxNiAyNCAxNloiIGZpbGw9IiM2NjY2NjYiLz4KPC9zdmc+";
        };

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

function processHistoryItems(historyItems) {
    // Get stored values from localStorage or use defaults
    const siteCount = parseInt(localStorage.getItem('siteCount')) || 50;

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
        .slice(0, siteCount); // Use stored siteCount
}

function getHistoryItems() {
    const millisecondsPerDay = 1000 * 60 * 60 * 24;
    const hundredDaysAgo = new Date().getTime() - (100 * millisecondsPerDay);

    return new Promise((resolve, reject) => {
        chrome.history.search({
            text: "",              // Return all history items
            startTime: hundredDaysAgo,
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

function displayModal(items) {
    const modal = document.getElementById("myModal");
    const modalBody = modal.querySelector(".modal-body");

    // Clear existing content
    modalBody.innerHTML = "";

    // Add each history item to the modal
    items.forEach((item, index) => {
        const row = createHistoryRow(item, index);
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

function createHistoryRow(item, index) {
    const row = document.createElement("div");
    row.className = "item-row";

    // Create rank number element
    const rank = document.createElement("span");
    rank.className = "item-rank";
    rank.textContent = `#${index + 1}`;

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
    row.appendChild(rank);
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
    isRotated = !isRotated;

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
        // Add a small delay to ensure DOM elements are rendered before initializing pickers
        setTimeout(() => {
            clockUpdates();
        }, 100);
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

    const settingsBody = document.querySelector('.settings-body');

    if (show) {
        // Show animation sequence with staggered delays
        settingRows.forEach((row, index) => {
            if (row) {
                // Set display to flex first
                row.style.display = 'flex';
                
                // Add staggered delay for each item
                setTimeout(() => {
                    row.classList.remove('hidden');
                    row.classList.add('animate');
                }, index * 100); // 100ms delay between each item
            }
        });
    } else {
        // Hide animation sequence (in reverse order for a nice effect)
        for (let i = settingRows.length - 1; i >= 0; i--) {
            const row = settingRows[i];
            if (row) {
                const delay = (settingRows.length - 1 - i) * 100; // Reverse delay
                
                setTimeout(() => {
                    row.classList.remove('animate');
                    row.classList.add('hidden');
                    
                    // Set display:none after the animation completes
                    setTimeout(() => {
                        row.style.display = 'none';
                    }, 300); // Match this to your transition duration
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
        // Clean up only clock-specific picker instances when switching to basic clock
        // (preserves accent color picker)
        cleanupClockPickers();
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


// Drag functionality removed - no longer needed with new HTML structure



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

function handleAccentColorChange(color, accentPicker) {
    const colorValue = color.toRGBA().toString();
    

    // Update CSS custom properties for both primary and secondary accent colors
    document.documentElement.style.setProperty('--color-blue-4a9eff', colorValue);
    
    // Create a slightly lighter version for the gradient
    const trueColor = color.toRGBA();
    const red = trueColor[0];
    const green = trueColor[1];
    const blue = trueColor[2];
    
    // Make the second color slightly lighter (increase brightness by 10%)
    const lighterRed = Math.min(255, Math.round(red * 1.1));
    const lighterGreen = Math.min(255, Math.round(green * 1.1));
    const lighterBlue = Math.min(255, Math.round(blue * 1.1));
    
    const secondaryColor = `rgba(${lighterRed}, ${lighterGreen}, ${lighterBlue}, 1)`;
    document.documentElement.style.setProperty('--color-blue-5ba8ff', secondaryColor);

    const saved = saveToLocalStorage("accentColor", colorValue);

    accentPicker.hide();
}

function getUserColors() {
    const clockBackground = localStorage.getItem("clockBackground");
    const clockBorderColor = localStorage.getItem("clockBorderColor");
    const clockShadowColor = localStorage.getItem("clockShadowColor");
    const clockTextColor = localStorage.getItem("clockTextColor");
    const accentColor = localStorage.getItem("accentColor");

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

    if (accentColor) {
        savedColors.accent = accentColor;
        
        // Update CSS custom property
        document.documentElement.style.setProperty('--color-blue-4a9eff', accentColor);
        
        // Also set the secondary color for the gradient
        const rgbaMatch = accentColor.match(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]*))?\)/);
        if (rgbaMatch) {
            const red = Math.round(parseFloat(rgbaMatch[1]));
            const green = Math.round(parseFloat(rgbaMatch[2]));
            const blue = Math.round(parseFloat(rgbaMatch[3]));
            
            // Make the second color slightly lighter (increase brightness by 10%)
            const lighterRed = Math.min(255, Math.round(red * 1.1));
            const lighterGreen = Math.min(255, Math.round(green * 1.1));
            const lighterBlue = Math.min(255, Math.round(blue * 1.1));
            
            const secondaryColor = `rgba(${lighterRed}, ${lighterGreen}, ${lighterBlue}, 1)`;
            document.documentElement.style.setProperty('--color-blue-5ba8ff', secondaryColor);
        }
    }

    return savedColors;
}

// Add a global variable to track picker instances
let pickerInstances = {};

function colorPicker(id, opacity, defaultColor) {
    // Check if element exists before creating picker
    const element = document.querySelector(id);
    if (!element) {
        console.warn(`Color picker element ${id} not found`);
        return null;
    }
    
    // Destroy existing picker if it exists
    if (pickerInstances[id]) {
        try {
            pickerInstances[id].destroyAndRemove();
        } catch (e) {
            console.warn(`Error destroying existing picker for ${id}:`, e);
        }
        delete pickerInstances[id];
    }
    
    try {
        const picker = Pickr.create({
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
        
        // Store the picker instance
        pickerInstances[id] = picker;
        return picker;
    } catch (error) {
        console.error(`Error creating color picker for ${id}:`, error);
        return null;
    }
}

const colorReset = document.querySelector('.fa-rotate-left');

colorReset.addEventListener('click', function () {
    // Remove the clock settings from localStorage
    localStorage.removeItem("clockBackground");
    localStorage.removeItem("clockBorderColor");
    localStorage.removeItem("clockShadowColor");
    localStorage.removeItem("clockTextColor");
    localStorage.removeItem("accentColor");

    // Clean up picker instances before reloading
    cleanupPickers();

    // Reload the page
    location.reload();
});

function clockUpdates() {
    // Check if the clock settings are visible before initializing pickers
    const clockSetting1 = document.getElementById('clock-setting-1');
    if (!clockSetting1 || clockSetting1.style.display === 'none') {
        return;
    }

    const saved_colors = getUserColors();

    // Use 'let' instead of 'const' for variables that will be reassigned
    let backgroundColor = "";
    let shadowColor = "";
    let textColor = "";
    let borderColor = "";
    let accentColor = "";

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

    if (saved_colors.accent) {
        accentColor = saved_colors.accent;
    } else {
        accentColor = "rgba(74, 158, 255, 1)";  // Default blue color
    }

    // Initialize color pickers with null checks
    const backgroundPicker = colorPicker('#color-picker-background', 1, backgroundColor);
    const shadowPicker = colorPicker('#color-picker-shadow', 0, shadowColor);
    const textPicker = colorPicker('#color-picker-text', 0, textColor);
    const borderPicker = colorPicker('#color-picker-border', 0, borderColor);
    
    // Only initialize accent picker if not already done
    let accentPicker;
    if (!accentPickerInitialized) {
        accentPicker = colorPicker('#color-picker-accent', 1, accentColor);
        if (accentPicker) {
            accentPicker.on('save', (color) => handleAccentColorChange(color, accentPicker));
            accentPickerInitialized = true;
        }
    }

    const text_1 = document.getElementById('s');
    const text_2 = document.getElementById('m');
    const text_3 = document.getElementById('h');

    const textElements = [text_1, text_2, text_3];

    // Attach handlers to pickers with null checks
    if (borderPicker) {
        borderPicker.on('save', (color) => handleBorderColorChange(color, borderPicker));
    }
    if (backgroundPicker) {
        backgroundPicker.on('save', (color) => handleBackgroundColorChange(color, backgroundPicker));
    }
    if (shadowPicker) {
        shadowPicker.on('save', (color) => handleShadowColorChange(color, shadowPicker, textElements));
    }
    if (textPicker) {
        textPicker.on('save', (color) => handleTextColorChange(color, textPicker, textElements));
    }
}

// Add a function to clean up picker instances
function cleanupPickers() {
    Object.keys(pickerInstances).forEach(id => {
        try {
            if (pickerInstances[id]) {
                pickerInstances[id].destroyAndRemove();
            }
        } catch (e) {
            console.warn(`Error destroying picker for ${id}:`, e);
        }
    });
    pickerInstances = {};
}

// Add a function to clean up only clock-specific color pickers (preserves accent picker)
function cleanupClockPickers() {
    const clockPickerIds = [
        '#color-picker-background',
        '#color-picker-shadow', 
        '#color-picker-text',
        '#color-picker-border'
    ];
    
    clockPickerIds.forEach(id => {
        if (pickerInstances[id]) {
            try {
                pickerInstances[id].destroyAndRemove();
                delete pickerInstances[id];
            } catch (e) {
                console.warn(`Error destroying clock picker for ${id}:`, e);
            }
        }
    });
}


document.addEventListener("DOMContentLoaded", function () {

    initializeTopVisitedBookmarks();
    setBackgroundImage();

    getLocationAndWeather();

    initializeFromLocalStorage();

    // Initialize accent color from localStorage
    const savedAccentColor = localStorage.getItem("accentColor");
    
    // Always set both colors, regardless of saved state
    let primaryColor, secondaryColor;
    
    if (savedAccentColor) {
        primaryColor = savedAccentColor;
        
        // Also set the secondary color for the gradient
        const rgbaMatch = savedAccentColor.match(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]*))?\)/);
        
        if (rgbaMatch) {
            const red = Math.round(parseFloat(rgbaMatch[1]));
            const green = Math.round(parseFloat(rgbaMatch[2]));
            const blue = Math.round(parseFloat(rgbaMatch[3]));
            
            
            // Make the second color slightly lighter (increase brightness by 10%)
            const lighterRed = Math.min(255, Math.round(red * 1.1));
            const lighterGreen = Math.min(255, Math.round(green * 1.1));
            const lighterBlue = Math.min(255, Math.round(blue * 1.1));
            
            secondaryColor = `rgba(${lighterRed}, ${lighterGreen}, ${lighterBlue}, 1)`;
        } else {
            // Fallback if regex doesn't match
            secondaryColor = "rgba(91, 168, 255, 1)";
        }
    } else {
        // Set default color if none saved
        primaryColor = "rgba(74, 158, 255, 1)";
        secondaryColor = "rgba(91, 168, 255, 1)";
    }
    
    // Set both CSS variables
    document.documentElement.style.setProperty('--color-blue-4a9eff', primaryColor);
    document.documentElement.style.setProperty('--color-blue-5ba8ff', secondaryColor);
    

    // Verify the gradient is working by checking a specific element
    setTimeout(() => {
        const gradientElement = document.querySelector('.section ul li a');
        if (gradientElement) {
            const computedStyle = getComputedStyle(gradientElement, '::before');
        }
        
        // Also check if the CSS variables are actually being used
        const testElement = document.createElement('div');
        testElement.style.setProperty('--color-blue-4a9eff', primaryColor);
        testElement.style.setProperty('--color-blue-5ba8ff', secondaryColor);
        testElement.style.background = 'linear-gradient(180deg, var(--color-blue-4a9eff), var(--color-blue-5ba8ff))';
    }, 100);

    // Initialize accent color picker for basic clock users
    if (!accentPickerInitialized) {
        const accentPickerElement = document.querySelector('#color-picker-accent');
        if (accentPickerElement) {
            const accentColor = savedAccentColor || "rgba(74, 158, 255, 1)";
            const accentPicker = colorPicker('#color-picker-accent', 1, accentColor);
            if (accentPicker) {
                accentPicker.on('save', (color) => handleAccentColorChange(color, accentPicker));
                accentPickerInitialized = true;
            }
        }
    }

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

    // Get the settings button element - updated for new HTML structure
    const settingsButton = document.getElementById("settings");
    const exitButton = document.getElementById("close-settings");
    const settingsContainer = document.querySelector(".settings-container");
    const settingsPopOut = document.querySelector(".pop-out");

    // Handle settings functionality for both HTML structures
    if (exitButton && settingsContainer) {
        // For newtab2.html structure
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
    }

    // Add click event listener to the settings button
    if (settingsButton) {
        settingsButton.addEventListener("click", function (event) {
            // Prevent default link behavior if this is an anchor tag
            event.preventDefault();

            if (settingsContainer) {
                // For newtab2.html structure
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
            } else if (settingsPopOut) {
                // For newtab.html structure - toggle pop-out visibility
                settingsPopOut.classList.toggle("expanded");
            }
        });
    }

    // Add event listeners for dropdowns
    const siteCountSelect = document.getElementById('siteCount');

    // Load saved values from localStorage
    const savedSiteCount = localStorage.getItem('siteCount');
    
    if (savedSiteCount) siteCountSelect.value = savedSiteCount;

    // Save values and update list when dropdown changes
    siteCountSelect.addEventListener('change', async function() {
        localStorage.setItem('siteCount', this.value);
        try {
            const historyItems = await getHistoryItems();
            const sortedItems = processHistoryItems(historyItems);
            displayModal(sortedItems);
        } catch (error) {
            console.error("Error updating history:", error);
        }
    });

    // Dev pull-out functionality
    const devPullOut = document.querySelector('.dev-pull-out-tab');
    const popOut = document.querySelector('.pop-out');
    const caretIcon = document.querySelector('.dev-pull-out-tab i');

    if (devPullOut && popOut && caretIcon) {
        devPullOut.addEventListener('click', () => {
            popOut.classList.toggle('hidden');
            
            // Change caret direction based on hidden state
            if (popOut.classList.contains('hidden')) {
                caretIcon.className = 'fa-solid fa-caret-right';
            } else {
                caretIcon.className = 'fa-solid fa-caret-left';
            }
        });
    }

    // Bookmark button functionality
    const bookmarkButton = document.getElementById("bookmarks");
    const bookmarkContainer = document.querySelector(".bookmarks-container");
    
    if (bookmarkButton) {
        bookmarkButton.addEventListener("click", function (event) {
            event.preventDefault();
            
            // Check if container is currently visible
            const isVisible = bookmarkContainer.style.visibility === "visible" && 
                             bookmarkContainer.style.opacity !== "0";
            
            if (!isVisible) {
                // Show the container with fade-in animation
                bookmarkContainer.style.visibility = "visible";
                bookmarkContainer.style.opacity = "0";
                
                // Force reflow
                bookmarkContainer.offsetHeight;
                
                // Animate to visible state
                bookmarkContainer.style.opacity = "1";
            } else {
                // Hide the container with fade-out animation
                bookmarkContainer.style.opacity = "0";
                
                // Hide after animation completes
                setTimeout(() => {
                    bookmarkContainer.style.visibility = "hidden";
                }, 300);
            }
        });
    }

});

