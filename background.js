// Store active tabs to track which sites have notes
const activeTabs = {};

// Function to create a new note in the active tab
function createNoteInTab(tabId) {
  console.log("Sending create note message to tab:", tabId);
  
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, { action: 'create_note' }, response => {
      if (chrome.runtime.lastError) {
        console.warn("Error sending message:", chrome.runtime.lastError);
        reject(chrome.runtime.lastError);
      } else {
        console.log("Received response:", response);
        resolve(response);
      }
    });
  }).catch(error => {
    console.error("Failed to send message, injecting content script...", error);
    
    // First ensure CSS is loaded
    return chrome.scripting.insertCSS({
      target: { tabId },
      files: ["note.css"]
    }).then(() => {
      // Then inject the content script
      return chrome.scripting.executeScript({
        target: { tabId },
        files: ["content.js"]
      });
    }).then(() => {
      // Wait a bit for the script to initialize
      return new Promise(resolve => setTimeout(resolve, 300));
    }).then(() => {
      // Try sending the message again
      return new Promise((resolve, reject) => {
        chrome.tabs.sendMessage(tabId, { action: 'create_note' }, response => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve(response);
          }
        });
      });
    });
  });
}

// Handle clicks on the extension icon
chrome.action.onClicked.addListener((tab) => {
  console.log("Extension icon clicked for tab:", tab.id, tab.url);
  
  // Skip execution in chrome:// and extension pages
  if (tab.url.startsWith("chrome://") || tab.url.startsWith("chrome-extension://")) {
    console.warn("Cannot inject into chrome:// or extension pages.");
    return;
  }

  // Try to create a note in the tab
  createNoteInTab(tab.id)
    .then(response => {
      console.log("Note created successfully:", response);
      
      // Track this tab as having notes
      const url = new URL(tab.url);
      activeTabs[tab.id] = url.hostname;
    })
    .catch(error => {
      console.error("Failed to create note:", error);
    });
});

// Handle tab navigation events to preserve notes
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && activeTabs[tabId]) {
    console.log("Tab updated, restoring notes:", tabId, tab.url);
    
    // Ignore restricted URLs
    if (tab.url.startsWith("chrome://") || tab.url.startsWith("chrome-extension://")) {
      return;
    }
    
    // First ensure CSS is loaded
    chrome.scripting.insertCSS({
      target: { tabId },
      files: ["note.css"]
    }).then(() => {
      // Then inject the content script if needed
      return chrome.scripting.executeScript({
        target: { tabId },
        files: ["content.js"]
      });
    }).then(() => {
      // Wait for script to initialize
      return new Promise(resolve => setTimeout(resolve, 300));
    }).then(() => {
      // Restore notes
      chrome.tabs.sendMessage(tabId, { action: 'initialize_notes' }, response => {
        if (chrome.runtime.lastError) {
          console.warn("Error initializing notes:", chrome.runtime.lastError);
        } else {
          console.log("Notes initialized successfully:", response);
        }
      });
    }).catch(error => {
      // Only log errors for allowed pages
      if (!tab.url.startsWith("chrome://") && !tab.url.startsWith("chrome-extension://")) {
        console.error("Error handling tab update:", error);
      }
    });
  }
});
