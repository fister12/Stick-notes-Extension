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
  note.colour = data.colour || '#FFEB3B';
  note.style.backgroundColor = note.colour;
  // Create a separate content div to hold user text
  const contentDiv = document.createElement('div');
  contentDiv.className = 'note-content';
  contentDiv.innerHTML = data.content || 'Type here...';
  contentDiv.contentEditable = true;
  
  // Make contentDiv support rich text editing
  contentDiv.addEventListener('focus', () => {
    // Set placeholder text
    if (contentDiv.innerHTML === 'Type here...') {
      contentDiv.innerHTML = '';
    }
  });
  
  contentDiv.addEventListener('blur', () => {
    // Restore placeholder if empty
    if (contentDiv.innerHTML === '') {
      contentDiv.innerHTML = 'Type here...';
    }
  });

  // Create formatting toolbar
  const formatToolbar = createFormatToolbar();

  const colourDiv = document.createElement('div');
  colourDiv.className = 'note-colour-btns';

 const colours = [
    { name: 'Yellow', value: '#FFEB3B' },
    { name: 'Green', value: '#CCFF90' },
    { name: 'Blue', value: '#80D8FF' },
    { name: 'Purple', value: '#E1BEE7' },
    { name: 'Pink', value: '#F8BBD0' },
    { name: 'Orange', value: '#FFD180' }
  ];

  //creating colour buttons
    colours.forEach(colour=>{
    const colourBtn = document.createElement('button');
    colourBtn.className = 'colour-btn'; // Changed from 'note-colour-btn' to match CSS
    colourBtn.style.backgroundColor = colour.value;
    colourBtn.title = colour.name;
    colourBtn.addEventListener('click', () => {
      note.style.backgroundColor = colour.value;
      note.colour = colour.value;
      updateAllNotes();
    });
    colourDiv.appendChild(colourBtn);
  });

  // Add tag functionality
  const tagsContainer = document.createElement('div');
  tagsContainer.className = 'note-tags-container';
  
  // Create input for adding new tags
  const tagInput = document.createElement('input');
  tagInput.className = 'note-tag-input';
  tagInput.placeholder = 'Add tag...';
  tagInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && tagInput.value.trim()) {
      addTag(tagInput.value.trim());
      tagInput.value = '';
      e.preventDefault();
    }
  });
  
  tagsContainer.appendChild(tagInput);
  
  // Initialize tags from saved data
  note.tags = data.tags || [];
  
  // Function to add tags to the note
  function addTag(tagText) {
    if (note.tags.includes(tagText)) return; // Prevent duplicate tags
    
    note.tags.push(tagText);
    
    const tagElement = document.createElement('span');
    tagElement.className = 'note-tag';
    tagElement.textContent = tagText;
    
    // Add delete button to tag
    const deleteBtn = document.createElement('span');
    deleteBtn.className = 'note-tag-delete';
    deleteBtn.innerHTML = '×';
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      note.tags = note.tags.filter(t => t !== tagText);
      tagElement.remove();
      updateAllNotes();
      updateFilterBar();
    });
    
    tagElement.appendChild(deleteBtn);
    tagsContainer.insertBefore(tagElement, tagInput);
    
    updateAllNotes();
    updateFilterBar();
  }
  
  // Initialize existing tags
  if (note.tags && note.tags.length > 0) {
    note.tags.forEach(tag => addTag(tag));
  }
  
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
    updateFilterBar(); // Update filter bar when a note is removed
  });
  // Save on text change
  contentDiv.addEventListener('input', () => updateAllNotes());
  // Append controls to the main note
  note.appendChild(closeBtn);
  note.appendChild(button);
  note.appendChild(slider);
  note.appendChild(colourDiv);  // Add the color buttons
  note.appendChild(tagsContainer);  // Add the tags container
  note.appendChild(formatToolbar);  // Add the formatting toolbar
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
    const content = contentDiv ? contentDiv.innerHTML : '';
    
    return {
      id: n.dataset.id,
      content: content,
      top: n.style.top,
      left: n.style.left,
      opacity: n.style.opacity,
      colour: n.colour,
      tags: n.tags || []
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
      
      // Create filter bar after notes are loaded
      updateFilterBar();
    });
  });
}

