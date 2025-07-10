

// Get favicon URL for a bookmark
function getFaviconUrl(urlString) {
    try {
        // Extract the base domain from the provided URL
        const url = new URL(urlString);
        const baseUrl = url.origin; // Gets https://mail.google.com

        // Create the favicon URL using Chrome's API
        const faviconUrl = new URL(chrome.runtime.getURL("/_favicon/"));
        faviconUrl.searchParams.set("pageUrl", baseUrl);
        faviconUrl.searchParams.set("size", "16");

        return faviconUrl.toString();
    } catch (error) {
        // Fallback to Google's favicon service if Chrome API fails
        try {
            const hostname = new URL(urlString).hostname;
            return `https://www.google.com/s2/favicons?domain=${hostname}&sz=16`;
        } catch (fallbackError) {
            // If all else fails, return null
            return null;
        }
    }
}

// Alternative: Get bookmarks as a structured object
function getBookmarksAsObject() {
    return new Promise((resolve) => {
        chrome.bookmarks.getTree((bookmarkTree) => {
            const structured = bookmarkTree.map(node => parseBookmarkNode(node));
            resolve(structured);
        });
    });
}

function parseBookmarkNode(node) {
    const result = {
        id: node.id,
        title: node.title,
        url: node.url || null,
        type: node.url ? 'bookmark' : 'folder',
        children: []
    };

    if (node.children) {
        result.children = node.children.map(child => parseBookmarkNode(child));
    }

    return result;
}

function buildBookmarks(data) {
    const bookmarks_container = document.querySelector('.bookmarks-container');

    // Clear existing content
    bookmarks_container.innerHTML = '';

    // Create base ul element
    const base = document.createElement('ul');
    base.classList.add('base');

    // Recursively build the bookmarks tree
    data.forEach(item => {
        const listItem = createBookmarkItem(item);
        base.appendChild(listItem);
    });

    bookmarks_container.appendChild(base);
}

function createBookmarkItem(item) {
    const listItem = document.createElement('li');
    listItem.setAttribute('data-bookmark-id', item.id);
    listItem.setAttribute('data-bookmark-type', item.type);

    if (item.type === 'folder') {
        // Create folder item
        listItem.classList.add('bookmark', 'folder', 'collapsed');

        // Create contents div to wrap icon and text
        const contentsDiv = document.createElement('div');
        contentsDiv.classList.add('contents');
        contentsDiv.innerHTML = `<i class="fa-solid fa-folder"></i> <span class="bookmark-text">${item.title}</span><i class="fa-solid fa-ellipsis-vertical"></i>`;
        listItem.appendChild(contentsDiv);

        // If folder has children, create nested ul
        if (item.children && item.children.length > 0) {
            const childrenList = document.createElement('ul');
            childrenList.classList.add('children');

            item.children.forEach(child => {
                const childItem = createBookmarkItem(child);
                childrenList.appendChild(childItem);
            });

            listItem.appendChild(childrenList);
        }
    } else {
        // Create bookmark item
        listItem.classList.add('bookmark', 'file');

        // Create contents div to wrap icon and text
        const contentsDiv = document.createElement('div');
        contentsDiv.classList.add('contents');
        
        // Create favicon for bookmark
        let iconHtml = '';
        if (item.url) {
            try {
                const faviconUrl = getFaviconUrl(item.url);
                if (faviconUrl) {
                    iconHtml = `<img src="${faviconUrl}" class="bookmark-favicon" alt="favicon" onerror="this.style.display='none'; this.nextElementSibling.style.display='inline';"><i class="fa-solid fa-file" style="display: none;"></i>`;
                } else {
                    iconHtml = `<i class="fa-solid fa-file"></i>`;
                }
            } catch (error) {
                // Fallback to file icon if favicon fails
                iconHtml = `<i class="fa-solid fa-file"></i>`;
            }
        } else {
            iconHtml = `<i class="fa-solid fa-file"></i>`;
        }
        
        contentsDiv.innerHTML = `${iconHtml} <span class="bookmark-text">${item.title}</span><i class="fa-solid fa-ellipsis-vertical"></i>`;
        listItem.appendChild(contentsDiv);

        // Add click handler to open the URL
        if (item.url) {
            listItem.style.cursor = 'pointer';
            listItem.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent event bubbling to parent folders
                window.open(item.url, '_blank');
            });
        }
    }

    // Add mouse event listeners to ellipsis icon (for both folders and files)
    const ellipsisIcon = listItem.querySelector('.fa-ellipsis-vertical');
    if (ellipsisIcon) {
        let isMouseDown = false;
        let lastCoords = { x: 0, y: 0 };

        ellipsisIcon.addEventListener('mousedown', (e) => {
            e.stopPropagation(); // Prevent event bubbling
            isMouseDown = true;
            lastCoords = { x: e.clientX, y: e.clientY };

            // Start drag and drop functionality
            startDrag(e, listItem);

            // Add document-level event listeners for screen-wide tracking
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
        });

        function handleMouseMove(e) {
            if (isMouseDown) {
                lastCoords = { x: e.clientX, y: e.clientY };
                
                // Update drag ghost and drop zones
                updateDragGhost(e);
                updateDropZones(e);
            }
        }

        function handleMouseUp(e) {
            if (isMouseDown) {
                isMouseDown = false;
                
                // End drag and drop functionality
                endDrag(e);
                
                // Remove document-level event listeners
                document.removeEventListener('mousemove', handleMouseMove);
                document.removeEventListener('mouseup', handleMouseUp);
            }
        }
    }

    return listItem;
}

