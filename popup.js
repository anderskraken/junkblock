// JunkBlock Popup — Settings UI
(function () {
  'use strict';

  const DEFAULTS = {
    disabledCategories: [],
    customMarkers: [],
    removedMarkers: [],
  };

  let settings = { ...DEFAULTS };

  // ─── Storage helpers ──────────────────────────────────────────────
  function load(cb) {
    chrome.storage.sync.get(Object.keys(DEFAULTS), (data) => {
      settings = {
        disabledCategories: data.disabledCategories || [],
        customMarkers: data.customMarkers || [],
        removedMarkers: data.removedMarkers || [],
      };
      cb();
    });
  }

  function save(cb) {
    chrome.storage.sync.set(settings, cb || (() => {}));
  }

  // ─── Render ───────────────────────────────────────────────────────
  function render() {
    const container = document.getElementById('categories');
    container.innerHTML = '';

    for (const cat of MARKER_CATEGORIES) {
      const isDisabled = settings.disabledCategories.includes(cat.id);
      const isOpen = cat._open || false;

      const div = document.createElement('div');
      div.className = 'cat' + (isDisabled ? ' cat--disabled' : '') + (isOpen ? ' cat--open' : '');

      // Header
      const header = document.createElement('button');
      header.className = 'cat__header';

      // Toggle switch
      const toggle = document.createElement('span');
      toggle.className = 'cat__toggle' + (isDisabled ? '' : ' cat__toggle--on');
      toggle.addEventListener('click', (e) => {
        e.stopPropagation();
        if (isDisabled) {
          settings.disabledCategories = settings.disabledCategories.filter(id => id !== cat.id);
        } else {
          settings.disabledCategories.push(cat.id);
        }
        save(() => render());
      });
      header.appendChild(toggle);

      // Name
      const name = document.createElement('span');
      name.className = 'cat__name';
      name.textContent = cat.name;
      header.appendChild(name);

      // Count
      if (cat.markers.length > 0) {
        const count = document.createElement('span');
        count.className = 'cat__count';
        const activeCount = cat.markers.filter(m => !settings.removedMarkers.includes(m)).length;
        count.textContent = activeCount + '/' + cat.markers.length;
        header.appendChild(count);
      }

      // Chevron
      const chevron = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      chevron.setAttribute('viewBox', '0 0 12 12');
      chevron.setAttribute('fill', 'none');
      chevron.setAttribute('stroke', 'currentColor');
      chevron.setAttribute('stroke-width', '2');
      chevron.classList.add('cat__chevron');
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', 'M3 4 L6 7 L9 4');
      chevron.appendChild(path);
      header.appendChild(chevron);

      header.addEventListener('click', () => {
        cat._open = !cat._open;
        render();
      });

      div.appendChild(header);

      // Markers list
      if (cat.markers.length > 0) {
        const markerList = document.createElement('div');
        markerList.className = 'cat__markers';

        for (const m of cat.markers) {
          const isRemoved = settings.removedMarkers.includes(m);
          const pill = document.createElement('span');
          pill.className = 'marker' + (isRemoved ? ' marker--removed' : '');
          pill.textContent = m;

          if (isRemoved) {
            const restoreBtn = document.createElement('button');
            restoreBtn.className = 'marker__restore';
            restoreBtn.textContent = '↩';
            restoreBtn.title = 'Gjenopprett';
            restoreBtn.addEventListener('click', (e) => {
              e.stopPropagation();
              settings.removedMarkers = settings.removedMarkers.filter(r => r !== m);
              save(() => render());
            });
            pill.appendChild(restoreBtn);
          } else {
            const removeBtn = document.createElement('button');
            removeBtn.className = 'marker__remove';
            removeBtn.textContent = '×';
            removeBtn.title = 'Fjern';
            removeBtn.addEventListener('click', (e) => {
              e.stopPropagation();
              settings.removedMarkers.push(m);
              save(() => render());
            });
            pill.appendChild(removeBtn);
          }

          markerList.appendChild(pill);
        }

        div.appendChild(markerList);
      }

      container.appendChild(div);
    }

    // Custom markers
    renderCustomMarkers();
  }

  function renderCustomMarkers() {
    const container = document.getElementById('custom-markers');
    container.innerHTML = '';

    for (const m of settings.customMarkers) {
      const pill = document.createElement('span');
      pill.className = 'custom-marker';
      pill.textContent = m;

      const removeBtn = document.createElement('button');
      removeBtn.className = 'custom-marker__remove';
      removeBtn.textContent = '×';
      removeBtn.addEventListener('click', () => {
        settings.customMarkers = settings.customMarkers.filter(c => c !== m);
        save(() => render());
      });
      pill.appendChild(removeBtn);

      container.appendChild(pill);
    }
  }

  // ─── Add custom marker ────────────────────────────────────────────
  function addCustomMarker() {
    const input = document.getElementById('add-marker-input');
    const value = input.value.trim().toLowerCase();
    if (!value) return;
    if (settings.customMarkers.includes(value)) return;

    settings.customMarkers.push(value);
    input.value = '';
    save(() => render());
  }

  document.getElementById('add-marker-btn').addEventListener('click', addCustomMarker);
  document.getElementById('add-marker-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') addCustomMarker();
  });

  // ─── Reset ────────────────────────────────────────────────────────
  document.getElementById('reset-btn').addEventListener('click', () => {
    settings = {
      disabledCategories: [],
      customMarkers: [],
      removedMarkers: [],
    };
    // Reset open states
    for (const cat of MARKER_CATEGORIES) cat._open = false;
    save(() => render());
  });

  // ─── Init ─────────────────────────────────────────────────────────
  load(render);
})();