// Create a filter bar to filter notes by tags
function createFilterBar() {
  // Remove existing filter bar if it exists
  const existingBar = document.querySelector('.note-filter-bar');
  if (existingBar) existingBar.remove();
  
  const filterBar = document.createElement('div');
  filterBar.className = 'note-filter-bar';
  
  const filterTitle = document.createElement('div');
  filterTitle.className = 'note-filter-title';
  filterTitle.textContent = 'Filter Notes by Tags';
  filterBar.appendChild(filterTitle);
  
  const filterTags = document.createElement('div');
  filterTags.className = 'note-filter-tags';
  filterBar.appendChild(filterTags);
  
  document.body.appendChild(filterBar);
  
  return filterBar;
}

// Update the filter bar with all available tags
function updateFilterBar() {
  let filterBar = document.querySelector('.note-filter-bar');
  if (!filterBar) filterBar = createFilterBar();
  
  const filterTags = filterBar.querySelector('.note-filter-tags');
  filterTags.innerHTML = '';
  
  // Get all unique tags from all notes
  const allTags = new Set();
  document.querySelectorAll('.sticky-note').forEach(note => {
    if (note.tags && note.tags.length > 0) {
      note.tags.forEach(tag => allTags.add(tag));
    }
  });
  
  // Create filter tags
  allTags.forEach(tag => {
    const tagElement = document.createElement('span');
    tagElement.className = 'note-filter-tag';
    tagElement.textContent = tag;
    
    tagElement.addEventListener('click', () => {
      tagElement.classList.toggle('active');
      applyFilters();
    });
    
    filterTags.appendChild(tagElement);
  });
  
  // Add "Show All" button
  const showAllBtn = document.createElement('span');
  showAllBtn.className = 'note-filter-tag';
  showAllBtn.textContent = 'Show All';
  showAllBtn.addEventListener('click', () => {
    // Clear all active filters
    document.querySelectorAll('.note-filter-tag.active').forEach(tag => {
      tag.classList.remove('active');
    });
    applyFilters();
  });
  filterTags.appendChild(showAllBtn);
  
  // Hide filter bar if no tags
  if (allTags.size === 0) {
    filterBar.style.display = 'none';
  } else {
    filterBar.style.display = 'flex';
  }
}

// Apply filters to show/hide notes
function applyFilters() {
  const activeTags = [...document.querySelectorAll('.note-filter-tag.active')].map(tag => tag.textContent);
  
  document.querySelectorAll('.sticky-note').forEach(note => {
    if (activeTags.length === 0) {
      // No active filters, show all notes
      note.style.display = 'flex';
    } else {
      // Check if note has any of the active tags
      const hasMatchingTag = note.tags && note.tags.some(tag => activeTags.includes(tag));
      note.style.display = hasMatchingTag ? 'flex' : 'none';
    }
  });
}