// Add click event listeners to folders after building the bookmarks
function addFolderClickHandlers() {
    const folders = document.querySelectorAll('.bookmark.folder');
    folders.forEach(folder => {
        folder.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent event bubbling
            folder.classList.toggle('collapsed');

            // Get the icon element within this folder
            const icon = folder.querySelector('i');
            if (icon) {
                if (folder.classList.contains('collapsed')) {
                    icon.classList.remove('fa-folder-open');
                    icon.classList.add('fa-folder');
                } else {
                    icon.classList.remove('fa-folder');
                    icon.classList.add('fa-folder-open');
                }
            }
        });
    });
}

// Drag and Drop functionality
let draggedElement = null;
let dragGhost = null;
let dropZones = [];

function startDrag(e, bookmarkItem) {
    draggedElement = bookmarkItem;
    
    // Create drag ghost - only clone the specific item, not the entire tree
    dragGhost = bookmarkItem.cloneNode(true);
    
    // Remove any nested children from the ghost
    const childrenElements = dragGhost.querySelectorAll('.children');
    childrenElements.forEach(child => child.remove());
    
    // Remove any nested ul elements that might contain children
    const nestedUls = dragGhost.querySelectorAll('ul');
    nestedUls.forEach(ul => ul.remove());
    
    // Apply ghost styling
    dragGhost.style.position = 'fixed';
    dragGhost.style.pointerEvents = 'none';
    dragGhost.style.zIndex = '10000';
    dragGhost.style.opacity = '0.8';
    dragGhost.style.transform = 'rotate(5deg)';
    dragGhost.style.padding = '8px 12px';
    dragGhost.style.minWidth = '200px';
    dragGhost.style.maxWidth = '300px';
    
    // Remove any dragging classes or states from the ghost
    dragGhost.classList.remove('dragging');
    
    document.body.appendChild(dragGhost);
    
    // Update ghost position
    updateDragGhost(e);
    
    // Add dragging class to original
    bookmarkItem.classList.add('dragging');
    
    // Prevent default behavior
    e.preventDefault();
}

function updateDragGhost(e) {
    if (!dragGhost) return;
    
    dragGhost.style.left = (e.clientX + 10) + 'px';
    dragGhost.style.top = (e.clientY - 20) + 'px';
}

function updateDropZones(e) {
    if (!draggedElement) return;
    
    // Clear previous drop zones
    clearDropZones();
    
    // Find potential drop targets
    const bookmarksContainer = document.querySelector('.bookmarks-container');
    const bookmarkItems = bookmarksContainer.querySelectorAll('.bookmark');
    
    bookmarkItems.forEach(item => {
        if (item === draggedElement) return;
        
        const rect = item.getBoundingClientRect();
        const isOver = e.clientX >= rect.left && e.clientX <= rect.right &&
                      e.clientY >= rect.top && e.clientY <= rect.bottom;
        
        if (isOver) {
            // Determine drop position (before, after, or inside)
            const dropPosition = getDropPosition(item, e.clientY);
            
            // Add drop zone indicator
            addDropZone(item, dropPosition);
        }
    });
}

function getDropPosition(item, mouseY) {
    const rect = item.getBoundingClientRect();
    const itemCenter = rect.top + rect.height / 2;
    
    if (mouseY < itemCenter) {
        return 'before';
    } else if (item.classList.contains('folder') && mouseY < rect.bottom - 10) {
        return 'inside';
    } else {
        return 'after';
    }
}

function addDropZone(item, position) {
    const indicator = document.createElement('div');
    indicator.className = 'drop-zone-indicator';
    indicator.style.position = 'absolute';
    indicator.style.backgroundColor = '#4CAF50';
    indicator.style.height = '2px';
    indicator.style.width = '100%';
    indicator.style.zIndex = '9999';
    indicator.style.pointerEvents = 'none';
    
    const rect = item.getBoundingClientRect();
    
    if (position === 'before') {
        indicator.style.top = rect.top + 'px';
    } else if (position === 'after') {
        indicator.style.top = rect.bottom + 'px';
    } else if (position === 'inside') {
        indicator.style.backgroundColor = 'rgba(76, 175, 80, 0.3)';
        indicator.style.height = rect.height + 'px';
        indicator.style.top = rect.top + 'px';
        indicator.style.border = '2px solid #4CAF50';
    }
    
    indicator.style.left = rect.left + 'px';
    indicator.style.width = rect.width + 'px';
    
    document.body.appendChild(indicator);
    dropZones.push({ element: item, position: position, indicator: indicator });
}

