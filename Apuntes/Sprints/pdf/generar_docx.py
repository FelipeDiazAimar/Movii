# -*- coding: utf-8 -*-
"""Genera el .docx del documento final integrado usando como plantilla el .docx
del equipo (encabezado UTN con logo, pie "Pagina X de Y", hoja carta, estilos).

Uso:  python generar_docx.py
Requiere: python-docx, markdown, beautifulsoup4.
Al abrir el archivo en Word hay que aceptar "actualizar campos" para que el
indice (campo TOC) muestre los numeros de pagina.
"""
import copy
import os
import re

import docx
import markdown
from bs4 import BeautifulSoup, NavigableString, Tag
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_BREAK
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Inches, Pt, RGBColor

AQUI = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.abspath(os.path.join(AQUI, ".."))
FUENTE = os.path.join(BASE, "Sprint3 - Araya_Diaz-Aimar_Micheloud integrado.md")
PLANTILLA = os.path.join(BASE, "Sprint2 - Araya_Diaz-Aimar_Micheloud actualizado.docx")
SALIDA = os.path.join(BASE, "Sprint3 - Araya_Diaz-Aimar_Micheloud.docx")
ANCHO_UTIL = 7.5  # pulgadas (carta con margen de 0,5")

AZUL = "2B7BBF"
GRIS_ENC = "E8EEF7"
GRIS_COD = "F1F5F9"


def sombrear(elem_pr, color):
    shd = OxmlElement("w:shd")
    shd.set(qn("w:val"), "clear")
    shd.set(qn("w:color"), "auto")
    shd.set(qn("w:fill"), color)
    elem_pr.append(shd)


def bordes_tabla(tbl):
    pr = tbl._tbl.tblPr
    b = OxmlElement("w:tblBorders")
    for lado in ("top", "left", "bottom", "right", "insideH", "insideV"):
        e = OxmlElement("w:" + lado)
        e.set(qn("w:val"), "single")
        e.set(qn("w:sz"), "4")
        e.set(qn("w:space"), "0")
        e.set(qn("w:color"), "CBD5E1")
        b.append(e)
    pr.append(b)
    m = OxmlElement("w:tblCellMar")
    for lado, w in (("top", 40), ("left", 80), ("bottom", 40), ("right", 80)):
        e = OxmlElement("w:" + lado)
        e.set(qn("w:w"), str(w))
        e.set(qn("w:type"), "dxa")
        m.append(e)
    pr.append(m)


def campo(par, instr, texto_previo=""):
    """Inserta un campo (TOC, PAGE...) en un parrafo."""
    for tipo, contenido in (("begin", None), ("instr", instr), ("separate", None), ("texto", texto_previo), ("end", None)):
        r = par.add_run()
        if tipo == "instr":
            it = OxmlElement("w:instrText")
            it.set(qn("xml:space"), "preserve")
            it.text = contenido
            r._r.append(it)
        elif tipo == "texto":
            r.text = contenido
        else:
            fc = OxmlElement("w:fldChar")
            fc.set(qn("w:fldCharType"), tipo)
            r._r.append(fc)


def run_fmt(run, b=False, i=False, code=False, size=None, color=None):
    run.bold = b or None
    run.italic = i or None
    if code:
        run.font.name = "Consolas"
        run._r.get_or_add_rPr().rFonts.set(qn("w:eastAsia"), "Consolas")
        run.font.size = Pt(8.5 if size is None else size)
        sombrear(run._r.get_or_add_rPr(), GRIS_COD)
    elif size:
        run.font.size = Pt(size)
    if color:
        run.font.color.rgb = RGBColor.from_string(color)


def inline(par, nodo, b=False, i=False, size=None, color=None):
    """Vuelca el contenido inline de un nodo HTML en el parrafo conservando negrita/cursiva/codigo."""
    for h in nodo.children:
        if isinstance(h, NavigableString):
            t = str(h).replace("\n", " ")
            if t:
                run_fmt(par.add_run(t), b, i, size=size, color=color)
        elif h.name in ("strong", "b"):
            inline(par, h, True, i, size, color)
        elif h.name in ("em", "i"):
            inline(par, h, b, True, size, color)
        elif h.name == "code":
            run_fmt(par.add_run(h.get_text()), b, i, code=True, size=size)
        elif h.name == "br":
            par.add_run().add_break()
        elif h.name == "a":
            inline(par, h, b, i, size, color)
        elif h.name == "img":
            pass
        else:
            inline(par, h, b, i, size, color)