// Creates a formatting toolbar for rich text editing
function createFormatToolbar() {
  const toolbar = document.createElement('div');
  toolbar.className = 'format-toolbar';
  
  // Bold button
  const boldBtn = document.createElement('button');
  boldBtn.className = 'format-btn';
  boldBtn.innerHTML = '<b>B</b>';
  boldBtn.title = 'Bold';
  boldBtn.addEventListener('click', () => {
    document.execCommand('bold', false, null);
  });
  toolbar.appendChild(boldBtn);
  
  // Italic button
  const italicBtn = document.createElement('button');
  italicBtn.className = 'format-btn';
  italicBtn.innerHTML = '<i>I</i>';
  italicBtn.title = 'Italic';
  italicBtn.addEventListener('click', () => {
    document.execCommand('italic', false, null);
  });
  toolbar.appendChild(italicBtn);
  
  // Underline button
  const underlineBtn = document.createElement('button');
  underlineBtn.className = 'format-btn';
  underlineBtn.innerHTML = '<u>U</u>';
  underlineBtn.title = 'Underline';
  underlineBtn.addEventListener('click', () => {
    document.execCommand('underline', false, null);
  });
  toolbar.appendChild(underlineBtn);
  
  // Add separator
  const separator1 = document.createElement('div');
  separator1.className = 'format-separator';
  toolbar.appendChild(separator1);
  
  // Heading dropdown
  const headingDropdown = document.createElement('div');
  headingDropdown.className = 'format-dropdown';
  
  const headingBtn = document.createElement('button');
  headingBtn.className = 'format-btn';
  headingBtn.textContent = 'H';
  headingBtn.title = 'Heading';
  
  const headingContent = document.createElement('div');
  headingContent.className = 'format-dropdown-content';
  
  const headingOptions = [
    { text: 'Heading 1', value: 'h1' },
    { text: 'Heading 2', value: 'h2' },
    { text: 'Heading 3', value: 'h3' },
    { text: 'Paragraph', value: 'p' }
  ];
  
  headingOptions.forEach(option => {
    const link = document.createElement('a');
    link.textContent = option.text;
    link.addEventListener('click', () => {
      document.execCommand('formatBlock', false, `<${option.value}>`);
    });
    headingContent.appendChild(link);
  });
  
  headingDropdown.appendChild(headingBtn);
  headingDropdown.appendChild(headingContent);
  toolbar.appendChild(headingDropdown);
  
  // Add separator
  const separator2 = document.createElement('div');
  separator2.className = 'format-separator';
  toolbar.appendChild(separator2);
  
  // Bullet list button
  const bulletListBtn = document.createElement('button');
  bulletListBtn.className = 'format-btn';
  bulletListBtn.innerHTML = '•';
  bulletListBtn.title = 'Bullet List';
  bulletListBtn.addEventListener('click', () => {
    document.execCommand('insertUnorderedList', false, null);
  });
  toolbar.appendChild(bulletListBtn);
  
  // Numbered list button
  const numberedListBtn = document.createElement('button');
  numberedListBtn.className = 'format-btn';
  numberedListBtn.innerHTML = '1.';
  numberedListBtn.title = 'Numbered List';
  numberedListBtn.addEventListener('click', () => {
    document.execCommand('insertOrderedList', false, null);
  });
  toolbar.appendChild(numberedListBtn);
  
  // Add separator
  const separator3 = document.createElement('div');
  separator3.className = 'format-separator';
  toolbar.appendChild(separator3);
  
  // Quote button
  const quoteBtn = document.createElement('button');
  quoteBtn.className = 'format-btn';
  quoteBtn.innerHTML = '"';
  quoteBtn.title = 'Quote';
  quoteBtn.addEventListener('click', () => {
    document.execCommand('formatBlock', false, '<blockquote>');
  });
  toolbar.appendChild(quoteBtn);
  
  // Code button
  const codeBtn = document.createElement('button');
  codeBtn.className = 'format-btn';
  codeBtn.innerHTML = '&lt;/&gt;';
  codeBtn.title = 'Code';
  codeBtn.addEventListener('click', () => {
    if (window.getSelection) {
      const selection = window.getSelection();
      if (selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        const selectedText = range.toString();
        
        // Check if selected text is already in code tag
        const parentElement = range.commonAncestorContainer.parentElement;
        if (parentElement.tagName === 'CODE') {
          // Remove code formatting
          document.execCommand('removeFormat', false, null);
        } else {
          // Add code formatting
          const codeElement = document.createElement('code');
          codeElement.textContent = selectedText;
          range.deleteContents();
          range.insertNode(codeElement);
        }
      }
    }
  });
  toolbar.appendChild(codeBtn);
  
  return toolbar;
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
      updateFilterBar(); // Update filter bar when a new note is created
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
