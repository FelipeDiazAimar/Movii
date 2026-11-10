# -*- coding: utf-8 -*-
"""Recorrido de los flujos de la demo contra una API REAL en ejecucion (HTTP).

Uso:  python recorrido_demo.py [URL_API]      (por defecto http://localhost:8099)
Requisitos: la API levantada con los usuarios demo (operador@, repartidor@,
supervisor@movii.demo, clave Movii2026!). Conviene arrancarla con
WHATSAPP_HABILITADO=false, sin RESEND_API_KEY, SIMULADOR_GPS=false y
MIGRATE_ON_START=false para no mandar mensajes reales ni tocar el esquema.
Crea datos propios (envios "Cliente Live N", ruta "Ruta Live", vehiculo
ZZ999LV): los envios entregados/en camino no se pueden borrar por la API, asi
que hay que limpiarlos en la base al terminar.
"""
import json, sys, urllib.request, urllib.error, base64

B = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8099"
res = []


def call(m, p, body=None, tok=None):
    req = urllib.request.Request(B + p, method=m, data=json.dumps(body).encode() if body is not None else None)
    req.add_header("Content-Type", "application/json")
    if tok:
        req.add_header("Authorization", "Bearer " + tok)
    try:
        r = urllib.request.urlopen(req, timeout=20)
        raw = r.read()
        code = r.status
    except urllib.error.HTTPError as e:
        raw = e.read()
        code = e.code
    try:
        return code, json.loads(raw) if raw else {}
    except Exception:
        return code, {"raw": raw[:200].decode("utf-8", "replace")}


def check(nombre, ok, det=""):
    res.append((nombre, ok))
    print(("OK   " if ok else "FALLA"), nombre, det)


def login(email, pw="Movii2026!"):
    c, r = call("POST", "/auth/login", {"email": email, "password": pw})
    return c, r


c, r = call("GET", "/health")
check("health", c == 200)

c, r = login("operador@movii.demo")
check("login operador", c == 200 and "token" in r, f"({c}, {list(r)[:4]})")
op = r.get("token")
c, r = login("repartidor@movii.demo")
check("login repartidor", c == 200 and "token" in r, f"({c}, {list(r)[:4]})")
rep = r.get("token")
c, r = login("supervisor@movii.demo")
adm = r.get("token")
check("login admin", c == 200 and adm is not None, f"({c}, {list(r)[:4]})")
c, r = login("operador@movii.demo", "mala")
check("login con clave incorrecta rechazado", c == 401, f"({c})")
c, r = call("POST", "/envios", {"remitente": {"nombre": "Dep"}, "destinatario": {"nombre": "C", "calle": "M", "numero": "1", "localidad": "SF"}, "paquete": {"peso": 1, "tamano": "pequeno"}}, op)
check("envio con tamano invalido: 400 (no 500)", c == 400, f"({c})")
c, _ = call("GET", "/envios")
check("sin token: 401", c == 401)
c, _ = call("POST", "/envios", {}, rep)
check("repartidor no puede crear envio: 403", c == 403, f"({c})")

c, r = call("GET", "/repartidores", tok=op)
reps = r if isinstance(r, list) else r.get("repartidores", r.get("data", []))
repid = next((x["id"] for x in reps if x.get("email") == "repartidor@movii.demo"), reps[0]["id"] if reps else None)
check("listar repartidores", c == 200 and repid is not None, f"({len(reps)})")

ids = {"envios": [], "ruta": None, "veh": None}


def nuevo_envio(n, peso=3.0, tam="chico"):
    return {"remitente": {"nombre": "Deposito Live"},
            "destinatario": {"nombre": f"Cliente Live {n}", "calle": "Mitre", "numero": str(100 + n), "localidad": "San Francisco", "codigo_postal": "X2400", "telefono": "+5493564000000"},
            "paquete": {"peso": peso, "tamano": tam}}


for n in (1, 2):
    c, r = call("POST", "/envios", nuevo_envio(n), op)
    check(f"crear envio {n}", c == 201 and "id" in r, f"({c}, {r.get('codigo_guia')})")
    ids["envios"].append(r.get("id"))
    if n == 1:
        cod = r.get("codigo_guia")

c, r = call("GET", "/tracking/" + str(cod))
check("tracking publico por codigo", c == 200, f"({c})")

c, r = call("POST", "/vehiculos", {"patente": "ZZ999LV", "modelo": "Live Test", "tipo": "furgon", "capacidad_peso": 800, "capacidad_volumen": 6, "estado": "en_base", "color": "#2b7bbf"}, op)
check("crear vehiculo", c == 201 and "id" in r, f"({c}, {r if c != 201 else ''})")
ids["veh"] = r.get("id")

c, r = call("POST", "/rutas", {"nombre": "Ruta Live", "zona": "Centro", "fecha": "2026-12-31", "repartidor_id": repid}, op)
check("crear ruta con repartidor", c == 201 and "id" in r, f"({c}, {r if c != 201 else ''})")
ids["ruta"] = r.get("id")
rid = ids["ruta"]

c, r = call("PUT", f"/rutas/{rid}/vehiculo", {"vehiculo_id": ids["veh"]}, op)
check("asignar vehiculo a la ruta", c in (200, 204), f"({c}, {r if c not in (200, 204) else ''})")

c, r = call("POST", f"/rutas/{rid}/recomendar", {"envio_id": ids["envios"][0]}, op)
check("recomendacion de asignacion", c == 200, f"({c}, {str(r)[:120]})")

c, r = call("POST", f"/rutas/{rid}/envios", {"envio_ids": ids["envios"]}, op)
check("asignar 2 envios a la ruta", c == 200, f"({c}, {str(r)[:140] if c != 200 else ''})")
if c == 409:
    c, r = call("POST", f"/rutas/{rid}/envios", {"envio_ids": ids["envios"], "forzar": True}, op)
    check("asignar con forzar", c == 200, f"({c})")

