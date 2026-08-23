(function () {
  const state = {
    activeTab: 'edificios', // 'edificios', 'trabalhos', 'carrossel'
    edificios: [],
    trabalhos: [],
    carrossel: [],
    searchQuery: ''
  };

  const elements = {
    tabs: document.querySelectorAll('[data-admin-tab]'),
    panels: document.querySelectorAll('[data-admin-panel]'),
    itemsList: document.getElementById('admin-items-list'),
    searchInput: document.getElementById('admin-search-input'),
    btnAddNew: document.getElementById('btn-add-new'),
    btnSaveFile: document.getElementById('btn-save-file'),
    btnImportFile: document.getElementById('btn-import-file'),
    importFileInput: document.getElementById('import-file-input'),
    toast: document.getElementById('admin-toast'),
    buildingForm: document.getElementById('building-editor-form'),
    academicForm: document.getElementById('academic-editor-form'),
    carouselForm: document.getElementById('carousel-editor-form'),
    buildingFormTitle: document.getElementById('building-form-title'),
    academicFormTitle: document.getElementById('academic-form-title'),
    buildingBadge: document.getElementById('building-id-badge'),
    academicBadge: document.getElementById('academic-id-badge'),
    btnCancelBuilding: document.getElementById('btn-cancel-building'),
    btnCancelAcademic: document.getElementById('btn-cancel-academic')
  };

  document.addEventListener('DOMContentLoaded', () => {
    init();
  });

  async function init() {
    setupTabs();
    setupForms();
    setupProjetistasManager();
    setupEtapasManager();
    setupAutosaveDraft();
    setupGlobalActions();
    await loadInitialData();
    renderSidebarList();
  }

  function slugify(text) {
    return String(text || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  function showToast(message, type = 'success') {
    if (!elements.toast) return;
    elements.toast.textContent = message;
    elements.toast.className = `admin-toast ${type}`;
    elements.toast.removeAttribute('hidden');
    setTimeout(() => {
      elements.toast.setAttribute('hidden', '');
    }, 4500);
  }

  async function loadInitialData() {
    try {
      const [resEdificios, resTrabalhos, resCarrossel] = await Promise.all([
        fetch('data/edificios.json').then((r) => r.json()).catch(() => []),
        fetch('data/trabalhos.json').then((r) => r.json()).catch(() => []),
        fetch('data/carrossel.json').then((r) => r.json()).catch(() => [])
      ]);
      state.edificios = resEdificios;
      state.trabalhos = resTrabalhos;
      state.carrossel = resCarrossel;

      if (elements.carouselForm) {
        elements.carouselForm.elements['carrosselImagens'].value = Array.isArray(resCarrossel) ? resCarrossel.join('\n') : '';
      }
    } catch (error) {
      console.error('Erro ao carregar dados iniciais:', error);
      showToast('Aviso: Não foi possível carregar os arquivos JSON existentes.', 'error');
    }
  }

  function setupTabs() {
    elements.tabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        const targetTab = tab.dataset.adminTab;
        state.activeTab = targetTab;

        elements.tabs.forEach((t) => t.classList.toggle('is-active', t.dataset.adminTab === targetTab));
        elements.panels.forEach((p) => p.classList.toggle('is-active', p.dataset.adminPanel === targetTab));

        if (targetTab === 'edificios') resetForm(elements.buildingForm);
        else if (targetTab === 'trabalhos') resetForm(elements.academicForm);

        renderSidebarList();
      });
    });
  }

  function renderSidebarList() {
    if (!elements.itemsList) return;
    elements.itemsList.innerHTML = '';

    if (state.activeTab === 'carrossel') {
      elements.itemsList.innerHTML = `
        <div class="admin-empty-state">
          <p><strong>Gerenciador do Carrossel</strong></p>
          <p style="font-size: 12px; opacity: 0.7;">${state.carrossel.length} imagem(ns) no carrossel</p>
        </div>
      `;
      return;
    }

    const isEdificios = state.activeTab === 'edificios';
    const rawList = isEdificios ? state.edificios : state.trabalhos;
    const query = state.searchQuery.toLowerCase();

    const filteredList = rawList.filter((item) => {
      const title = (isEdificios ? item.nome : item.titulo) || '';
      const subtitle = (isEdificios ? item.arquiteto : item.subtitulo || item.tipo) || '';
      return title.toLowerCase().includes(query) || subtitle.toLowerCase().includes(query);
    });

    if (filteredList.length === 0) {
      elements.itemsList.innerHTML = `
        <div class="admin-empty-state">
          <p>Nenhum item encontrado.</p>
          <button type="button" class="admin-button add-btn small-btn" onclick="document.getElementById('btn-add-new').click()">+ Criar novo</button>
        </div>
      `;
      return;
    }

    filteredList.forEach((item) => {
      const card = document.createElement('div');
      const activeForm = isEdificios ? elements.buildingForm : elements.academicForm;
      const currentEditingId = activeForm.elements['editing_id'].value;

      card.className = `admin-item-card ${item.id === currentEditingId ? 'is-selected' : ''}`;

      const titleText = isEdificios ? item.nome : item.titulo;
      const metaText = isEdificios
        ? `${item.arquiteto || 'Autor não informado'} · ${item.ano || 's.d.'}`
        : `${item.tipo || 'Pesquisa'} · ${item.ano || 's.d.'}`;

      card.innerHTML = `
        <div class="item-card-info">
          <h4>${escapeHTML(titleText)}</h4>
          <p>${escapeHTML(metaText)}</p>
        </div>
        <div class="item-card-actions">
          <button type="button" class="btn-card-edit" title="Editar item">✏️</button>
          <button type="button" class="btn-card-delete" title="Excluir item">🗑️</button>
        </div>
      `;

      card.querySelector('.btn-card-edit').addEventListener('click', (e) => {
        e.stopPropagation();
        editItem(item.id);
      });

      card.querySelector('.btn-card-delete').addEventListener('click', (e) => {
        e.stopPropagation();
        deleteItem(item.id);
      });

      card.addEventListener('click', () => editItem(item.id));

      elements.itemsList.appendChild(card);
    });
  }

  function editItem(id) {
    const isEdificios = state.activeTab === 'edificios';
    const list = isEdificios ? state.edificios : state.trabalhos;
    const item = list.find((i) => i.id === id);
    if (!item) return;

    if (isEdificios) {
      const form = elements.buildingForm;
      form.elements['editing_id'].value = item.id;
      form.elements['id'].value = item.id;
      form.elements['nome'].value = item.nome || '';
      form.elements['arquiteto'].value = item.arquiteto || '';
      form.elements['ano'].value = item.ano || '';
      if (form.elements['uso']) form.elements['uso'].value = item.uso || 'Residencial';
      if (form.elements['tipologia']) form.elements['tipologia'].value = item.tipologia || 'Multifamiliar';
      if (form.elements['logradouro']) form.elements['logradouro'].value = item.logradouro || '';
      if (form.elements['bairro']) form.elements['bairro'].value = item.bairro || '';
      if (form.elements['numero']) form.elements['numero'].value = item.numero || '';
      if (form.elements['endereco']) form.elements['endereco'].value = item.endereco || '';
      form.elements['lat'].value = item.lat ?? '';
      form.elements['lng'].value = item.lng ?? '';
      form.elements['imagem'].value = item.imagem || '';
      form.elements['fotos'].value = Array.isArray(item.fotos) ? item.fotos.join('\n') : '';
      form.elements['texto'].value = Array.isArray(item.texto) ? item.texto.join('\n\n') : (item.texto || '');

      populateProjetistas(item.projetistas || [], item.arquiteto || '');
      populateEtapas(item.etapas || [], item.temMultiplosProjetos || false);

      elements.buildingFormTitle.textContent = `Editar: ${item.nome}`;
      elements.buildingBadge.textContent = `ID: ${item.id}`;
    } else {
      const form = elements.academicForm;
      form.elements['editing_id'].value = item.id;
      form.elements['id'].value = item.id;
      form.elements['titulo'].value = item.titulo || '';
      form.elements['tipo'].value = item.tipo || 'Pesquisa';
      form.elements['subtitulo'].value = item.subtitulo || '';
      form.elements['ano'].value = item.ano || '';
      form.elements['status'].value = item.status || '';
      form.elements['participantes'].value = item.participantes || item.resumo || '';
      form.elements['pdf'].value = item.pdf || '';
      form.elements['capa'].value = item.capa || '';
      form.elements['imagens'].value = Array.isArray(item.imagens) ? item.imagens.join('\n') : '';
      form.elements['texto'].value = Array.isArray(item.texto) ? item.texto.join('\n\n') : (item.texto || '');

      elements.academicFormTitle.textContent = `Editar: ${item.titulo}`;
      elements.academicBadge.textContent = `ID: ${item.id}`;
    }

    renderSidebarList();
  }

  function deleteItem(id) {
    const isEdificios = state.activeTab === 'edificios';
    const list = isEdificios ? state.edificios : state.trabalhos;
    const item = list.find((i) => i.id === id);
    if (!item) return;

    const name = isEdificios ? item.nome : item.titulo;
    if (!confirm(`Tem certeza que deseja excluir "${name}"?`)) return;

    if (isEdificios) {
      state.edificios = state.edificios.filter((i) => i.id !== id);
      resetForm(elements.buildingForm);
    } else {
      state.trabalhos = state.trabalhos.filter((i) => i.id !== id);
      resetForm(elements.academicForm);
    }

    showToast(`Item "${name}" removido da lista local. Lembre-se de clicar em "Salvar Arquivo JSON" para aplicar permanentemente.`, 'success');
    renderSidebarList();
  }

  function setupProjetistasManager() {
    const btnAdd = document.getElementById('btn-add-projetista');
    if (!btnAdd) return;

    btnAdd.addEventListener('click', () => {
      addProjetistaRow();
    });
  }

  function addProjetistaRow(data = {}) {
    const container = document.getElementById('building-projetistas-list');
    if (!container) return;

    const row = document.createElement('div');
    row.className = 'projetista-item-row';
    row.style.cssText = 'display: flex; gap: 8px; align-items: center; margin-bottom: 8px;';

    const prefixVal = data.prefixo !== undefined ? data.prefixo : 'Arq.';
    const nomeVal = data.nome || '';

    row.innerHTML = `
      <select class="projetista-prefixo" style="padding: 6px 8px; border: 1px solid #ccc; border-radius: 3px; font-size: 13px;">
        <option value="Arq." ${prefixVal === 'Arq.' ? 'selected' : ''}>Arq. (Arquitetura)</option>
        <option value="Eng." ${prefixVal === 'Eng.' ? 'selected' : ''}>Eng. (Engenharia)</option>
        <option value="" ${prefixVal === '' ? 'selected' : ''}>Sem prefixo</option>
      </select>
      <input type="text" class="projetista-nome" value="${escapeHTML(nomeVal)}" placeholder="Nome do profissional (ex: Acácio Gil Borsoi)" style="flex: 1; padding: 6px; border: 1px solid #ccc; border-radius: 3px; font-size: 13px;">
      <button type="button" class="btn-remove-projetista" style="border: none; background: transparent; cursor: pointer; color: #cc0000; font-weight: bold;" title="Remover projetista">✕</button>
    `;

    row.querySelector('.btn-remove-projetista').addEventListener('click', () => {
      row.remove();
    });

    container.appendChild(row);
  }

  function getProjetistasFromDOM() {
    const rows = document.querySelectorAll('#building-projetistas-list .projetista-item-row');
    const projetistas = [];

    rows.forEach((row) => {
      const prefixo = row.querySelector('.projetista-prefixo')?.value || '';
      const nome = row.querySelector('.projetista-nome')?.value.trim() || '';

      if (nome) {
        projetistas.push({ prefixo, nome });
      }
    });

    return projetistas;
  }

  function formatProjetistasString(projetistas = [], fallbackStr = '') {
    if (Array.isArray(projetistas) && projetistas.length > 0) {
      return projetistas
        .map((p) => (p.prefixo ? `${p.prefixo} ${p.nome}` : p.nome))
        .join(', ');
    }
    return fallbackStr;
  }

  function populateProjetistas(projetistas = [], arquitetoStr = '') {
    const container = document.getElementById('building-projetistas-list');
    if (!container) return;
    container.innerHTML = '';

    if (Array.isArray(projetistas) && projetistas.length > 0) {
      projetistas.forEach((p) => addProjetistaRow(p));
    } else if (arquitetoStr && arquitetoStr.trim()) {
      const partes = arquitetoStr.split(/,\s*/);
      partes.forEach((parte) => {
        let prefixo = 'Arq.';
        let nome = parte;
        if (parte.startsWith('Eng.')) {
          prefixo = 'Eng.';
          nome = parte.replace(/^Eng\.\s*/, '');
        } else if (parte.startsWith('Arq.')) {
          prefixo = 'Arq.';
          nome = parte.replace(/^Arq\.\s*/, '');
        }
        addProjetistaRow({ prefixo, nome });
      });
    } else {
      addProjetistaRow({ prefixo: 'Arq.', nome: '' });
    }
  }

  function setupEtapasManager() {
    const chkMulti = document.getElementById('chk-multi-projetos');
    const etapasSection = document.getElementById('building-etapas-section');
    const etapasList = document.getElementById('building-etapas-list');
    const btnAddEtapa = document.getElementById('btn-add-etapa');

    if (!chkMulti || !etapasSection || !etapasList || !btnAddEtapa) return;

    chkMulti.addEventListener('change', () => {
      etapasSection.style.display = chkMulti.checked ? 'block' : 'none';
      if (chkMulti.checked && etapasList.children.length === 0) {
        addEtapaRow();
      }
    });

    btnAddEtapa.addEventListener('click', () => {
      addEtapaRow();
    });
  }

  function addEtapaRow(data = {}) {
    const container = document.getElementById('building-etapas-list');
    if (!container) return;

    const row = document.createElement('div');
    row.className = 'etapa-item-row';
    row.style.cssText = 'background: #f9f9f9; border: 1px solid #e0e0e0; border-radius: 4px; padding: 12px; margin-bottom: 10px; position: relative;';

    row.innerHTML = `
      <button type="button" class="btn-remove-etapa" style="position: absolute; top: 8px; right: 8px; border: none; background: transparent; cursor: pointer; color: #cc0000; font-weight: bold;" title="Remover etapa">✕</button>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 8px;">
        <label style="font-size: 12px; font-weight: 500;">
          Ano do projeto/evento *
          <input type="text" class="etapa-ano" value="${escapeHTML(data.ano || '')}" placeholder="Ex: 1912" style="width: 100%; margin-top: 4px; padding: 6px; border: 1px solid #ccc; border-radius: 3px;" required>
        </label>
        <label style="font-size: 12px; font-weight: 500;">
          Tipo de projeto *
          <input type="text" class="etapa-tipo" value="${escapeHTML(data.tipo || '')}" placeholder="Ex: reforma, revalidação, ampliação" style="width: 100%; margin-top: 4px; padding: 6px; border: 1px solid #ccc; border-radius: 3px;" required>
        </label>
      </div>
      <label style="font-size: 12px; font-weight: 500; display: block; margin-bottom: 8px;">
        Projetistas / Autores responsáveis
        <input type="text" class="etapa-projetistas" value="${escapeHTML(data.projetistas || '')}" placeholder="Ex: Eng. Manoel da Silva" style="width: 100%; margin-top: 4px; padding: 6px; border: 1px solid #ccc; border-radius: 3px;">
      </label>
      <label style="font-size: 12px; font-weight: 500; display: block;">
        Descrição / Observações da etapa
        <textarea class="etapa-descricao" rows="2" placeholder="Observações sobre o projeto..." style="width: 100%; margin-top: 4px; padding: 6px; border: 1px solid #ccc; border-radius: 3px;">${escapeHTML(data.descricao || '')}</textarea>
      </label>
    `;

    row.querySelector('.btn-remove-etapa').addEventListener('click', () => {
      row.remove();
    });

    container.appendChild(row);
  }

  function getEtapasFromDOM() {
    const chkMulti = document.getElementById('chk-multi-projetos');
    if (!chkMulti || !chkMulti.checked) return [];

    const rows = document.querySelectorAll('#building-etapas-list .etapa-item-row');
    const etapas = [];

    rows.forEach((row) => {
      const ano = row.querySelector('.etapa-ano')?.value.trim();
      const tipo = row.querySelector('.etapa-tipo')?.value.trim();
      const projetistas = row.querySelector('.etapa-projetistas')?.value.trim();
      const descricao = row.querySelector('.etapa-descricao')?.value.trim();

      if (ano || tipo) {
        etapas.push({ ano, tipo, projetistas, descricao });
      }
    });

    return etapas;
  }

  function populateEtapas(etapas = [], temMultiplos = false) {
    const chkMulti = document.getElementById('chk-multi-projetos');
    const etapasSection = document.getElementById('building-etapas-section');
    const container = document.getElementById('building-etapas-list');

    if (!chkMulti || !etapasSection || !container) return;

    container.innerHTML = '';
    const active = temMultiplos || (Array.isArray(etapas) && etapas.length > 0);
    chkMulti.checked = active;
    etapasSection.style.display = active ? 'block' : 'none';

    if (Array.isArray(etapas) && etapas.length > 0) {
      etapas.forEach((etapa) => addEtapaRow(etapa));
    }
  }

  function setupAutosaveDraft() {
    const DRAFT_KEY = 'guia_admin_draft';

    const saveDraft = () => {
      const draft = {
        timestamp: Date.now(),
        tab: state.activeTab,
        building: {
          editing_id: elements.buildingForm?.elements['editing_id']?.value || '',
          id: elements.buildingForm?.elements['id']?.value || '',
          nome: elements.buildingForm?.elements['nome']?.value || '',
          arquiteto: elements.buildingForm?.elements['arquiteto']?.value || '',
          ano: elements.buildingForm?.elements['ano']?.value || '',
          endereco: elements.buildingForm?.elements['endereco']?.value || '',
          lat: elements.buildingForm?.elements['lat']?.value || '',
          lng: elements.buildingForm?.elements['lng']?.value || '',
          imagem: elements.buildingForm?.elements['imagem']?.value || '',
          fotos: elements.buildingForm?.elements['fotos']?.value || '',
          texto: elements.buildingForm?.elements['texto']?.value || '',
          temMultiplosProjetos: document.getElementById('chk-multi-projetos')?.checked || false,
          etapas: getEtapasFromDOM()
        }
      };
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    };

    elements.buildingForm?.addEventListener('input', saveDraft);
    elements.buildingForm?.addEventListener('change', saveDraft);
    elements.academicForm?.addEventListener('input', saveDraft);
    elements.academicForm?.addEventListener('change', saveDraft);
  }

  function resetForm(form) {
    if (!form) return;
    form.reset();
    if (form.elements['editing_id']) form.elements['editing_id'].value = '';

    if (form === elements.buildingForm) {
      populateProjetistas([], '');
      populateEtapas([], false);
      elements.buildingFormTitle.textContent = 'Novo Edifício';
      elements.buildingBadge.textContent = 'ID: novo';
    } else if (form === elements.academicForm) {
      elements.academicFormTitle.textContent = 'Novo Trabalho Acadêmico';
      elements.academicBadge.textContent = 'ID: novo';
    }

    renderSidebarList();
  }

  function setupForms() {
    const logradouroInput = document.getElementById('building-logradouro-input');
    const bairroSelect = document.getElementById('building-bairro-select');
    const datalist = document.getElementById('logradouros-datalist');

    if (logradouroInput && bairroSelect && datalist) {
      const knownStreets = Array.from(datalist.options).map((opt) => opt.value);
      const soledadeStreets = [
        'Avenida Oliveira Lima',
        'Praça Oswaldo Cruz',
        'Rua Adhelmar de Oliveira',
        'Rua Estudante',
        'Rua Nunes Machado'
      ].map((s) => s.toLowerCase());

      logradouroInput.addEventListener('input', () => {
        const val = logradouroInput.value.trim().toLowerCase();
        if (!val) return;

        if (soledadeStreets.includes(val)) {
          bairroSelect.value = 'Soledade';
        } else if (knownStreets.some((s) => s.toLowerCase() === val)) {
          bairroSelect.value = 'Boa Vista';
        }
      });
    }

    // Auto-generate ID on title input
    elements.buildingForm?.elements['nome']?.addEventListener('input', (e) => {
      if (!elements.buildingForm.elements['editing_id'].value) {
        elements.buildingForm.elements['id'].value = slugify(e.target.value);
      }
    });

    elements.academicForm?.elements['titulo']?.addEventListener('input', (e) => {
      if (!elements.academicForm.elements['editing_id'].value) {
        elements.academicForm.elements['id'].value = slugify(e.target.value);
      }
    });

    // Building form submit
    elements.buildingForm?.addEventListener('submit', (e) => {
      e.preventDefault();
      saveBuildingFromForm();
    });

    // Academic form submit
    elements.academicForm?.addEventListener('submit', (e) => {
      e.preventDefault();
      saveAcademicFromForm();
    });

    // Carousel form submit
    elements.carouselForm?.addEventListener('submit', (e) => {
      e.preventDefault();
      saveCarouselFromForm();
    });

    // Cancel buttons
    elements.btnCancelBuilding?.addEventListener('click', () => resetForm(elements.buildingForm));
    elements.btnCancelAcademic?.addEventListener('click', () => resetForm(elements.academicForm));

    // Search bar
    elements.searchInput?.addEventListener('input', (e) => {
      state.searchQuery = e.target.value;
      renderSidebarList();
    });

    // Add new button
    elements.btnAddNew?.addEventListener('click', () => {
      const activeForm = state.activeTab === 'edificios' ? elements.buildingForm : elements.academicForm;
      resetForm(activeForm);
    });

    // Setup drag and drop for file inputs
    setupFileDropZones(elements.buildingForm);
    setupFileDropZones(elements.academicForm);
    setupFileDropZones(elements.carouselForm);
  }

  function setupFileDropZones(form) {
    if (!form) return;
    form.querySelectorAll('input[type="file"][data-path-target]').forEach((input) => {
      const targetName = input.dataset.pathTarget;
      const basePath = input.dataset.basePath || '';
      const zone = form.querySelector(`[data-for="${input.name}"]`);

      function updateTarget() {
        const files = Array.from(input.files || []);
        if (!files.length) return;

        const targetField = form.elements[targetName];
        if (!targetField) return;

        const paths = files.map((file) => `${basePath.replace(/\/+$/, '')}/${file.name}`);

        if (targetField.tagName === 'TEXTAREA') {
          const current = targetField.value.trim();
          targetField.value = current ? `${current}\n${paths.join('\n')}` : paths.join('\n');
        } else {
          targetField.value = paths[0];
        }
      }

      input.addEventListener('change', updateTarget);

      if (zone) {
        zone.addEventListener('click', () => input.click());
        ['dragenter', 'dragover'].forEach((evt) => {
          zone.addEventListener(evt, (e) => {
            e.preventDefault();
            zone.classList.add('is-dragging');
          });
        });
        ['dragleave', 'drop'].forEach((evt) => {
          zone.addEventListener(evt, (e) => {
            e.preventDefault();
            zone.classList.remove('is-dragging');
          });
        });
        zone.addEventListener('drop', (e) => {
          if (e.dataTransfer?.files?.length) {
            input.files = e.dataTransfer.files;
            updateTarget();
          }
        });
      }
    });
  }

  function splitParagraphs(val) {
    return String(val || '')
      .split(/\n\s*\n/)
      .map((p) => p.trim().replace(/\n/g, ' '))
      .filter(Boolean);
  }

  function splitLines(val) {
    return String(val || '')
      .split(/\n+/)
      .map((l) => l.trim())
      .filter(Boolean);
  }

  function parseNumber(val) {
    const norm = String(val || '').trim().replace(',', '.');
    if (!norm) return undefined;
    const num = Number(norm);
    return Number.isFinite(num) ? num : norm;
  }

  function saveBuildingFromForm() {
    const form = elements.buildingForm;
    const editingId = form.elements['editing_id'].value;
    const nome = form.elements['nome'].value.trim();
    const id = slugify(form.elements['id'].value || nome);

    const logradouro = form.elements['logradouro']?.value?.trim() || '';
    const bairro = form.elements['bairro']?.value?.trim() || 'Boa Vista';
    const numero = form.elements['numero']?.value?.trim() || '';
    const uso = form.elements['uso']?.value?.trim() || 'Residencial';
    const tipologia = form.elements['tipologia']?.value?.trim() || 'Multifamiliar';
    const fullAddress = logradouro && numero ? `${logradouro}, ${numero} - Recife - PE` : (form.elements['endereco']?.value?.trim() || '');

    const projetistas = getProjetistasFromDOM();
    const arquitetoFormatted = formatProjetistasString(projetistas, form.elements['arquiteto']?.value?.trim() || '');

    const temMultiplosProjetos = document.getElementById('chk-multi-projetos')?.checked || false;
    const etapas = getEtapasFromDOM();

    const newItem = {
      id,
      nome,
      logradouro,
      bairro,
      numero,
      uso,
      tipologia,
      endereco: fullAddress,
      arquiteto: arquitetoFormatted,
      projetistas,
      ano: form.elements['ano'].value.trim(),
      lat: parseNumber(form.elements['lat'].value),
      lng: parseNumber(form.elements['lng'].value),
      pagina: `edificio.html?id=${id}`,
      imagem: form.elements['imagem'].value.trim(),
      texto: splitParagraphs(form.elements['texto'].value),
      fotos: splitLines(form.elements['fotos'].value),
      temMultiplosProjetos,
      etapas
    };

    if (editingId) {
      const idx = state.edificios.findIndex((i) => i.id === editingId);
      if (idx !== -1) state.edificios[idx] = newItem;
      else state.edificios.push(newItem);
    } else {
      state.edificios.push(newItem);
    }

    showToast(`Edifício "${nome}" salvo na lista! Clique em "Salvar Arquivo JSON" para atualizar data/edificios.json.`, 'success');
    editItem(id);
  }

  function saveAcademicFromForm() {
    const form = elements.academicForm;
    const editingId = form.elements['editing_id'].value;
    const titulo = form.elements['titulo'].value.trim();
    const id = slugify(form.elements['id'].value || titulo);
    const participantes = form.elements['participantes'].value.trim();

    const newItem = {
      id,
      tipo: form.elements['tipo'].value.trim() || 'Pesquisa',
      titulo,
      subtitulo: form.elements['subtitulo'].value.trim(),
      ano: form.elements['ano'].value.trim(),
      status: form.elements['status'].value.trim(),
      capa: form.elements['capa'].value.trim(),
      participantes,
      resumo: participantes,
      texto: splitParagraphs(form.elements['texto'].value),
      imagens: splitLines(form.elements['imagens'].value),
      pdf: form.elements['pdf'].value.trim()
    };

    if (editingId) {
      const idx = state.trabalhos.findIndex((i) => i.id === editingId);
      if (idx !== -1) state.trabalhos[idx] = newItem;
      else state.trabalhos.push(newItem);
    } else {
      state.trabalhos.push(newItem);
    }

    showToast(`Trabalho "${titulo}" salvo na lista! Clique em "Salvar Arquivo JSON" para atualizar data/trabalhos.json.`, 'success');
    editItem(id);
  }

  function saveCarouselFromForm() {
    const form = elements.carouselForm;
    const val = form.elements['carrosselImagens'].value;
    const lines = splitLines(val);
    state.carrossel = lines;

    showToast(`Lista de ${lines.length} imagem(ns) do carrossel atualizada! Clique em "Salvar Arquivo JSON" para gerar data/carrossel.json.`, 'success');
    renderSidebarList();
  }

  function setupGlobalActions() {
    elements.btnSaveFile?.addEventListener('click', async () => {
      let fileName = 'edificios.json';
      let dataList = state.edificios;

      if (state.activeTab === 'trabalhos') {
        fileName = 'trabalhos.json';
        dataList = state.trabalhos;
      } else if (state.activeTab === 'carrossel') {
        fileName = 'carrossel.json';
        dataList = state.carrossel;
      }

      const jsonContent = JSON.stringify(dataList, null, 2);

      if ('showSaveFilePicker' in window) {
        try {
          const handle = await window.showSaveFilePicker({
            suggestedName: fileName,
            types: [
              {
                description: 'JSON Files',
                accept: { 'application/json': ['.json'] }
              }
            ]
          });
          const writable = await handle.createWritable();
          await writable.write(jsonContent);
          await writable.close();
          showToast(`✅ Arquivo ${fileName} salvo com sucesso!`, 'success');
          return;
        } catch (err) {
          if (err.name === 'AbortError') return;
        }
      }

      const blob = new Blob([jsonContent], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      showToast(`📥 Arquivo ${fileName} baixado! Substitua na pasta data/ do seu projeto.`, 'success');
    });

    elements.btnImportFile?.addEventListener('click', () => {
      elements.importFileInput?.click();
    });

    elements.importFileInput?.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const parsed = JSON.parse(event.target.result);
          if (!Array.isArray(parsed)) throw new Error('O arquivo JSON deve conter uma lista (array).');

          if (state.activeTab === 'edificios') {
            state.edificios = parsed;
            showToast(`✅ ${parsed.length} edifícios importados!`, 'success');
          } else if (state.activeTab === 'trabalhos') {
            state.trabalhos = parsed;
            showToast(`✅ ${parsed.length} trabalhos importados!`, 'success');
          } else {
            state.carrossel = parsed;
            elements.carouselForm.elements['carrosselImagens'].value = parsed.join('\n');
            showToast(`✅ ${parsed.length} imagens do carrossel importadas!`, 'success');
          }
          renderSidebarList();
        } catch (err) {
          showToast(`Erro ao importar JSON: ${err.message}`, 'error');
        }
      };
      reader.readAsText(file);
      e.target.value = '';
    });
  }

  function escapeHTML(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
})();
