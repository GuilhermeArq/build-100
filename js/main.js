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
      const meta = await nativeFetch(new URL('meta.json', baseUrl)).then((r) => {
        if (!r.ok) throw new Error('Metadados do catálogo de edifícios não encontrados');
        return r.json();
      });
      const arquivos = ['01.json','02.json','03.json','04.json','05.json','06.json','07.json'];
      const partes = await Promise.all(arquivos.map((arquivo) => nativeFetch(new URL(arquivo, baseUrl)).then((r) => {
        if (!r.ok) throw new Error(`Parte ${arquivo} do catálogo não encontrada`);
        return r.json();
      })));
      const registros = partes.flat();
      const contagem = new Map();
      const ids = new Set();

      return registros.map((registro) => {
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
        const projetistas = parseProjetistas(projetistasTexto);

        return {
          id,
          nome,
          logradouro,
          numero,
          bairro,
          endereco,
          lat,
          lng,
          projetistas,
          arquiteto: projetistasTexto || '',
          ano: 's.d.',
          uso: 'Não informado',
          tipologia: 'Não informado',
          status: 'NÃO INFORMADO',
          fonte: fonte || '',
          imagem: '',
          fotos: [],
          texto: [],
          etapas: [],
          quantidadeImagensOriginais: quantidadeImagensOriginais || 1,
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
      return new Response(JSON.stringify(edificios), {
        status: 200,
        headers: { 'Content-Type': 'application/json; charset=utf-8' }
      });
    }
    return nativeFetch(input, init);
  };

  const current = document.currentScript;
  const coreSrc = current && current.src ? current.src.replace(/main\.js(?:\?.*)?$/i, 'main-core.js') : 'js/main-core.js';
  if (document.readyState === 'loading') {
    document.write(`<script src="${coreSrc}"><\/script>`);
  } else {
    const script = document.createElement('script');
    script.src = coreSrc;
    document.body.appendChild(script);
  }
})();