function clearDropZones() {
    dropZones.forEach(zone => {
        if (zone.indicator && zone.indicator.parentNode) {
            zone.indicator.parentNode.removeChild(zone.indicator);
        }
    });
    dropZones = [];
}

function endDrag(e) {
    if (!draggedElement) return;
    
    // Find drop target
    const dropZone = dropZones.find(zone => {
        const rect = zone.element.getBoundingClientRect();
        return e.clientX >= rect.left && e.clientX <= rect.right &&
               e.clientY >= rect.top && e.clientY <= rect.bottom;
    });
    
    if (dropZone) {
        // Perform the move
        moveBookmark(draggedElement, dropZone.element, dropZone.position);
    }
    
    // Cleanup
    cleanupDrag();
}

function cleanupDrag() {
    if (dragGhost && dragGhost.parentNode) {
        dragGhost.parentNode.removeChild(dragGhost);
    }
    
    if (draggedElement) {
        draggedElement.classList.remove('dragging');
    }
    
    clearDropZones();
    
    draggedElement = null;
    dragGhost = null;
}

function moveBookmark(draggedItem, targetItem, position) {
    const draggedId = draggedItem.getAttribute('data-bookmark-id');
    const targetId = targetItem.getAttribute('data-bookmark-id');
    
    console.log(`Moving bookmark ${draggedId} to ${targetId} at position: ${position}`);
    console.log('Dragged item:', draggedItem);
    console.log('Target item:', targetItem);
    
    // Get the target bookmark first to understand its current position
    chrome.bookmarks.get(targetId, (targetBookmarks) => {
        if (chrome.runtime.lastError) {
            console.error('Error getting target:', chrome.runtime.lastError);
            return;
        }
        
        // Handle case where get() returns an array
        const targetBookmark = Array.isArray(targetBookmarks) ? targetBookmarks[0] : targetBookmarks;
        
        if (!targetBookmark) {
            console.error('No target bookmark found');
            return;
        }
        
        console.log('Target bookmark:', targetBookmark);
        
        if (position === 'inside') {
            // Moving into a folder
            chrome.bookmarks.move(draggedId, {
                parentId: targetId,
                index: 0
            }, (result) => {
                if (chrome.runtime.lastError) {
                    console.error('Move failed:', chrome.runtime.lastError);
                } else {
                    console.log('Moved into folder successfully:', result);
                    forceRefreshBookmarks();
                }
            });
        } else {
            // Moving before/after an item - need to calculate proper index
            const targetIndex = targetBookmark.index || 0;
            let newIndex;
            
            if (position === 'before') {
                newIndex = targetIndex;
            } else { // after
                newIndex = targetIndex + 1;
            }
            
            console.log(`Moving to index ${newIndex} (target was at ${targetIndex})`);
            
            chrome.bookmarks.move(draggedId, {
                parentId: targetBookmark.parentId,
                index: newIndex
            }, (result) => {
                if (chrome.runtime.lastError) {
                    console.error('Move failed:', chrome.runtime.lastError);
                } else {
                    console.log('Moved successfully:', result);
                    console.log('Result details:', {
                        id: result.id,
                        parentId: result.parentId,
                        index: result.index,
                        title: result.title
                    });
                    forceRefreshBookmarks();
                }
            });
        }
    });
}

// Alternative: Even simpler - just move to bookmark bar
function simpleMoveToBookmarkBar(bookmarkId) {
    chrome.bookmarks.move(bookmarkId, {
        parentId: '1', // Bookmark bar ID
        index: 0
    }, (result) => {
        if (chrome.runtime.lastError) {
            console.error('Move failed:', chrome.runtime.lastError);
        } else {
            console.log('Moved to bookmark bar:', result);
            refreshBookmarks();
        }
    });
}

// Alternative: Move to a specific folder by name
function moveToFolderByName(bookmarkId, folderName) {
    chrome.bookmarks.search({ title: folderName }, (results) => {
        const folder = results.find(item => !item.url); // Folders don't have URLs
        if (folder) {
            chrome.bookmarks.move(bookmarkId, {
                parentId: folder.id,
                index: 0
            }, (result) => {
                if (chrome.runtime.lastError) {
                    console.error('Move failed:', chrome.runtime.lastError);
                } else {
                    console.log('Moved to folder:', result);
                    refreshBookmarks();
                }
            });
        } else {
            console.log('Folder not found:', folderName);
        }
    });
}

