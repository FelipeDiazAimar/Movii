# -*- coding: utf-8 -*-
"""Genera el PDF del documento final integrado con el formato del equipo
(carta, portada ilustrada, indice con numeros de pagina, encabezado UTN y pie
"Pagina X de Y").

Uso:  python generar_pdf.py
Requiere: python 'markdown' + 'pymupdf' y Google Chrome (o Edge) instalado.
"""
import html
import os
import re
import subprocess
import tempfile

import markdown
import pymupdf

AQUI = os.path.dirname(os.path.abspath(__file__))
FUENTE = os.path.join(AQUI, "..", "Sprint3 - Araya_Diaz-Aimar_Micheloud integrado.md")
SALIDA = os.path.join(AQUI, "..", "Sprint3 - Araya_Diaz-Aimar_Micheloud.pdf")
CHROME = next(p for p in (r"C:\Program Files\Google\Chrome\Application\chrome.exe",
                          r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe") if os.path.exists(p))


def uri(p):
    return "file:///" + os.path.abspath(p).replace("\\", "/")


CSS = """
@page { size: 8.5in 11in; margin: 86pt 38pt 60pt 38pt;
  @top-left { content: url(\"LOGO\"); vertical-align: top; padding-top: 22pt; }
  @top-right { content: "Ingeniería en Sistemas de Información\\A Ingeniería y Calidad de Software\\A Año: 2026"; white-space: pre-line;
               text-align: right; font: 12pt Arial, Helvetica, sans-serif; color: #000; vertical-align: top; margin-top: 18pt; line-height: 1.15; }
  @bottom-center { content: "Página " counter(page) " de " counter(pages); font: 12pt 'Times New Roman', serif; color: #000; }
}
@page portada { margin: 38pt; @top-left { content: none; } @top-right { content: none; } @bottom-center { content: none; } }
html { font-family: 'Times New Roman', Times, serif; color: #1e293b; font-size: 10.6pt; line-height: 1.38; }
body { margin: 0; }
.portada { page: portada; page-break-after: always; text-align: center; }
.portada .inst { text-align: left; font: 12pt Arial, Helvetica, sans-serif; color: #000; line-height: 1.15; }
.portada h1.t { font-size: 28pt; font-weight: normal; color: #000; margin: 26pt 0 10pt; border: 0; padding: 0; page-break-before: avoid; }
.portada .s { font-size: 22pt; font-weight: bold; color: #000; margin: 6pt 0 8pt; }
.portada .i { font-size: 14pt; font-style: italic; color: #000; margin-bottom: 14pt; }
.portada img { width: 335pt; margin: 6pt auto 26pt; }
.portada .eq { text-align: left; font-size: 12pt; color: #000; }
.portada .eq b { display: block; margin-top: 4pt; }
.portada .eq span { display: block; margin-left: 28pt; }
.indice { page-break-after: always; }
.indice h1 { page-break-before: avoid; }
.indice .e { display: flex; align-items: baseline; color: #0f172a; }
.indice .e .pt { flex: 1 1 auto; border-bottom: 1px dotted #475569; margin: 0 3pt; min-width: 12pt; }
.indice .e .n { flex: 0 0 auto; }
.indice .l1 { font-size: 11.5pt; margin-top: 4pt; line-height: 1.4; }
.indice .l2 { margin-left: 8pt; font-size: 9.6pt; line-height: 1.3; }
.indice .l3 { margin-left: 22pt; font-size: 9pt; line-height: 1.25; }
h1 { font-size: 20pt; color: #0f172a; border-bottom: 2.2pt solid #2b7bbf; padding-bottom: 3pt; margin: 0 0 10pt; page-break-before: always; }
h2 { font-size: 14pt; color: #0f172a; margin: 14pt 0 5pt; page-break-after: avoid; }
h3 { font-size: 12pt; color: #0f172a; margin: 11pt 0 4pt; page-break-after: avoid; }
p { margin: 0 0 6pt; }
ul, ol { margin: 0 0 6pt; padding-left: 20pt; }
li { margin-bottom: 2pt; }
hr { border: 0; border-top: 1px solid #e2e8f0; margin: 8pt 0; }
code { font-family: Consolas, 'Courier New', monospace; font-size: 9pt; background: #f1f5f9; padding: 0 2pt; border-radius: 2pt; }
pre { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 3pt; padding: 6pt 8pt; font-size: 8pt; line-height: 1.3; white-space: pre-wrap; word-break: break-word; page-break-inside: avoid; margin: 4pt 0 8pt; }
pre code { background: none; padding: 0; font-size: 8pt; }
blockquote { margin: 6pt 0 8pt; padding: 6pt 10pt; background: #f1f5f9; border-left: 3pt solid #2b7bbf; page-break-inside: avoid; }
blockquote p { margin: 0 0 3pt; }
table { width: 100%; border-collapse: collapse; margin: 5pt 0 9pt; font-size: 9.6pt; line-height: 1.25; }
thead { display: table-header-group; }
tr { page-break-inside: avoid; }
th { background: #e8eef7; color: #0f172a; font-weight: bold; padding: 6pt 7pt; text-align: left; border-bottom: 1px solid #cbd5e1; }
td { padding: 6pt 7pt; border-bottom: 1px solid #e2e8f0; vertical-align: middle; }
tbody tr:nth-child(even) td { background: #fafbfd; }
td:first-child { font-weight: bold; }
img { max-width: 100%; display: block; margin: 6pt auto; page-break-inside: avoid; }
em { color: #334155; }
"""


def construir_html(cuerpo_md, toc_paginas):
    md = markdown.Markdown(extensions=["tables", "fenced_code", "sane_lists"])
    cuerpo = md.convert(cuerpo_md)
    base = os.path.abspath(os.path.join(AQUI, ".."))
    cuerpo = re.sub(r'src="(?!file:|http)([^"]+)"', lambda m: 'src="%s"' % uri(os.path.join(base, m.group(1))), cuerpo)

    entradas = []

    def marca(m):
        nivel, texto = int(m.group(1)), m.group(2)
        plano = html.unescape(re.sub(r"<[^>]+>", "", texto)).strip()
        entradas.append((nivel, plano))
        return m.group(0)

    re.sub(r"<h([1-3])>(.*?)</h\1>", marca, cuerpo)
    filas = []
    for i, (nivel, texto) in enumerate(entradas):
        n = toc_paginas.get(i, "00")
        filas.append('<div class="e l%d"><span class="tx">%s</span><span class="pt"></span><span class="n">%s</span></div>'
                     % (nivel, html.escape(texto), n))
    portada = (
        '<div class="portada">'
        '<div class="inst">Ingeniería en Sistemas de Información<br>Ingeniería y Calidad de Software<br>Año: 2026</div>'
        '<h1 class="t">Sistema de Gestión de Envíos y Distribución</h1>'
        '<div class="s">Trabajo Práctico Integrador - Sprint 3</div>'
        '<div class="i">Documento final integrado · Sprints 1, 2 y 3 (HU-01 a HU-19)</div>'
        '<img src="%s">'
        '<div class="eq"><b>Docentes:</b><span>Gandino, Diego</span><span>Saldarini, Javier Daniel</span>'
        '<b>Grupo N° 7:</b><span>Araya, Ulises</span><span>Díaz Aimar, Felipe</span><span>Micheloud, Jeremías</span></div>'
        '</div>'
        '<div class="indice"><h1>Índice</h1><div style="font-size:14pt;margin:6pt 0 4pt">Contenido</div>%s</div>'
    ) % (uri(os.path.join(AQUI, "cover.png")), "".join(filas))
    css = CSS.replace("LOGO", uri(os.path.join(AQUI, "logo.png")).replace(" ", "%20"))
    doc = ("<!doctype html><html><head><meta charset='utf-8'><title>Trabajo Práctico Integrador - Sprint 3</title>"
           "<style>%s</style></head><body>%s%s</body></html>") % (css, portada, cuerpo)
    return doc, entradas


def a_pdf(html_txt, destino):
    with tempfile.NamedTemporaryFile("w", suffix=".html", delete=False, encoding="utf-8") as f:
        f.write(html_txt)
        ruta = f.name
    try:
        subprocess.run([CHROME, "--headless=new", "--disable-gpu", "--no-pdf-header-footer", "--allow-file-access-from-files",
                        "--run-all-compositor-stages-before-draw", "--virtual-time-budget=20000",
                        "--print-to-pdf=" + os.path.abspath(destino), uri(ruta)],
                       check=True, capture_output=True, timeout=300)
    finally:
        os.unlink(ruta)


def paginas_de(pdf, entradas, primera_pagina):
    doc = pymupdf.open(pdf)
    res = {}
    cursor = primera_pagina
    for i, (nivel, texto) in enumerate(entradas):
        clave = texto[:45]
        for p in range(cursor, len(doc)):
            if doc[p].search_for(clave):
                res[i] = p + 1
                cursor = p
                break
        else:
            res[i] = cursor + 1
    return res


def main():
    texto = open(FUENTE, encoding="utf-8").read()
    texto = texto[texto.index("# Documento final integrado"):]
    texto = texto.replace("✅ Sprint 1", "Sprint 1 (Completada)").replace("✅", "")
    tmp = os.path.join(tempfile.gettempdir(), "movii_pass1.pdf")
    h, entradas = construir_html(texto, {})
    a_pdf(h, tmp)
    doc = pymupdf.open(tmp)
    # primera pagina de contenido: la primera despues del indice que contiene el primer h1
    inicio = next(p for p in range(1, len(doc)) if doc[p].search_for("Presentación del documento") and not doc[p].search_for("Contenido"))
    paginas = paginas_de(tmp, entradas, inicio)
    h, _ = construir_html(texto, paginas)
    a_pdf(h, SALIDA)
    paginas2 = paginas_de(SALIDA, entradas, inicio)
    if paginas2 != paginas:
        h, _ = construir_html(texto, paginas2)
        a_pdf(h, SALIDA)
    print("paginas:", len(pymupdf.open(SALIDA)), "| entradas de indice:", len(entradas))
    print("OK ->", os.path.abspath(SALIDA))


if __name__ == "__main__":
    main()