def formato_parrafo(par, antes=0, despues=4, sangria=None, colgante=None):
    pf = par.paragraph_format
    pf.space_before = Pt(antes)
    pf.space_after = Pt(despues)
    if sangria is not None:
        pf.left_indent = Inches(sangria)
    if colgante is not None:
        pf.first_line_indent = Inches(-colgante)


def agregar_imagen(doc, ruta, ancho_max=None):
    par = doc.add_paragraph()
    par.alignment = WD_ALIGN_PARAGRAPH.CENTER
    formato_parrafo(par, 4, 6)
    from PIL import Image
    w, h = Image.open(ruta).size
    ancho = min(ancho_max or (ANCHO_UTIL - 0.5), w / 110)
    par.add_run().add_picture(ruta, width=Inches(ancho))


def lista(doc, nodo, nivel=0):
    ordenada = nodo.name == "ol"
    n = 0
    for li in nodo.find_all("li", recursive=False):
        n += 1
        par = doc.add_paragraph()
        formato_parrafo(par, 0, 2, sangria=0.25 + 0.3 * nivel + 0.2, colgante=0.2)
        marca = f"{n}. " if ordenada else ("•  " if nivel == 0 else "–  ")
        par.add_run(marca)
        # texto propio del item (sin las sublistas)
        propio = copy.copy(li)
        for sub in propio.find_all(["ul", "ol"], recursive=False):
            sub.extract()
        inline(par, propio)
        for sub in li.find_all(["ul", "ol"], recursive=False):
            lista(doc, sub, nivel + 1)


def tabla(doc, nodo):
    filas = nodo.find_all("tr")
    ncols = max(len(f.find_all(["th", "td"])) for f in filas)
    t = doc.add_table(rows=len(filas), cols=ncols)
    bordes_tabla(t)
    t.autofit = False
    pesos = []
    for j in range(ncols):
        mx = 0
        for f in filas:
            cs = f.find_all(["th", "td"])
            if j < len(cs):
                mx = max(mx, len(cs[j].get_text()))
        pesos.append(max(6, min(mx, 45)) ** 0.8)
    tot = sum(pesos)
    anchos = [max(0.55, ANCHO_UTIL * w / tot) for w in pesos]
    esc = ANCHO_UTIL / sum(anchos)
    anchos = [a * esc for a in anchos]
    for j, a in enumerate(anchos):
        t.columns[j].width = Inches(a)
    for i, f in enumerate(filas):
        celdas = f.find_all(["th", "td"])
        for j in range(ncols):
            celda = t.cell(i, j)
            celda.width = Inches(anchos[j])
            par = celda.paragraphs[0]
            formato_parrafo(par, 0, 0)
            if j < len(celdas):
                es_enc = celdas[j].name == "th"
                inline(par, celdas[j], b=es_enc or (j == 0), size=8.5)
            if i == 0:
                sombrear(celda._tc.get_or_add_tcPr(), GRIS_ENC)
        if i == 0:
            trpr = t.rows[0]._tr.get_or_add_trPr()
            h = OxmlElement("w:tblHeader")
            h.set(qn("w:val"), "on")
            trpr.append(h)
        cant = OxmlElement("w:cantSplit")
        t.rows[i]._tr.get_or_add_trPr().append(cant)
    sp = doc.add_paragraph()
    formato_parrafo(sp, 0, 4)


def bloque_codigo(doc, texto):
    for linea in texto.rstrip("\n").split("\n"):
        par = doc.add_paragraph(style="Source Code")
        formato_parrafo(par, 0, 0)
        sombrear(par._p.get_or_add_pPr(), GRIS_COD)
        r = par.add_run(linea if linea else " ")
        r.font.name = "Consolas"
        r.font.size = Pt(7.5)
    sp = doc.add_paragraph()
    formato_parrafo(sp, 0, 4)


def cita(doc, nodo):
    for p in nodo.find_all(["p", "li"]):
        par = doc.add_paragraph()
        formato_parrafo(par, 0, 3, sangria=0.2)
        pPr = par._p.get_or_add_pPr()
        borde = OxmlElement("w:pBdr")
        izq = OxmlElement("w:left")
        izq.set(qn("w:val"), "single")
        izq.set(qn("w:sz"), "18")
        izq.set(qn("w:space"), "6")
        izq.set(qn("w:color"), AZUL)
        borde.append(izq)
        pPr.append(borde)
        sombrear(pPr, GRIS_COD)
        inline(par, p, size=10)


