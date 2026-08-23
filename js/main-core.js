(function () {
  let _carouselInterval = null;
  function getBasePath() {
    return (window.location.pathname.includes('/buildings/') || window.location.pathname.includes('/trabalhos/')) ? '../' : '';
  }

  function assetPath(path) {
    if (!path) return '';
    if (/^(https?:)?\/\//.test(path) || path.startsWith('#') || path.startsWith('mailto:') || path.startsWith('tel:')) return path;
    return getBasePath() + path.replace(/^\//, '').replace(/^\.\//, '');
  }

  function normalizePath(path) {
    return path.replace(/^\//, '').replace(/^\.\//, '').replace(/^\.\.\//, '');
  }

  window.GUIA = window.GUIA || {};
  window.GUIA.assetPath = assetPath;

  document.addEventListener('DOMContentLoaded', () => {
    loadHeader();
    setupPageTransitions();
    setupCurrentPage();
  });

  async function loadHeader() {
    const placeholder = document.getElementById('header-placeholder');
    if (!placeholder) return;

    try {
      const response = await fetch(assetPath('components/header.html'));
      if (!response.ok) throw new Error('Header não encontrado');

      placeholder.innerHTML = await response.text();
      fixHeaderLinks();
      fixHeaderImages();
      markActiveMenuItem();
      setupMobileMenu();
    } catch (error) {
      console.error('Erro ao carregar o header:', error);
    }
  }

  function setupMobileMenu() {
    const toggle = document.querySelector('.menu-toggle');
    const menu = document.querySelector('.site-menu');
    if (!toggle || !menu) return;

    toggle.addEventListener('click', () => {
      const isOpen = menu.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    });
  }


  function fixHeaderLinks() {
    const base = getBasePath();

    document.querySelectorAll('#header-placeholder a[href]').forEach((link) => {
      const href = link.getAttribute('href');
      if (!href) return;
      if (href.startsWith('http') || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return;
      if (href.startsWith('../')) return;

      link.setAttribute('href', base + href.replace(/^\//, ''));
    });
  }


  function fixHeaderImages() {
    document.querySelectorAll('#header-placeholder img[src]').forEach((image) => {
      const src = image.getAttribute('src');
      if (!src) return;
      if (/^(https?:)?\/\//.test(src) || src.startsWith('data:') || src.startsWith('blob:')) return;
      if (src.startsWith('../')) return;

      image.setAttribute('src', assetPath(src));
    });
  }

  function getCurrentPageName() {
    const currentFile = window.location.pathname.split('/').pop() || 'index.html';
    return currentFile.replace('.html', '');
  }

  function markActiveMenuItem() {
    const pageName = getCurrentPageName();
    const isBuildingPage = window.location.pathname.includes('/buildings/');
    const isAcademicPage = window.location.pathname.includes('/trabalhos/');
    const isHome = pageName === 'index' || pageName === 'home' || pageName === '' || document.querySelector('.home-page') !== null;
    const isMap = pageName === 'mapa' || document.querySelector('.map-page') !== null;

    document.body.classList.toggle('is-home-page', isHome);
    document.body.classList.toggle('is-map-page', isMap);

    document.querySelectorAll('.site-menu a').forEach((link) => {
      link.classList.toggle('is-active', link.dataset.page === pageName || (isBuildingPage && link.dataset.page === 'construcoes') || (isAcademicPage && link.dataset.page === 'trabalhos-academicos'));
    });
  }

  function setupPageTransitions() {
    document.addEventListener('click', async (event) => {
      const link = event.target.closest('a');
      if (!link) return;

      const rawHref = link.getAttribute('href') || '';
      if (rawHref.startsWith('#') || rawHref.startsWith('mailto:') || rawHref.startsWith('tel:')) return;

      const url = new URL(link.href, window.location.href);
      const isSameSite = url.origin === window.location.origin;
      const isHtmlPage = url.pathname.endsWith('.html') || url.pathname.endsWith('/');

      if (!isSameSite || !isHtmlPage) return;

      event.preventDefault();

      if (url.pathname === window.location.pathname && url.search === window.location.search) return;

      await navigateTo(url.href, true);
    });

    window.addEventListener('popstate', () => {
      navigateTo(window.location.href, false);
    });
  }

  function cleanupMapInstances() {
    if (window.GUIA && window.GUIA._mainMap) {
      try {
        window.GUIA._mainMap.remove();
      } catch (e) {}
      window.GUIA._mainMap = null;
    }
    if (window.GUIA && window.GUIA._miniMap) {
      try {
        window.GUIA._miniMap.remove();
      } catch (e) {}
      window.GUIA._miniMap = null;
    }
  }

  async function navigateTo(url, pushState) {
    const currentMain = document.querySelector('main');
    if (!currentMain) {
      window.location.href = url;
      return;
    }

    currentMain.classList.add('is-leaving');
    window.scrollTo({ top: 0, behavior: 'instant' });

    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error('Página não encontrada');

      const html = await response.text();
      const page = new DOMParser().parseFromString(html, 'text/html');
      const newMain = page.querySelector('main');
      const newTitle = page.querySelector('title');

      if (!newMain) throw new Error('Conteúdo da página não encontrado');

      // Tempo de saída suave da página atual (200ms)
      await new Promise((res) => setTimeout(res, 200));

      cleanupMapInstances();
      newMain.classList.add('is-entering');
      currentMain.replaceWith(newMain);
      document.title = newTitle ? newTitle.textContent : document.title;

      if (pushState) {
        history.pushState({}, '', url);
      }

      await loadHeader();
      await setupCurrentPage();

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          newMain.classList.remove('is-entering');
        });
      });
    } catch (error) {
      console.error('Erro na transição:', error);
      window.location.href = url;
    }
  }

  async function setupCurrentPage() {
    await carregarCarrosselHome();
    await carregarTrabalhosAcademicos();
    await carregarPaginaTrabalho();
    await carregarConstrucoes();
    await carregarPaginaEdificio();
    await prepararMapa();
  }

  async function carregarCarrosselHome() {
    const container = document.querySelector('.home-page .carousel');
    if (!container) return;

    try {
      const response = await fetch(assetPath('data/carrossel.json'));
      if (!response.ok) throw new Error('Arquivo de carrossel não encontrado');
      const imagens = await response.json();

      if (!Array.isArray(imagens) || imagens.length === 0) return;

      container.innerHTML = '';
      if (_carouselInterval) {
        clearInterval(_carouselInterval);
        _carouselInterval = null;
      }

      const imgElements = [];
      imagens.forEach((src, idx) => {
        const img = document.createElement('img');
        img.src = assetPath(src);
        img.alt = `Carrossel ${idx + 1}`;
        img.className = `carousel-slide ${idx === 0 ? 'is-active' : ''}`;
        container.appendChild(img);
        imgElements.push(img);
      });

      if (imgElements.length <= 1) return;

      let currentIndex = 0;
      const displayDuration = 6000; // 6s de exibição total por foto (com transição suave de 1.5s sobreposta)

      _carouselInterval = setInterval(() => {
        const prevIndex = currentIndex;
        currentIndex = (currentIndex + 1) % imgElements.length;

        const prevImg = imgElements[prevIndex];
        const nextImg = imgElements[currentIndex];

        prevImg.classList.remove('is-active');
        prevImg.classList.add('is-prev');

        nextImg.classList.add('is-active');

        setTimeout(() => {
          prevImg.classList.remove('is-prev');
        }, 1500);
      }, displayDuration);
    } catch (error) {
      console.error('Erro ao carregar carrossel:', error);
    }
  }



  function escapeHTML(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  async function carregarTrabalhos() {
    const response = await fetch(assetPath('data/trabalhos.json'));
    if (!response.ok) throw new Error('Arquivo de trabalhos acadêmicos não encontrado');
    return response.json();
  }

  async function carregarTrabalhosAcademicos() {
    const container = document.getElementById('academic-grid');
    if (!container) return;

    try {
      const trabalhos = await carregarTrabalhos();
      container.innerHTML = '';

      // Agrupar por tipo (Pesquisa, Estudo, Artigo, etc)
      const groups = {};
      trabalhos.forEach((t) => {
        const cat = (t.tipo || 'Pesquisa').trim();
        if (!groups[cat]) groups[cat] = [];
        groups[cat].push(t);
      });

      const priorityOrder = ['Pesquisa', 'Estudo', 'Artigo'];
      const sortedCats = Object.keys(groups).sort((a, b) => {
        const idxA = priorityOrder.indexOf(a);
        const idxB = priorityOrder.indexOf(b);
        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
        if (idxA !== -1) return -1;
        if (idxB !== -1) return 1;
        return a.localeCompare(b, 'pt-BR');
      });

      sortedCats.forEach((catName) => {
        const section = document.createElement('section');
        section.className = 'street-group-section';

        const headerBar = document.createElement('div');
        headerBar.className = 'street-header-bar';
        headerBar.innerHTML = `
          <h3 class="street-title">${escapeHTML(catName)}s</h3>
          <div class="street-divider-line"></div>
        `;
        section.appendChild(headerBar);

        const gridGroup = document.createElement('div');
        gridGroup.className = 'constructions-grid-group';

        groups[catName].forEach((trabalho) => {
          const card = document.createElement('a');
          card.className = 'construction-card';
          card.href = assetPath(`trabalho.html?id=${encodeURIComponent(trabalho.id)}`);

          const imagem = trabalho.capa
            ? `<img src="${assetPath(trabalho.capa)}" alt="${escapeHTML(trabalho.titulo)}" loading="lazy">`
            : `<div class="construction-image-placeholder">Imagem do trabalho</div>`;

          card.innerHTML = `
            <div class="construction-image">${imagem}</div>
            <div class="construction-info">
              <h3 class="construction-card-name">${escapeHTML(trabalho.titulo)}</h3>
              <p class="construction-card-address">${escapeHTML(trabalho.subtitulo || trabalho.participantes || 'Trabalho Acadêmico')}</p>
              <p class="construction-card-year">${escapeHTML(trabalho.ano || 's.d.')}</p>
            </div>
          `;

          gridGroup.appendChild(card);
        });

        section.appendChild(gridGroup);
        container.appendChild(section);
      });
    } catch (error) {
      console.error('Erro ao carregar trabalhos acadêmicos:', error);
      container.innerHTML = '<p>Não foi possível carregar os trabalhos acadêmicos.</p>';
    }
  }

  async function carregarPaginaTrabalho() {
    const container = document.getElementById('academic-detail');
    if (!container) return;

    try {
      const params = new URLSearchParams(window.location.search);
      const id = params.get('id');
      const trabalhos = await carregarTrabalhos();
      const trabalho = trabalhos.find((item) => item.id === id) || trabalhos[0];

      if (!trabalho) {
        container.innerHTML = '<h1>Trabalho não encontrado</h1>';
        return;
      }

      document.title = `${trabalho.titulo} - GUIA`;

      const textoHtml = Array.isArray(trabalho.texto) && trabalho.texto.length > 0
        ? trabalho.texto.map((paragrafo) => `<p>${escapeHTML(paragrafo)}</p>`).join('')
        : '<p>Texto em desenvolvimento.</p>';

      const participantesTexto = trabalho.participantes || trabalho.resumo || '';

      const pdfHtml = trabalho.pdf
        ? `
          <div class="academic-pdf-main-container">
            <div class="academic-pdf-header-bar">
              <span class="pdf-tag-label">Documento PDF</span>
              <a class="academic-pdf-button-link" href="${assetPath(trabalho.pdf)}" target="_blank" rel="noopener">
                abrir em nova aba ↗
              </a>
            </div>
            <div class="building-stack-item academic-pdf-frame-embed">
              <iframe src="${assetPath(trabalho.pdf)}" title="PDF - ${escapeHTML(trabalho.titulo)}"></iframe>
            </div>
          </div>
        `
        : `
          <div class="building-image-placeholder">
            PDF não disponível para este trabalho
          </div>
        `;

      const imagensDoTrabalho = Array.isArray(trabalho.imagens) && trabalho.imagens.length > 0
        ? trabalho.imagens
        : Array.isArray(trabalho.slides) ? trabalho.slides : [];

      if (trabalho.capa && !imagensDoTrabalho.includes(trabalho.capa)) {
        imagensDoTrabalho.unshift(trabalho.capa);
      }

      const fotosHtml = imagensDoTrabalho.length > 0
        ? imagensDoTrabalho.map((foto, index) => `
            <figure class="building-stack-item">
              <img src="${assetPath(foto)}" alt="${escapeHTML(trabalho.titulo)} - imagem ${index + 1}" data-lightbox-src="${assetPath(foto)}">
            </figure>
          `).join('')
        : '';

      container.innerHTML = `
        <nav class="building-back-links" aria-label="Navegação do trabalho acadêmico">
          <a class="back-link" href="${assetPath('trabalhos-academicos.html')}">← voltar aos trabalhos acadêmicos</a>
        </nav>

        <div class="building-split-layout">
          <aside class="building-info-col">
            <header class="building-title-header">
              <h1>${escapeHTML(trabalho.titulo)}</h1>
              <span class="building-status-tag">${escapeHTML(trabalho.tipo || 'PESQUISA')}</span>
              <p class="building-location-tag">${escapeHTML(trabalho.status || 'EM DESENVOLVIMENTO')}${trabalho.ano ? ` · ${escapeHTML(trabalho.ano)}` : ''}</p>
            </header>

            <div class="building-datasheet">
              <div class="datasheet-row">
                <span class="datasheet-label">Tipo:</span>
                <span class="datasheet-value">${escapeHTML(trabalho.tipo || 'Pesquisa')}</span>
              </div>
              <div class="datasheet-row">
                <span class="datasheet-label">Ano:</span>
                <span class="datasheet-value">${escapeHTML(trabalho.ano || 's.d.')}</span>
              </div>
              <div class="datasheet-row">
                <span class="datasheet-label">Status:</span>
                <span class="datasheet-value">${escapeHTML(trabalho.status || 'Em desenvolvimento')}</span>
              </div>
              ${participantesTexto ? `
                <div class="datasheet-row">
                  <span class="datasheet-label">Autores:</span>
                  <span class="datasheet-value">${escapeHTML(participantesTexto)}</span>
                </div>
              ` : ''}
              ${trabalho.subtitulo ? `
                <div class="datasheet-row">
                  <span class="datasheet-label">Subtítulo:</span>
                  <span class="datasheet-value">${escapeHTML(trabalho.subtitulo)}</span>
                </div>
              ` : ''}
            </div>

            <div class="building-description-text">
              ${textoHtml}
            </div>
          </aside>

          <main class="building-media-col">
            ${pdfHtml}
            ${fotosHtml}
          </main>
        </div>
      `;

      prepararLightbox(container);
    } catch (error) {
      console.error('Erro ao carregar página do trabalho:', error);
      container.innerHTML = '<h1>Erro ao carregar trabalho acadêmico</h1>';
    }
  }


  function prepararPdfViewer(container) {
    const trigger = container.querySelector('[data-pdf-viewer-trigger]');
    const viewer = container.querySelector('[data-pdf-viewer]');
    if (!trigger || !viewer) return;

    trigger.addEventListener('click', () => {
      const isHidden = viewer.hasAttribute('hidden');
      if (isHidden) {
        viewer.removeAttribute('hidden');
        trigger.textContent = 'ocultar PDF';
        viewer.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else {
        viewer.setAttribute('hidden', '');
        trigger.textContent = 'visualizar no site';
      }
    });
  }


  function prepararLightbox(container) {
    const buttons = container.querySelectorAll('[data-lightbox-src]');
    if (!buttons.length) return;

    let lightbox = document.querySelector('.image-lightbox');
    if (!lightbox) {
      lightbox = document.createElement('div');
      lightbox.className = 'image-lightbox';
      lightbox.innerHTML = '<button type="button" aria-label="Fechar imagem ampliada">×</button><img alt="Imagem ampliada">';
      document.body.appendChild(lightbox);
    }

    const image = lightbox.querySelector('img');
    const close = lightbox.querySelector('button');

    function closeLightbox() {
      lightbox.classList.remove('is-open');
      image.removeAttribute('src');
    }

    buttons.forEach((button) => {
      button.addEventListener('click', () => {
        image.src = button.dataset.lightboxSrc;
        lightbox.classList.add('is-open');
      });
    });

    close.addEventListener('click', closeLightbox);
    lightbox.addEventListener('click', (event) => {
      if (event.target === lightbox) closeLightbox();
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') closeLightbox();
    });
  }

  async function carregarEdificios() {
    const response = await fetch(assetPath('data/edificios.json'));
    if (!response.ok) throw new Error('Arquivo de edifícios não encontrado');
    return response.json();
  }

  function paginaEdificio(edificio) {
    return edificio.pagina || `edificio.html?id=${encodeURIComponent(edificio.id)}`;
  }

  function extractYear(anoStr) {
    if (!anoStr) return 9999;
    const match = String(anoStr).match(/\d{4}/);
    return match ? parseInt(match[0], 10) : 9999;
  }

  function formatBairroName(rawBairro) {
    if (!rawBairro) return 'Outros Bairros';
    const clean = rawBairro.replace(/\s*-\s*RECIFE/i, '').trim();
    if (clean.toLowerCase() === 'boa vista') return 'Boa Vista';
    if (clean.toLowerCase() === 'soledade') return 'Soledade';
    if (clean.toLowerCase() === 'santo amaro') return 'Santo Amaro';
    return clean;
  }

  async function carregarConstrucoes() {
    const container = document.getElementById('constructions-grid');
    if (!container) return;

    try {
      const rawEdificios = await carregarEdificios();

      // Filtrar itens incompletos
      const edificios = rawEdificios
        .filter((item) => item && item.nome && item.nome.trim() !== '' && item.nome !== 'vnn' && item.nome !== 'vvnvj');

      container.innerHTML = '';

      // 1. Agrupar edifícios por Bairro e depois por Logradouro
      const bairroGroups = {};
      edificios.forEach((edificio) => {
        const bairroName = formatBairroName(edificio.bairro);
        let streetName = edificio.logradouro;
        if (!streetName) {
          const parts = (edificio.endereco || '').split(',');
          streetName = parts[0] ? parts[0].trim() : 'Outros Logradouros';
        }

        if (!bairroGroups[bairroName]) {
          bairroGroups[bairroName] = {};
        }
        if (!bairroGroups[bairroName][streetName]) {
          bairroGroups[bairroName][streetName] = [];
        }
        bairroGroups[bairroName][streetName].push(edificio);
      });

      // Ordenar Bairros (Boa Vista primeiro, Soledade depois, etc)
      const priorityOrder = ['Boa Vista', 'Soledade', 'Santo Amaro'];
      const sortedBairros = Object.keys(bairroGroups).sort((a, b) => {
        const idxA = priorityOrder.indexOf(a);
        const idxB = priorityOrder.indexOf(b);
        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
        if (idxA !== -1) return -1;
        if (idxB !== -1) return 1;
        return a.localeCompare(b, 'pt-BR');
      });

      sortedBairros.forEach((bairroName) => {
        const streetsInBairro = bairroGroups[bairroName];
        let totalEdificiosInBairro = 0;
        Object.values(streetsInBairro).forEach((arr) => { totalEdificiosInBairro += arr.length; });

        // Elemento Accordion do Bairro (Drop Card)
        const bairroAccordion = document.createElement('div');
        bairroAccordion.className = 'bairro-accordion-item is-open'; // Aberto por padrão

        const accordionHeader = document.createElement('button');
        accordionHeader.type = 'button';
        accordionHeader.className = 'bairro-accordion-header';
        accordionHeader.innerHTML = `
          <span class="bairro-arrow">›</span>
          <span class="bairro-name">${escapeHTML(bairroName)}</span>
          <span class="bairro-count">${totalEdificiosInBairro} ${totalEdificiosInBairro === 1 ? 'edifício' : 'edifícios'}</span>
        `;

        accordionHeader.addEventListener('click', () => {
          bairroAccordion.classList.toggle('is-open');
        });

        const accordionContent = document.createElement('div');
        accordionContent.className = 'bairro-accordion-content';

        // Ordenar ruas dentro do Bairro alfabeticamente
        const sortedStreets = Object.keys(streetsInBairro).sort((a, b) => a.localeCompare(b, 'pt-BR'));

        sortedStreets.forEach((streetName) => {
          const items = streetsInBairro[streetName].sort((a, b) => extractYear(a.ano) - extractYear(b.ano));

          const section = document.createElement('section');
          section.className = 'street-group-section';

          const headerBar = document.createElement('div');
          headerBar.className = 'street-header-bar';
          headerBar.innerHTML = `
            <h3 class="street-title">${escapeHTML(streetName)}</h3>
            <div class="street-divider-line"></div>
          `;
          section.appendChild(headerBar);

          const gridGroup = document.createElement('div');
          gridGroup.className = 'constructions-grid-group';

          items.forEach((edificio) => {
            const card = document.createElement('a');
            card.className = 'construction-card';
            card.dataset.year = extractYear(edificio.ano);
            card.dataset.uso = edificio.uso || 'Residencial';
            card.dataset.tipologia = edificio.tipologia || 'Multifamiliar';
            card.href = assetPath(paginaEdificio(edificio));

            const imagem = edificio.imagem
              ? `<img src="${assetPath(edificio.imagem)}" alt="${escapeHTML(edificio.nome)}" loading="lazy">`
              : `<div class="construction-image-placeholder">Imagem do edifício</div>`;

            const shortAddr = String(edificio.endereco || '')
              .replace(/,?\s*-\s*Recife\s*-\s*PE/gi, '')
              .replace(/,?\s*-\s*Recife/gi, '')
              .replace(/,?\s*Recife\s*-\s*PE/gi, '')
              .trim();

            card.innerHTML = `
              <div class="construction-image">${imagem}</div>
              <div class="construction-info">
                <h3 class="construction-card-name">${escapeHTML(edificio.nome)}</h3>
                <p class="construction-card-address">${escapeHTML(shortAddr)}</p>
                <p class="construction-card-year">${escapeHTML(edificio.ano || 's.d.')}</p>
              </div>
            `;

            gridGroup.appendChild(card);
          });

          section.appendChild(gridGroup);
          accordionContent.appendChild(section);
        });

        bairroAccordion.appendChild(accordionHeader);
        bairroAccordion.appendChild(accordionContent);
        container.appendChild(bairroAccordion);
      });

      setupDecadeFilterControls(container);
    } catch (error) {
      console.error('Erro ao carregar edifícios:', error);
      container.innerHTML = '<p>Não foi possível carregar os edifícios.</p>';
    }
  }

  function setupDecadeFilterControls(gridContainer) {
    const decadeContainer = document.getElementById('decade-toggles');
    const usoContainer = document.getElementById('uso-toggles');
    const tipologiaContainer = document.getElementById('tipologia-toggles');
    if (!gridContainer) return;

    const cards = gridContainer.querySelectorAll('.construction-card');
    const streetSections = gridContainer.querySelectorAll('.street-group-section');
    const bairroAccordions = gridContainer.querySelectorAll('.bairro-accordion-item');

    function applyFilter() {
      // 1. Décadas
      const decadeBtns = decadeContainer ? decadeContainer.querySelectorAll('.decade-toggle') : [];
      const btnDecadeAll = decadeContainer ? decadeContainer.querySelector('.decade-toggle[data-decade="all"]') : null;
      const activeDecades = Array.from(decadeBtns)
        .filter((b) => b !== btnDecadeAll && b.classList.contains('is-active'))
        .map((b) => parseInt(b.dataset.decade, 10));
      const isAllDecades = btnDecadeAll?.classList.contains('is-active') || activeDecades.length === 0;

      // 2. Tipo de Uso
      const usoBtns = usoContainer ? usoContainer.querySelectorAll('.uso-toggle') : [];
      const btnUsoAll = usoContainer ? usoContainer.querySelector('.uso-toggle[data-uso="all"]') : null;
      const activeUsos = Array.from(usoBtns)
        .filter((b) => b !== btnUsoAll && b.classList.contains('is-active'))
        .map((b) => b.dataset.uso.toLowerCase());
      const isAllUso = btnUsoAll?.classList.contains('is-active') || activeUsos.length === 0;

      // 3. Tipologia
      const tipologyBtns = tipologiaContainer ? tipologiaContainer.querySelectorAll('.tipologia-toggle') : [];
      const btnTipoAll = tipologiaContainer ? tipologiaContainer.querySelector('.tipologia-toggle[data-tipologia="all"]') : null;
      const activeTipologies = Array.from(tipologyBtns)
        .filter((b) => b !== btnTipoAll && b.classList.contains('is-active'))
        .map((b) => b.dataset.tipologia.toLowerCase());
      const isAllTipologia = btnTipoAll?.classList.contains('is-active') || activeTipologies.length === 0;

      cards.forEach((card) => {
        const year = parseInt(card.dataset.year, 10);
        const cardUso = (card.dataset.uso || '').toLowerCase();
        const cardTipologia = (card.dataset.tipologia || '').toLowerCase();

        const matchDecade = isAllDecades || (Number.isFinite(year) && activeDecades.some((dec) => year >= dec && year <= dec + 9));
        const matchUso = isAllUso || activeUsos.some((u) => cardUso.includes(u));
        const matchTipologia = isAllTipologia || activeTipologies.some((t) => cardTipologia.includes(t));

        const visible = matchDecade && matchUso && matchTipologia;
        card.style.display = visible ? '' : 'none';
      });

      // Ocultar seções de ruas sem edifícios visíveis
      streetSections.forEach((section) => {
        const visibleCards = section.querySelectorAll('.construction-card:not([style*="display: none"])');
        section.style.display = visibleCards.length > 0 ? '' : 'none';
      });

      // Ocultar accordions de bairros sem edifícios visíveis
      bairroAccordions.forEach((bairroItem) => {
        const visibleCards = bairroItem.querySelectorAll('.construction-card:not([style*="display: none"])');
        bairroItem.style.display = visibleCards.length > 0 ? '' : 'none';
      });
    }

    function bindToggleGroup(container, itemClass, dataAttr) {
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

            // Se marcou todos os itens individuais ou nenhum, desmarca todos e ativa a pílula "todos/todas"
            if (activeSpecific.length === specificButtons.length || activeSpecific.length === 0) {
              buttons.forEach((b) => b.classList.toggle('is-active', b === btnAll));
            }
          }
          applyFilter();
        });
      });
    }

    bindToggleGroup(decadeContainer, 'decade-toggle', 'decade');
    bindToggleGroup(usoContainer, 'uso-toggle', 'uso');
    bindToggleGroup(tipologiaContainer, 'tipologia-toggle', 'tipologia');
  }

  async function carregarPaginaEdificio() {
    const container = document.getElementById('building-detail');
    if (!container) return;

    try {
      const edificios = await carregarEdificios();
      const params = new URLSearchParams(window.location.search);
      const id = params.get('id');
      const currentPath = normalizePath(window.location.pathname);
      const edificio = edificios.find((item) => item.id === id)
        || edificios.find((item) => item.pagina && currentPath.endsWith(normalizePath(item.pagina).split('?')[0]));

      if (!edificio) {
        container.innerHTML = '<h1>Edifício não encontrado</h1>';
        return;
      }

      document.title = `${edificio.nome} - GUIA`;

      const todasAsFotos = [];
      if (edificio.imagem) todasAsFotos.push(edificio.imagem);
      if (Array.isArray(edificio.fotos)) {
        edificio.fotos.forEach((foto) => {
          if (!todasAsFotos.includes(foto)) todasAsFotos.push(foto);
        });
      }

      const textoHtml = Array.isArray(edificio.texto) && edificio.texto.length > 0
        ? edificio.texto.map((paragrafo) => `<p>${escapeHTML(paragrafo)}</p>`).join('')
        : '<p>Texto em desenvolvimento.</p>';

      const fotosHtml = todasAsFotos.length > 0
        ? todasAsFotos.map((foto, index) => `
            <figure class="building-stack-item">
              <img src="${assetPath(foto)}" alt="${escapeHTML(edificio.nome)} - foto ${index + 1}" data-lightbox-src="${assetPath(foto)}" loading="lazy">
            </figure>
          `).join('')
        : `<div class="building-image-placeholder">Imagem do edifício</div>`;

      // Formatar Etapas / Momentos do Edifício
      const etapasHtml = Array.isArray(edificio.etapas) && edificio.etapas.length > 0
        ? `
          <div class="building-etapas-section">
            <h3 class="etapas-title">Etapas e Momentos do Imóvel</h3>
            <div class="etapas-accordion-list">
              ${edificio.etapas.map((etapa) => `
                <details class="etapa-accordion-item" open>
                  <summary class="etapa-accordion-header">
                    <span class="etapa-arrow">›</span>
                    <span class="etapa-year">${escapeHTML(etapa.ano || 's.d.')}</span>
                    <span class="etapa-dashed-line"></span>
                    <span class="etapa-type">${escapeHTML(etapa.tipo || 'projeto')}</span>
                  </summary>
                  <div class="etapa-accordion-body">
                    ${etapa.projetistas ? `<p class="etapa-meta"><strong>Projetista(s):</strong> ${escapeHTML(etapa.projetistas)}</p>` : ''}
                    ${etapa.descricao ? `<p class="etapa-desc">${escapeHTML(etapa.descricao)}</p>` : ''}
                  </div>
                </details>
              `).join('')}
            </div>
          </div>
        `
        : '';

      let projList = [];
      if (Array.isArray(edificio.projetistas) && edificio.projetistas.length > 0) {
        projList = edificio.projetistas
          .map((p) => (p.prefixo ? `${p.prefixo} ${p.nome}`.trim() : (p.nome ? p.nome.trim() : '')))
          .filter(Boolean);
      } else if (edificio.arquiteto && edificio.arquiteto.trim()) {
        projList = edificio.arquiteto.split(/,\s*/).map((s) => s.trim()).filter(Boolean);
      }

      let projetistasHtml = 'Não informado';
      if (projList.length === 1) {
        projetistasHtml = escapeHTML(projList[0]);
      } else if (projList.length > 1) {
        projetistasHtml = `
          <ul class="datasheet-projetistas-list">
            ${projList.map((p) => `<li>- ${escapeHTML(p)}</li>`).join('')}
          </ul>
        `;
      }

      const temCoords = Number.isFinite(Number(edificio.lat)) && Number.isFinite(Number(edificio.lng));

      container.innerHTML = `
        <div class="watermark-print">GUIA Arquitetura Recife</div>

        <nav class="building-back-links" aria-label="Navegação do edifício">
          <a class="back-link" href="${assetPath('construcoes.html')}">← edifícios</a>
          <a class="back-link" href="${assetPath(`mapa.html?focus=${encodeURIComponent(edificio.id)}`)}">ver no mapa →</a>
          <button type="button" class="back-link btn-export-pdf" onclick="window.print()" title="Exportar ficha técnica em PDF">
            exportar ficha (pdf) 🖨️
          </button>
        </nav>

        <div class="building-split-layout">
          <aside class="building-info-col">
            <header class="building-title-header">
              <h1>${escapeHTML(edificio.nome)}</h1>
              <span class="building-status-tag">${escapeHTML(edificio.status || 'CONSTRUÍDO')}</span>
              <p class="building-location-tag">${escapeHTML(edificio.bairro || 'RECIFE - PE')}, ${escapeHTML(edificio.ano || 's.d.')}</p>
            </header>

            <div class="building-datasheet">
              <div class="datasheet-row">
                <span class="datasheet-label">Projetista(s):</span>
                <div class="datasheet-value">${projetistasHtml}</div>
              </div>
              <div class="datasheet-row">
                <span class="datasheet-label">Ano:</span>
                <span class="datasheet-value">${escapeHTML(edificio.ano || 's.d.')}</span>
              </div>
              <div class="datasheet-row">
                <span class="datasheet-label">Endereço:</span>
                <span class="datasheet-value">${escapeHTML(edificio.endereco || 'Não informado')}</span>
              </div>
              ${temCoords ? `
                <div class="datasheet-row">
                  <span class="datasheet-label">Coordenadas:</span>
                  <span class="datasheet-value">${escapeHTML(edificio.lat)}, ${escapeHTML(edificio.lng)}</span>
                </div>
                <div class="building-mini-map-box" id="mini-map-trigger-box">
                  <div id="building-mini-map"></div>
                </div>
              ` : ''}
            </div>

            <div class="building-description-text">
              ${textoHtml}
            </div>

            ${etapasHtml}
          </aside>

          <main class="building-media-col">
            ${fotosHtml}
          </main>
        </div>
      `;

      if (temCoords) {
        initBuildingMiniMap(edificio);
      }

      setupBuildingLightbox(container, edificio);
    } catch (error) {
      console.error('Erro ao carregar página do edifício:', error);
      container.innerHTML = '<h1>Erro ao carregar edifício</h1>';
    }
  }

  async function initBuildingMiniMap(edificio) {
    const miniMapElem = document.getElementById('building-mini-map');
    if (!miniMapElem) return;

    if (typeof L === 'undefined') {
      await loadScript('https://unpkg.com/leaflet@1.9.4/dist/leaflet.js');
    }
    if (typeof L === 'undefined') return;

    if (window.GUIA && window.GUIA._miniMap) {
      try {
        window.GUIA._miniMap.remove();
      } catch (e) {}
      window.GUIA._miniMap = null;
    }

    const lat = Number(edificio.lat);
    const lng = Number(edificio.lng);

    const miniMap = L.map(miniMapElem, {
      zoomControl: false,
      scrollWheelZoom: false,
      dragging: false,
      attributionControl: false
    }).setView([lat, lng], 16);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 19
    }).addTo(miniMap);

    const markerIcon = L.divIcon({
      className: '',
      html: '<div class="guia-marker"></div>',
      iconSize: [28, 28],
      iconAnchor: [14, 28]
    });

    L.marker([lat, lng], { icon: markerIcon }).addTo(miniMap);

    // Evento de clique para abrir o mapa geral com o edificio em destaque
    const box = document.getElementById('mini-map-trigger-box') || miniMapElem;
    box.setAttribute('tabindex', '0');
    box.setAttribute('role', 'button');
    box.setAttribute('aria-label', 'Abrir no mapa geral');

    const openMap = (e) => {
      e.preventDefault();
      const focusUrl = assetPath(`mapa.html?focus=${encodeURIComponent(edificio.id)}`);
      navigateTo(focusUrl, true);
    };

    box.addEventListener('click', openMap);
    box.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        openMap(e);
      }
    });

    window.GUIA._miniMap = miniMap;
    setTimeout(() => miniMap.invalidateSize(), 200);
  }


  function setupBuildingLightbox(container, edificio) {
    const galleryImages = [...container.querySelectorAll('.building-gallery img')];
    if (!galleryImages.length) return;

    const images = edificio.fotos.map((foto, index) => ({
      src: assetPath(foto),
      alt: `${edificio.nome} - foto ${index + 1}`
    }));

    let currentIndex = 0;

    const lightbox = document.createElement('div');
    lightbox.className = 'building-lightbox';
    lightbox.setAttribute('aria-hidden', 'true');
    lightbox.innerHTML = `
      <button class="lightbox-close" type="button" aria-label="Fechar imagem">×</button>
      <button class="lightbox-nav lightbox-prev" type="button" aria-label="Imagem anterior">‹</button>
      <figure class="lightbox-figure">
        <img class="lightbox-image" src="" alt="">
        <figcaption class="lightbox-counter"></figcaption>
      </figure>
      <button class="lightbox-nav lightbox-next" type="button" aria-label="Próxima imagem">›</button>
    `;

    document.body.appendChild(lightbox);

    const imageElement = lightbox.querySelector('.lightbox-image');
    const counterElement = lightbox.querySelector('.lightbox-counter');
    const closeButton = lightbox.querySelector('.lightbox-close');
    const prevButton = lightbox.querySelector('.lightbox-prev');
    const nextButton = lightbox.querySelector('.lightbox-next');

    function renderImage() {
      const current = images[currentIndex];
      imageElement.src = current.src;
      imageElement.alt = current.alt;
      counterElement.textContent = `${currentIndex + 1} / ${images.length}`;
      prevButton.style.display = images.length > 1 ? '' : 'none';
      nextButton.style.display = images.length > 1 ? '' : 'none';
    }

    function openLightbox(index) {
      currentIndex = index;
      renderImage();
      lightbox.classList.add('is-open');
      lightbox.setAttribute('aria-hidden', 'false');
      document.body.classList.add('lightbox-open');
    }

    function closeLightbox() {
      lightbox.classList.remove('is-open');
      lightbox.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('lightbox-open');
    }

    function showPrevious() {
      currentIndex = (currentIndex - 1 + images.length) % images.length;
      renderImage();
    }

    function showNext() {
      currentIndex = (currentIndex + 1) % images.length;
      renderImage();
    }

    galleryImages.forEach((img, index) => {
      img.setAttribute('tabindex', '0');
      img.setAttribute('role', 'button');
      img.setAttribute('aria-label', `Ampliar foto ${index + 1}`);

      img.addEventListener('click', () => openLightbox(index));
      img.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          openLightbox(index);
        }
      });
    });

    closeButton.addEventListener('click', closeLightbox);
    prevButton.addEventListener('click', showPrevious);
    nextButton.addEventListener('click', showNext);

    lightbox.addEventListener('click', (event) => {
      if (event.target === lightbox) closeLightbox();
    });

    document.addEventListener('keydown', (event) => {
      if (!lightbox.classList.contains('is-open')) return;
      if (event.key === 'Escape') closeLightbox();
      if (event.key === 'ArrowLeft') showPrevious();
      if (event.key === 'ArrowRight') showNext();
    });
  }

  async function prepararMapa() {
    const mapElement = document.getElementById('guia-map');
    if (!mapElement) return;

    await ensureMapDependencies();

    if (window.GUIA && typeof window.GUIA.initMap === 'function') {
      window.GUIA.initMap();
    }
  }

  async function ensureMapDependencies() {
    loadStylesheet('https://unpkg.com/leaflet@1.9.4/dist/leaflet.css');
    loadStylesheet('https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css');
    loadStylesheet('https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.Default.css');

    if (typeof L === 'undefined') {
      await loadScript('https://unpkg.com/leaflet@1.9.4/dist/leaflet.js');
    }

    if (typeof L.markerClusterGroup !== 'function') {
      await loadScript('https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js');
    }

    if (!window.GUIA || typeof window.GUIA.initMap !== 'function') {
      await loadScript(assetPath('js/mapa.js'));
    }
  }

  function loadStylesheet(href) {
    if ([...document.styleSheets].some((sheet) => sheet.href === href)) return;
    if (document.querySelector(`link[href="${href}"]`)) return;

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    document.head.appendChild(link);
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[src="${src}"]`);
      if (existing) {
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = src;
      script.onload = resolve;
      script.onerror = reject;
      document.body.appendChild(script);
    });
  }
})();
