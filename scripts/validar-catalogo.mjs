import { readFile } from 'node:fs/promises';

const root = new URL('../data/catalogo/', import.meta.url);
const meta = JSON.parse(await readFile(new URL('meta.json', root), 'utf8'));
const arquivos = ['01.json','02.json','03.json','04.json','05.json','06.json','07.json'];
const partes = await Promise.all(arquivos.map((nome) => readFile(new URL(nome, root), 'utf8').then(JSON.parse)));
const registros = partes.flat();

const erros = [];
const avisos = [];
const pares = new Map();

registros.forEach((registro, i) => {
  const [ruaIndex, numero, nome, lat, lng, projetistas, fonte, qtdImagens] = registro;
  const pos = i + 1;
  if (!Number.isInteger(ruaIndex) || !meta.streets[ruaIndex]) erros.push(`#${pos}: índice de logradouro inválido`);
  if (!numero) avisos.push(`#${pos}: número não informado`);
  if (!Number.isFinite(Number(lat)) || !Number.isFinite(Number(lng))) erros.push(`#${pos}: coordenadas inválidas`);
  if (Number(lat) < -8.2 || Number(lat) > -7.9 || Number(lng) < -35.1 || Number(lng) > -34.7) avisos.push(`#${pos}: coordenadas fora da área esperada do Recife`);
  if (!Number.isInteger(qtdImagens) || qtdImagens < 1) avisos.push(`#${pos}: quantidade de imagens original inválida`);

  const rua = meta.streets[ruaIndex]?.[0] || '';
  const chave = `${rua}|${numero}|${nome || ''}|${projetistas || ''}`.toLowerCase();
  if (pares.has(chave)) avisos.push(`#${pos}: possível duplicata de #${pares.get(chave)}`);
  else pares.set(chave, pos);

  void fonte;
});

if (registros.length !== 302) erros.push(`esperados 302 registros; encontrados ${registros.length}`);

console.log(`Catálogo: ${registros.length} registros, ${meta.streets.length} referências de logradouro.`);
console.log(`Erros: ${erros.length} | Avisos: ${avisos.length}`);
erros.forEach((e) => console.error(`ERRO: ${e}`));
avisos.forEach((a) => console.warn(`AVISO: ${a}`));
if (erros.length) process.exitCode = 1;