def salto_pagina(doc):
    doc.add_paragraph().add_run().add_break(WD_BREAK.PAGE)


def limpiar_cuerpo(doc):
    body = doc.element.body
    sect = body.find(qn("w:sectPr"))
    for hijo in list(body):
        if hijo is not sect:
            body.remove(hijo)


def portada(doc):
    def linea(texto, tam, negrita=False, cursiva=False, centrado=True, antes=0, despues=4):
        par = doc.add_paragraph()
        par.alignment = WD_ALIGN_PARAGRAPH.CENTER if centrado else WD_ALIGN_PARAGRAPH.LEFT
        formato_parrafo(par, antes, despues)
        r = par.add_run(texto)
        r.font.size = Pt(tam)
        r.bold = negrita or None
        r.italic = cursiva or None
        return par

    linea("Sistema de Gestión de Envíos y Distribución", 28, antes=60, despues=10)
    linea("Trabajo Práctico Integrador - Sprint 3", 22, negrita=True, despues=8)
    linea("Documento final integrado · Sprints 1, 2 y 3 (HU-01 a HU-19)", 14, cursiva=True, despues=18)
    agregar_imagen(doc, os.path.join(AQUI, "cover.png"), 4.4)
    linea("Docentes:", 12, negrita=True, centrado=False, antes=14, despues=0)
    linea("Gandino, Diego", 12, centrado=False, despues=0)
    linea("Saldarini, Javier Daniel", 12, centrado=False, despues=6)
    linea("Grupo N° 7:", 12, negrita=True, centrado=False, despues=0)
    for n in ("Araya, Ulises", "Díaz Aimar, Felipe", "Micheloud, Jeremías"):
        linea(n, 12, centrado=False, despues=0)
    par = doc.add_paragraph()
    par.paragraph_format.page_break_before = True
    formato_parrafo(par, 0, 8)
    rr = par.add_run("Índice")
    rr.font.size = Pt(24)
    rr.bold = True
    campo(doc.add_paragraph(), 'TOC \\o "1-3" \\h \\z \\u',
          "Clic derecho > Actualizar campo (o aceptar la actualización al abrir) para ver el índice con páginas.")


def main():
    texto = open(FUENTE, encoding="utf-8").read()
    texto = texto[texto.index("# Documento final integrado"):]
    texto = texto.replace("✅ Sprint 1", "Sprint 1 (Completada)").replace("✅", "")
    html = markdown.markdown(texto, extensions=["tables", "fenced_code", "sane_lists"])
    sopa = BeautifulSoup(html, "html.parser")

    doc = docx.Document(PLANTILLA)
    limpiar_cuerpo(doc)
    portada(doc)

    for el in sopa.children:
        if isinstance(el, NavigableString):
            continue
        n = el.name
        if n in ("h1", "h2", "h3", "h4"):
            par = doc.add_paragraph(style="Heading " + n[1])
            if n == "h1":
                par.paragraph_format.page_break_before = True
            par.add_run(el.get_text())
        elif n == "p":
            img = el.find("img")
            if img is not None and not el.get_text(strip=True):
                ruta = os.path.join(BASE, img["src"])
                if os.path.exists(ruta):
                    agregar_imagen(doc, ruta)
                continue
            par = doc.add_paragraph()
            formato_parrafo(par, 0, 5)
            inline(par, el)
            if img is not None and os.path.exists(os.path.join(BASE, img["src"])):
                agregar_imagen(doc, os.path.join(BASE, img["src"]))
        elif n in ("ul", "ol"):
            lista(doc, el)
        elif n == "table":
            tabla(doc, el)
        elif n == "pre":
            bloque_codigo(doc, el.get_text())
        elif n == "blockquote":
            cita(doc, el)
        elif n == "hr":
            par = doc.add_paragraph()
            formato_parrafo(par, 2, 2)

    # pedir a Word que actualice los campos (indice) al abrir
    st = doc.settings.element
    uf = OxmlElement("w:updateFields")
    uf.set(qn("w:val"), "true")
    st.append(uf)

    doc.core_properties.title = "Trabajo Práctico Integrador - Sprint 3 - Movii"
    doc.core_properties.author = "Grupo N° 7"
    doc.save(SALIDA)
    print("OK ->", SALIDA)


if __name__ == "__main__":
    main()
