(function () {
  const nativeFetch = window.fetch.bind(window);
  let edificiosPromise = null;

  function slugify(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  function parseProjetistas(texto) {
    if (!texto) return [];
    return String(texto).split(';').map((parte) => parte.trim()).filter(Boolean).map((parte) => {
      if (/^Eng\.\s+/i.test(parte)) return { prefixo: 'Eng.', nome: parte.replace(/^Eng\.\s+/i, '') };
      if (/^Arq\.\s+/i.test(parte)) return { prefixo: 'Arq.', nome: parte.replace(/^Arq\.\s+/i, '') };
      return { prefixo: '', nome: parte };
    });
  }

  async function carregarCatalogo(requestUrl) {
    if (edificiosPromise) return edificiosPromise;
    edificiosPromise = (async () => {
      const baseUrl = new URL('./catalogo/', requestUrl);
      const meta = await nativeFetch(new URL('meta.json', baseUrl)).then((r) => r.json());
      const arquivos = ['01.json','02.json','03.json','04.json','05.json','06.json','07.json'];
      const partes = await Promise.all(arquivos.map((arquivo) => nativeFetch(new URL(arquivo, baseUrl)).then((r) => r.json())));
      const contagem = new Map();
      const ids = new Set();

      return partes.flat().map((registro) => {
        const [ruaIndex, numero, nomeOriginal, lat, lng, projetistasTexto, fonte, quantidadeImagensOriginais] = registro;
        const [logradouro, bairro] = meta.streets[ruaIndex];
        const endereco = [logradouro, numero].filter(Boolean).join(', ');
        const nome = nomeOriginal || endereco || 'Edificação sem denominação';
        const baseId = slugify(`${logradouro}-${numero}`) || 'edificacao';
        const ocorrencia = (contagem.get(baseId) || 0) + 1;
        contagem.set(baseId, ocorrencia);
        let id = baseId;
        if (ocorrencia > 1) {
          const sufixo = slugify(nomeOriginal || '').slice(0, 32);
          id = sufixo ? `${baseId}-${sufixo}` : `${baseId}-${ocorrencia}`;
          let n = ocorrencia;
          while (ids.has(id)) id = `${baseId}-${sufixo || 'registro'}-${++n}`;
        }
        ids.add(id);
        const quantidadeImagens = Math.max(1, Number(quantidadeImagensOriginais) || 1);
        const imagem = `midia/edificios/catalogo/${id}-01.jpg`;
        const fotos = Array.from({ length: Math.max(0, quantidadeImagens - 1) }, (_, index) =>
          `midia/edificios/catalogo/${id}-${String(index + 2).padStart(2, '0')}.jpg`
        );
        return {
          id,
          nome,
          logradouro,
          numero,
          bairro,
          endereco,
          lat,
          lng,
          projetistas: parseProjetistas(projetistasTexto),
          arquiteto: projetistasTexto || '',
          ano: 's.d.',
          uso: 'Não informado',
          tipologia: 'Não informado',
          status: 'NÃO INFORMADO',
          fonte: fonte || '',
          imagem,
          fotos,
          texto: [],
          etapas: [],
          quantidadeImagensOriginais: quantidadeImagens,
          pagina: `edificio.html?id=${encodeURIComponent(id)}`
        };
      });
    })();
    return edificiosPromise;
  }

  window.fetch = async function (input, init) {
    let url;
    try {
      url = new URL(input instanceof Request ? input.url : String(input), document.baseURI);
    } catch (_) {
      return nativeFetch(input, init);
    }
    if (/\/data\/edificios\.json$/i.test(url.pathname)) {
      const edificios = await carregarCatalogo(url);
      return new Response(JSON.stringify(edificios), { status: 200, headers: { 'Content-Type': 'application/json; charset=utf-8' } });
    }
    return nativeFetch(input, init);
  };

  document.addEventListener('DOMContentLoaded', () => {
    const selects = [
      document.getElementById('building-uso-select'),
      document.getElementById('building-tipologia-select')
    ];
    selects.forEach((select) => {
      if (!select) return;
      let option = Array.from(select.options).find((item) => item.value === 'Não informado');
      if (!option) {
        option = new Option('Não informado', 'Não informado', true, true);
        select.insertBefore(option, select.firstChild);
      }
      option.defaultSelected = true;
      select.value = 'Não informado';
    });

    const button = document.getElementById('btn-save-file');
    if (button) button.title = 'Exporta uma cópia de trabalho. O catálogo publicado é mantido em data/catalogo/.';

    const header = document.querySelector('.admin-header-section .admin-header-top > div:first-child');
    if (header && !document.getElementById('catalogo-admin-note')) {
      const note = document.createElement('p');
      note.id = 'catalogo-admin-note';
      note.className = 'admin-help';
      note.textContent = 'Os edifícios são carregados da base estruturada data/catalogo/. A exportação JSON é uma cópia de trabalho; o catálogo publicado não é sobrescrito por este botão.';
      header.appendChild(note);
    }
  });

  const current = document.currentScript;
  const coreSrc = current && current.src ? current.src.replace(/admin\.js(?:\?.*)?$/i, 'admin-core.js') : 'js/admin-core.js';
  if (document.readyState === 'loading') {
    document.write(`<script src="${coreSrc}"><\/script>`);
  } else {
    const script = document.createElement('script');
    script.src = coreSrc;
    document.body.appendChild(script);
  }
})();