c, r = call("GET", f"/rutas/{rid}", tok=op)
check("detalle ruta: 2 envios y peso 6", c == 200 and r.get("cantidad_envios") == 2 and r.get("peso_total") == 6, f"({c}, {r.get('cantidad_envios')}, {r.get('peso_total')}, veh={r.get('vehiculo_id') or r.get('vehiculo')})")

c, r = call("DELETE", f"/rutas/{rid}/envios/{ids['envios'][1]}", tok=op)
check("desasignar un envio", c == 200, f"({c})")
c, r = call("POST", f"/rutas/{rid}/envios", {"envio_ids": [ids["envios"][1]], "forzar": True}, op)
check("reasignar el envio", c == 200, f"({c})")

c, r = call("GET", "/operaciones/flota", tok=op)
check("flota (mapa)", c == 200, f"({c})")
c, r = call("GET", "/operaciones/dashboard", tok=op)
check("dashboard operaciones", c == 200, f"({c})")
for p in ("envios", "repartidores", "incidencias"):
    c, r = call("GET", f"/reportes/{p}?desde=2026-01-01&hasta=2026-12-31", tok=op)
    check(f"reporte {p}", c == 200, f"({c})")

# Repartidor (app movil)
c, r = call("GET", "/repartidor/envios-del-dia", tok=rep)
check("repartidor: envios del dia", c == 200, f"({c})")
c, r = call("GET", "/repartidor/perfil", tok=rep)
check("repartidor: perfil", c == 200, f"({c})")
c, r = call("GET", f"/rutas/{rid}", tok=rep)
check("repartidor ve su ruta", c == 200, f"({c})")

e1, e2 = ids["envios"]
c, r = call("PUT", f"/envios/{e1}/estado", {"estado": "en_camino"}, rep)
check("estado: asignado -> en_camino", c == 200, f"({c}, {str(r)[:150] if c != 200 else ''})")
c, r = call("PUT", f"/envios/{e1}/estado", {"estado": "pendiente"}, rep)
check("transicion invalida rechazada", c in (400, 409, 422), f"({c})")
png = base64.b64encode(bytes.fromhex("89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c6360000002000001e221bc330000000049454e44ae426082")).decode()
c, r = call("POST", f"/envios/{e1}/confirmacion", {"receptor_nombre": "Ana Live", "receptor_relacion": "destinatario", "firma_base64": png, "foto_base64": "/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAIBAQEBAQIBAQECAgICAgQDAgICAgUEBAMEBgUGBgYFBgYGBwkIBgcJBwYGCAsICQoKCgoKBggLDAsKDAkKCgr/2wBDAQICAgICAgUDAwUKBwYHCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgr/wgARCAAQABADAREAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAf/xAAWAQEBAQAAAAAAAAAAAAAAAAAABgj/2gAMAwEAAhADEAAAAZDC6qAH/8QAFBABAAAAAAAAAAAAAAAAAAAAIP/aAAgBAQABBQIf/8QAFBEBAAAAAAAAAAAAAAAAAAAAIP/aAAgBAwEBPwEf/8QAFBEBAAAAAAAAAAAAAAAAAAAAIP/aAAgBAgEBPwEf/8QAFBABAAAAAAAAAAAAAAAAAAAAIP/aAAgBAQAGPwIf/8QAFBABAAAAAAAAAAAAAAAAAAAAIP/aAAgBAQABPyEf/9oADAMBAAIAAwAAABAAD//EABQRAQAAAAAAAAAAAAAAAAAAACD/2gAIAQMBAT8QH//EABQRAQAAAAAAAAAAAAAAAAAAACD/2gAIAQIBAT8QH//EABQQAQAAAAAAAAAAAAAAAAAAACD/2gAIAQEAAT8QH//Z"}, rep)
check("confirmar entrega con firma y foto", c in (200, 201), f"({c}, {str(r)[:150] if c not in (200, 201) else ''})")
c, r = call("GET", f"/envios/{e1}", tok=op)
check("envio 1 queda entregado", c == 200 and r.get("estado") == "entregado", f"({c}, {r.get('estado')})")
c, r = call("GET", f"/envios/{e1}/confirmacion/firma", tok=op)
check("descargar firma", c == 200 or c == 204 or "raw" in r, f"({c})")

c, r = call("PUT", f"/envios/{e2}/estado", {"estado": "en_camino"}, rep)
c, r = call("POST", f"/envios/{e2}/incidencia", {"motivo": "cliente_ausente", "comentario": "Nadie atendio (prueba en vivo)"}, rep)
check("registrar incidencia", c in (200, 201), f"({c}, {str(r)[:150] if c not in (200, 201) else ''})")
c, r = call("POST", f"/envios/{e2}/reprogramacion", {"nueva_fecha": "2026-12-30", "franja": "manana"}, op)
check("reprogramar entrega", c in (200, 201), f"({c}, {str(r)[:150] if c not in (200, 201) else ''})")

# bordes
c, r = call("DELETE", f"/envios/{e1}", tok=adm)
check("admin: borrar envio entregado (permitido o 423)", c in (204, 423), f"({c})")
c, r = call("DELETE", f"/vehiculos/{ids['veh']}", tok=adm)
check("admin: vehiculo con ruta planificada -> 423", c == 423, f"({c})")
c, r = call("GET", "/users", tok=op)
check("operador no lista usuarios: 403", c == 403, f"({c})")

fall = [n for n, ok in res if not ok]
print(f"\n{len(res) - len(fall)}/{len(res)} OK; fallas: {fall}")