// Alternative: Simple bookmark operations
const BookmarkUtils = {
    // Move to bookmark bar
    moveToBar: (bookmarkId) => {
        chrome.bookmarks.move(bookmarkId, { parentId: '1', index: 0 }, refreshBookmarks);
    },
    
    // Move to other bookmarks
    moveToOther: (bookmarkId) => {
        chrome.bookmarks.move(bookmarkId, { parentId: '2', index: 0 }, refreshBookmarks);
    },
    
    // Delete bookmark
    delete: (bookmarkId) => {
        chrome.bookmarks.remove(bookmarkId, refreshBookmarks);
    },
    
    // Create new folder
    createFolder: (title, parentId = '1') => {
        chrome.bookmarks.create({
            parentId: parentId,
            title: title
        }, refreshBookmarks);
    },
    
    // Create new bookmark
    createBookmark: (title, url, parentId = '1') => {
        chrome.bookmarks.create({
            parentId: parentId,
            title: title,
            url: url
        }, refreshBookmarks);
    }
};

function refreshBookmarks() {
    console.log('Refreshing bookmarks...');
    
    getBookmarksAsObject().then(bookmarks => {
        console.log('Got updated bookmarks:', bookmarks);
        
        if (bookmarks && bookmarks[0] && bookmarks[0].children && bookmarks[0].children[0]) {
            const bookmark_bar = bookmarks[0]['children'][0];
            console.log('Bookmark bar data:', bookmark_bar);
            
            buildBookmarks(bookmark_bar.children);
            addFolderClickHandlers();
            
            console.log('Bookmarks refreshed successfully');
        } else {
            console.error('Invalid bookmark structure:', bookmarks);
        }
    }).catch(error => {
        console.error('Error refreshing bookmarks:', error);
    });
}

// Alternative: Force refresh with delay to ensure Chrome API has updated
function forceRefreshBookmarks() {
    console.log('Force refreshing bookmarks...');
    
    // Add a small delay to ensure Chrome has processed the move
    setTimeout(() => {
        getBookmarksAsObject().then(bookmarks => {
            console.log('Force refresh - got bookmarks:', bookmarks);
            
            if (bookmarks && bookmarks[0] && bookmarks[0].children && bookmarks[0].children[0]) {
                const bookmark_bar = bookmarks[0]['children'][0];
                buildBookmarks(bookmark_bar.children);
                addFolderClickHandlers();
                console.log('Force refresh completed');
            }
        }).catch(error => {
            console.error('Error in force refresh:', error);
        });
    }, 100);
}

// Real-time bookmark change listeners
function setupBookmarkChangeListeners() {
    // Check if Chrome bookmarks API is available
    if (!chrome || !chrome.bookmarks) {
        console.log('Chrome bookmarks API not available in this context');
        return;
    }
    
    // List of events to check and register
    const events = [
        { name: 'onCreated', handler: (id, bookmark) => {
            console.log('Bookmark created:', bookmark);
            refreshBookmarks();
        }},
        { name: 'onRemoved', handler: (id, removeInfo) => {
            console.log('Bookmark removed:', removeInfo);
            refreshBookmarks();
        }},
        { name: 'onChanged', handler: (id, changeInfo) => {
            console.log('Bookmark changed:', changeInfo);
            refreshBookmarks();
        }},
        { name: 'onMoved', handler: (id, moveInfo) => {
            console.log('Bookmark moved:', moveInfo);
            refreshBookmarks();
        }},
        { name: 'onReordered', handler: (id, reorderInfo) => {
            console.log('Bookmark reordered:', reorderInfo);
            refreshBookmarks();
        }},
        { name: 'onImportBegan', handler: () => {
            console.log('Bookmark import began');
        }},
        { name: 'onImportEnded', handler: () => {
            console.log('Bookmark import ended');
            refreshBookmarks();
        }}
    ];
    
    let listenersRegistered = 0;
    
    events.forEach(event => {
        try {
            if (chrome.bookmarks[event.name] && typeof chrome.bookmarks[event.name].addListener === 'function') {
                chrome.bookmarks[event.name].addListener(event.handler);
                listenersRegistered++;
            } else {
                console.log(`Event ${event.name} not available`);
            }
        } catch (error) {
            console.log(`Failed to register listener for ${event.name}:`, error.message);
        }
    });
    
    
}

// Or get as structured data
getBookmarksAsObject().then(bookmarks => {
    const bookmark_bar = bookmarks[0]['children'][0];

    buildBookmarks(bookmark_bar.children);

    // Call the function after building bookmarks
    addFolderClickHandlers();
    
    // Setup real-time bookmark change listeners
    setupBookmarkChangeListeners();

});