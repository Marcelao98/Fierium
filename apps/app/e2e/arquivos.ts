// Arquivos gerados pelos testes (nunca commitar PDF/EPUB de verdade): um PDF de N páginas e um EPUB de 3 capítulos.
import { crc32 } from 'node:zlib';

/** Escreve um PDF simples à mão: cada página com o texto "Página N" (sem acento, fonte Helvetica). */
export function gerarPdf(n: number): Buffer {
  const objs: string[] = [];
  objs[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  const kids = Array.from({ length: n }, (_, i) => `${4 + i * 2} 0 R`).join(' ');
  objs[2] = `<< /Type /Pages /Kids [${kids}] /Count ${n} >>`;
  objs[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';
  for (let i = 0; i < n; i++) {
    const conteudo = `BT /F1 48 Tf 72 700 Td (Pagina ${i + 1}) Tj ET`;
    objs[4 + i * 2] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${5 + i * 2} 0 R >>`;
    objs[5 + i * 2] = `<< /Length ${conteudo.length} >>\nstream\n${conteudo}\nendstream`;
  }
  // enchimento (300 KB) pra o arquivo passar do tamanho do pedaço e o pdf.js usar Range de verdade
  const enchimento = 'x'.repeat(300_000);
  objs[4 + n * 2] = `<< /Length ${enchimento.length} >>\nstream\n${enchimento}\nendstream`;
  let saida = '%PDF-1.4\n';
  const offsets: number[] = [];
  for (let i = 1; i < objs.length; i++) {
    offsets[i] = saida.length;
    saida += `${i} 0 obj\n${objs[i]}\nendobj\n`;
  }
  const xref = saida.length;
  saida += `xref\n0 ${objs.length}\n0000000000 65535 f \n`;
  for (let i = 1; i < objs.length; i++) saida += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  saida += `trailer\n<< /Size ${objs.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(saida, 'latin1');
}

/** Zip "stored" (sem compressão) feito à mão: o bastante pro EPUB (o mimetype tem de ser o primeiro, sem compressão). */
function zip(arquivos: [string, string][]): Buffer {
  const partes: Buffer[] = [];
  const central: Buffer[] = [];
  let deslocamento = 0;
  for (const [nome, texto] of arquivos) {
    const n = Buffer.from(nome);
    const d = Buffer.from(texto);
    const crc = crc32(d);
    const h = Buffer.alloc(30);
    h.writeUInt32LE(0x04034b50, 0);
    h.writeUInt16LE(20, 4);
    h.writeUInt32LE(crc, 14);
    h.writeUInt32LE(d.length, 18);
    h.writeUInt32LE(d.length, 22);
    h.writeUInt16LE(n.length, 26);
    partes.push(h, n, d);
    const c = Buffer.alloc(46);
    c.writeUInt32LE(0x02014b50, 0);
    c.writeUInt16LE(20, 4);
    c.writeUInt16LE(20, 6);
    c.writeUInt32LE(crc, 16);
    c.writeUInt32LE(d.length, 20);
    c.writeUInt32LE(d.length, 24);
    c.writeUInt16LE(n.length, 28);
    c.writeUInt32LE(deslocamento, 42);
    central.push(c, n);
    deslocamento += h.length + n.length + d.length;
  }
  const tamCentral = central.reduce((s, b) => s + b.length, 0);
  const fim = Buffer.alloc(22);
  fim.writeUInt32LE(0x06054b50, 0);
  fim.writeUInt16LE(arquivos.length, 8);
  fim.writeUInt16LE(arquivos.length, 10);
  fim.writeUInt32LE(tamCentral, 12);
  fim.writeUInt32LE(deslocamento, 16);
  return Buffer.concat([...partes, ...central, fim]);
}

export function epubDeTeste(): Buffer {
  const cap = (n: number) =>
    `<?xml version="1.0" encoding="utf-8"?><html xmlns="http://www.w3.org/1999/xhtml"><head><title>Capítulo ${n}</title></head><body><h1>Capítulo ${n}</h1>${Array.from(
      { length: 40 },
      (_, i) => `<p>Parágrafo ${i + 1} do capítulo ${n}: o dragão dormia sobre o ouro da montanha.</p>`,
    ).join('')}</body></html>`;
  return zip([
    ['mimetype', 'application/epub+zip'],
    [
      'META-INF/container.xml',
      '<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>',
    ],
    [
      'OEBPS/content.opf',
      `<?xml version="1.0"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="id"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="id">teste-1</dc:identifier><dc:title>Livro de Teste</dc:title><dc:language>pt-BR</dc:language><meta property="dcterms:modified">2026-01-01T00:00:00Z</meta></metadata><manifest><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>${[1, 2, 3].map((n) => `<item id="c${n}" href="c${n}.xhtml" media-type="application/xhtml+xml"/>`).join('')}</manifest><spine>${[1, 2, 3].map((n) => `<itemref idref="c${n}"/>`).join('')}</spine></package>`,
    ],
    [
      'OEBPS/nav.xhtml',
      '<?xml version="1.0"?><html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><head><title>Sumário</title></head><body><nav epub:type="toc"><ol><li><a href="c1.xhtml">Capítulo 1</a></li><li><a href="c2.xhtml">Capítulo 2</a></li><li><a href="c3.xhtml">Capítulo 3</a></li></ol></nav></body></html>',
    ],
    ['OEBPS/c1.xhtml', cap(1)],
    ['OEBPS/c2.xhtml', cap(2)],
    ['OEBPS/c3.xhtml', cap(3)],
  ]);
}
