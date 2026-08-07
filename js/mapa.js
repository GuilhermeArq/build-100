(function () {
  window.GUIA = window.GUIA || {};

  let mapInstance = null;
  let clusterLayer = null;

  function assetPath(path) {
    if (window.GUIA && typeof window.GUIA.assetPath === 'function') {
      return window.GUIA.assetPath(path);
    }
    return window.location.pathname.includes('/buildings/') ? '../' + path : path;
  }

  window.GUIA.initMap = async function initMap() {
    const mapElement = document.getElementById('guia-map');
    if (!mapElement) return;
    if (mapElement.dataset.initialized === 'true') return;

    if (typeof L === 'undefined') {
      console.error('Leaflet não carregou. Verifique a conexão com a internet.');
      return;
    }

    mapElement.dataset.initialized = 'true';

    mapInstance = L.map(mapElement, {
      zoomControl: true,
      scrollWheelZoom: true
    }).setView([-8.0585, -34.8840], 15);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
    }).addTo(mapInstance);

    const markerIcon = L.divIcon({
      className: '',
      html: '<div class="guia-marker"></div>',
      iconSize: [34, 34],
      iconAnchor: [17, 34],
      popupAnchor: [0, -30]
    });

    const highlightIcon = L.divIcon({
      className: '',
      html: '<div class="guia-marker is-highlighted"></div>',
      iconSize: [34, 34],
      iconAnchor: [17, 34],
      popupAnchor: [0, -30]
    });

    const response = await fetch(assetPath('data/edificios.json'));
    const edificios = await response.json();

    clusterLayer = L.markerClusterGroup({
      showCoverageOnHover: false,
      maxClusterRadius: 44
    });

    window.GUIA._mainMap = mapInstance;

    const allMarkers = [];
    const params = new URLSearchParams(window.location.search);
    const focusId = params.get('focus');
    let focusedItem = null;

    edificios.forEach((edificio) => {
      const lat = Number(edificio.lat);
      const lng = Number(edificio.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

      const yearMatch = String(edificio.ano || '').match(/\d{4}/);
      const year = yearMatch ? parseInt(yearMatch[0], 10) : null;
      const isFocused = focusId && (edificio.id === focusId);

      const pagina = edificio.pagina || `edificio.html?id=${encodeURIComponent(edificio.id)}`;
      const marker = L.marker([lat, lng], { icon: isFocused ? highlightIcon : markerIcon });

      const thumbImg = edificio.imagem
        ? `<div style="margin-bottom:6px; max-height:100px; overflow:hidden; border-radius:3px;"><img src="${assetPath(edificio.imagem)}" style="width:100%; display:block; object-fit:cover;"></div>`
        : '';

      marker.bindPopup(`
        <div class="guia-popup">
          ${thumbImg}
          <a class="guia-popup-title" href="${assetPath(pagina)}">${edificio.nome}</a>
          <p class="guia-popup-meta">${edificio.endereco || ''}</p>
          <p class="guia-popup-meta">${edificio.arquiteto || 'Autor não identificado'}${edificio.ano ? ' · ' + edificio.ano : ''}</p>
        </div>
      `);

      marker.on('click', () => {
        marker.openPopup();
      });

      clusterLayer.addLayer(marker);

      const itemObj = {
        id: edificio.id,
        marker,
        lat,
        lng,
        year,
        uso: (edificio.uso || 'Residencial').toLowerCase(),
        tipologia: (edificio.tipologia || 'Multifamiliar').toLowerCase()
      };
      allMarkers.push(itemObj);

      if (isFocused) {
        focusedItem = itemObj;
      }
    });

    mapInstance.addLayer(clusterLayer);

    if (focusedItem) {
      mapInstance.setView([focusedItem.lat, focusedItem.lng], 17);
      setTimeout(() => {
        focusedItem.marker.openPopup();
      }, 350);
    } else {
      const bounds = clusterLayer.getBounds();
      if (bounds.isValid()) {
        mapInstance.fitBounds(bounds, { padding: [60, 60], maxZoom: 16 });
      }
    }

    setupMapDecadeFilter(allMarkers, clusterLayer, mapInstance);

    setTimeout(() => mapInstance.invalidateSize(), 150);
  };

  function setupMapDecadeFilter(allMarkers, clusterLayer, mapInstance) {
    const dropdownMenu = document.getElementById('map-filter-dropdown-menu');
    const triggerBtn = document.getElementById('map-filter-trigger');
    if (!dropdownMenu) return;

    if (triggerBtn) {
      triggerBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isHidden = dropdownMenu.hasAttribute('hidden');
        if (isHidden) {
          dropdownMenu.removeAttribute('hidden');
          triggerBtn.setAttribute('aria-expanded', 'true');
        } else {
          dropdownMenu.setAttribute('hidden', '');
          triggerBtn.setAttribute('aria-expanded', 'false');
        }
      });

      document.addEventListener('click', (e) => {
        if (!dropdownMenu.contains(e.target) && !triggerBtn.contains(e.target)) {
          dropdownMenu.setAttribute('hidden', '');
          triggerBtn.setAttribute('aria-expanded', 'false');
        }
      });
    }

    const decadeContainer = document.getElementById('map-decade-toggles');
    const usoContainer = document.getElementById('map-uso-toggles');
    const tipologiaContainer = document.getElementById('map-tipologia-toggles');

    function applyMapFilter() {
      // 1. Décadas
      const decadeBtns = decadeContainer ? decadeContainer.querySelectorAll('.map-decade-toggle') : [];
      const btnDecadeAll = decadeContainer ? decadeContainer.querySelector('.map-decade-toggle[data-decade="all"]') : null;
      const activeDecades = Array.from(decadeBtns)
        .filter((b) => b !== btnDecadeAll && b.classList.contains('is-active'))
        .map((b) => parseInt(b.dataset.decade, 10));
      const isAllDecades = btnDecadeAll?.classList.contains('is-active') || activeDecades.length === 0;

      // 2. Tipo de Uso
      const usoBtns = usoContainer ? usoContainer.querySelectorAll('.map-uso-toggle') : [];
      const btnUsoAll = usoContainer ? usoContainer.querySelector('.map-uso-toggle[data-uso="all"]') : null;
      const activeUsos = Array.from(usoBtns)
        .filter((b) => b !== btnUsoAll && b.classList.contains('is-active'))
        .map((b) => b.dataset.uso.toLowerCase());
      const isAllUso = btnUsoAll?.classList.contains('is-active') || activeUsos.length === 0;

      // 3. Tipologia
      const tipologyBtns = tipologiaContainer ? tipologiaContainer.querySelectorAll('.map-tipologia-toggle') : [];
      const btnTipoAll = tipologiaContainer ? tipologiaContainer.querySelector('.map-tipologia-toggle[data-tipologia="all"]') : null;
      const activeTipologies = Array.from(tipologyBtns)
        .filter((b) => b !== btnTipoAll && b.classList.contains('is-active'))
        .map((b) => b.dataset.tipologia.toLowerCase());
      const isAllTipologia = btnTipoAll?.classList.contains('is-active') || activeTipologies.length === 0;

      clusterLayer.clearLayers();

      allMarkers.forEach(({ marker, year, uso, tipologia }) => {
        const matchDecade = isAllDecades || (Number.isFinite(year) && activeDecades.some((dec) => year >= dec && year <= dec + 9));
        const matchUso = isAllUso || activeUsos.some((u) => uso.includes(u));
        const matchTipologia = isAllTipologia || activeTipologies.some((t) => tipologia.includes(t));

        if (matchDecade && matchUso && matchTipologia) {
          clusterLayer.addLayer(marker);
        }
      });

      const newBounds = clusterLayer.getBounds();
      if (newBounds.isValid()) {
        mapInstance.fitBounds(newBounds, { padding: [60, 60], maxZoom: 16 });
      }
    }

    function bindMapToggleGroup(container, itemClass, dataAttr) {
      if (!container) return;
      const buttons = container.querySelectorAll('.' + itemClass);
      const btnAll = container.querySelector('.' + itemClass + '[data-' + dataAttr + '="all"]');
      const specificButtons = Array.from(buttons).filter((b) => b !== btnAll);

      buttons.forEach((btn) => {
        btn.addEventListener('click', () => {
          const val = btn.dataset[dataAttr];
          if (val === 'all') {
            buttons.forEach((b) => b.classList.toggle('is-active', b === btnAll));
          } else {
            btn.classList.toggle('is-active');
            if (btnAll) btnAll.classList.remove('is-active');

            const activeSpecific = specificButtons.filter((b) => b.classList.contains('is-active'));
            if (activeSpecific.length === specificButtons.length || activeSpecific.length === 0) {
              buttons.forEach((b) => b.classList.toggle('is-active', b === btnAll));
            }
          }
          applyMapFilter();
        });
      });
    }

    bindMapToggleGroup(decadeContainer, 'map-decade-toggle', 'decade');
    bindMapToggleGroup(usoContainer, 'map-uso-toggle', 'uso');
    bindMapToggleGroup(tipologiaContainer, 'map-tipologia-toggle', 'tipologia');
  }
})();
