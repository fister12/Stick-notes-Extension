// Use hostname only to make notes persist across different pages of the same website
const STORAGE_KEY = `sticky_notes_${location.hostname}`;
// Keep track of global notes (across all sites)
const GLOBAL_STORAGE_KEY = 'sticky_notes_global';

function saveNotes(notes) {
  // Save site-specific notes
  chrome.storage.local.set({ [STORAGE_KEY]: notes });
  
  // Also save to global storage for persistence across all sites
  chrome.storage.local.get(GLOBAL_STORAGE_KEY, (result) => {
    let globalNotes = result[GLOBAL_STORAGE_KEY] || {};
    globalNotes[location.hostname] = notes;
    chrome.storage.local.set({ [GLOBAL_STORAGE_KEY]: globalNotes });
  });
}

function getSavedNotes(callback) {
  // First try to get site-specific notes
  chrome.storage.local.get([STORAGE_KEY, GLOBAL_STORAGE_KEY], (result) => {
    // Get notes specific to this site
    let siteNotes = result[STORAGE_KEY] || [];
    
    // Also check global notes storage
    let globalNotes = result[GLOBAL_STORAGE_KEY] || {};
    let globalSiteNotes = globalNotes[location.hostname] || [];
    
    // Combine and deduplicate notes based on ID
    let allNotes = [...siteNotes];
    if (globalSiteNotes.length > 0 && siteNotes.length === 0) {
      allNotes = globalSiteNotes;
    }
    
    callback(allNotes);
  });
}

function createStickyNote(data = {}) {
  // Create the main sticky note container
  const note = document.createElement('div');
  note.className = 'sticky-note';
  note.contentEditable = true;
  note.style.opacity = data.opacity || '1';
  note.dataset.id = data.id || Date.now().toString();

  // Create a separate content div to hold user text
  const contentDiv = document.createElement('div');
  contentDiv.className = 'note-content';
  contentDiv.textContent = data.content || 'Type here...';
  contentDiv.contentEditable = true;
  
  // The main div is no longer directly editable
  note.contentEditable = false;
  
  note.style.top = data.top || `${100 + Math.random() * 200}px`;
  note.style.left = data.left || `${100 + Math.random() * 200}px`;

  // Make note draggable
  let isDragging = false;
  let shiftX, shiftY;

  note.onmousedown = function (e) {
    if (e.target.closest('.note-slider, .opacity-btn, .close-btn')) return;

    isDragging = true;
    shiftX = e.clientX - note.getBoundingClientRect().left;
    shiftY = e.clientY - note.getBoundingClientRect().top;

    function moveAt(pageX, pageY) {
      note.style.left = pageX - shiftX + 'px';
      note.style.top = pageY - shiftY + 'px';
    }

    function onMouseMove(e) {
      if (!isDragging) return;
      moveAt(e.pageX, e.pageY);
    }

    document.addEventListener('mousemove', onMouseMove);

    document.onmouseup = () => {
      isDragging = false;
      document.removeEventListener('mousemove', onMouseMove);
      document.onmouseup = null;
      updateAllNotes();
    };
  };

  note.ondragstart = () => false;

  // Opacity slider
  const slider = document.createElement('input');
  slider.type = 'range';
  slider.className = 'note-slider';
  slider.min = '0.2';
  slider.max = '1';
  slider.step = '0.01';
  slider.value = note.style.opacity;
  slider.style.display = 'none';

  slider.addEventListener('input', () => {
    note.style.opacity = slider.value;
    updateAllNotes();
  });

  // Toggle opacity slider
  const button = document.createElement('button');
  button.className = 'opacity-btn';
  button.textContent = 'Opacity';
  button.addEventListener('click', () => {
    slider.style.display = slider.style.display === 'block' ? 'none' : 'block';
  });

  // Close button
  const closeBtn = document.createElement('button');
  closeBtn.className = 'close-btn';
  closeBtn.innerHTML = '&times;';
  closeBtn.addEventListener('click', () => {
    note.remove();
    updateAllNotes();
  });
  // Save on text change
  contentDiv.addEventListener('input', () => updateAllNotes());

  // Append controls to the main note
  note.appendChild(closeBtn);
  note.appendChild(button);
  note.appendChild(slider);
  
  // Append the content div as the last child so it takes up the remaining space
  note.appendChild(contentDiv);
  
  // Add the note to the document body
  document.body.appendChild(note);
  
  // Return the note element for further reference
  return note;
}

function updateAllNotes() {
  const allNotes = [...document.querySelectorAll('.sticky-note')].map((n) => {
    // Get the content directly from the content div
    const contentDiv = n.querySelector('.note-content');
    const content = contentDiv ? contentDiv.textContent.trim() : '';
    
    return {
      id: n.dataset.id,
      content: content,
      top: n.style.top,
      left: n.style.left,
      opacity: n.style.opacity
    };
  });
  
  saveNotes(allNotes);
}

// Initialize and restore saved notes when page loads
function initializeNotes() {
  console.log("Initializing notes for:", location.hostname);
  
  // Check for globally stored notes first
  chrome.storage.local.get('sticky_notes_global', (result) => {
    const globalNotes = result['sticky_notes_global'] || {};
    console.log("Global notes data:", globalNotes);
    
    // First try to load hostname-specific notes
    getSavedNotes((notes) => {
      console.log("Notes for this site:", notes);
      // Only create notes if we have any for this site
      if (notes && notes.length > 0) {
        notes.forEach(note => createStickyNote(note));
      }
    });
  });
}

// Run initialization when content script is first loaded
console.log("Content script loaded in:", window.location.href);
initializeNotes();

// Listener to add new note when extension icon is clicked
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  console.log("Content script received message:", msg);
  
  if (msg.action === 'create_note') {
    console.log("Creating new sticky note");
    try {
      const newNote = createStickyNote();
      updateAllNotes();
      // Send response to confirm action was performed
      sendResponse({success: true, noteId: newNote?.dataset?.id});
    } catch (error) {
      console.error("Error creating note:", error);
      sendResponse({success: false, error: error.message});
    }
    return true; // Indicates we'll respond asynchronously
  }
  
  if (msg.action === 'initialize_notes') {
    console.log("Initializing notes from message");
    try {
      initializeNotes();
      sendResponse({success: true});
    } catch (error) {
      console.error("Error initializing notes:", error);
      sendResponse({success: false, error: error.message});
    }
    return true; // Indicates we'll respond asynchronously
  }
});
