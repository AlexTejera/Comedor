"""
soap_estado.py
Servicio SOAP para monitoreo externo (watchdog).

Operación:  ConsultarEstado
Endpoint:   POST /soap/estado         → ejecuta la operación
            GET  /soap/estado?wsdl    → retorna el WSDL

Respuesta SOAP:
  <estado>ok</estado>    → sistema y BD operativos
  <estado>error</estado> → BD no disponible
"""

import logging

from fastapi import APIRouter, Depends, Request
from fastapi.responses import Response
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.database import get_db

logger = logging.getLogger(__name__)

router = APIRouter()

NAMESPACE = "http://aluminios.com.uy/comedor"

# ── WSDL estático ─────────────────────────────────────────────────────────────
# IMPORTANTE: xmlns default debe ser el namespace WSDL (http://schemas.xmlsoap.org/wsdl/)
# para que <definitions> quede en ese namespace. Si se pone el namespace propio como default,
# los parsers SOAP/WSDL lo rechazan con "Expected element '{wsdl/}definitions'".
WSDL = f"""<?xml version="1.0" encoding="utf-8"?>
<definitions
  name="SistemaComedorEstado"
  targetNamespace="{NAMESPACE}"
  xmlns="http://schemas.xmlsoap.org/wsdl/"
  xmlns:tns="{NAMESPACE}"
  xmlns:xsd="http://www.w3.org/2001/XMLSchema"
  xmlns:soap="http://schemas.xmlsoap.org/wsdl/soap/">

  <types>
    <xsd:schema targetNamespace="{NAMESPACE}">
      <xsd:element name="ConsultarEstado">
        <xsd:complexType><xsd:sequence/></xsd:complexType>
      </xsd:element>
      <xsd:element name="ConsultarEstadoResponse">
        <xsd:complexType>
          <xsd:sequence>
            <xsd:element name="estado" type="xsd:string"/>
          </xsd:sequence>
        </xsd:complexType>
      </xsd:element>
    </xsd:schema>
  </types>

  <message name="ConsultarEstadoRequest">
    <part name="parameters" element="tns:ConsultarEstado"/>
  </message>
  <message name="ConsultarEstadoResponse">
    <part name="parameters" element="tns:ConsultarEstadoResponse"/>
  </message>

  <portType name="EstadoPortType">
    <operation name="ConsultarEstado">
      <input  message="tns:ConsultarEstadoRequest"/>
      <output message="tns:ConsultarEstadoResponse"/>
    </operation>
  </portType>

  <binding name="EstadoBinding" type="tns:EstadoPortType">
    <soap:binding style="document" transport="http://schemas.xmlsoap.org/soap/http"/>
    <operation name="ConsultarEstado">
      <soap:operation soapAction="ConsultarEstado"/>
      <input> <soap:body use="literal"/> </input>
      <output><soap:body use="literal"/> </output>
    </operation>
  </binding>

  <service name="SistemaComedorEstado">
    <port name="EstadoPort" binding="tns:EstadoBinding">
      <soap:address location="__ENDPOINT__"/>
    </port>
  </service>

</definitions>"""


def _soap_response(estado: str) -> str:
    """Construye el envelope SOAP de respuesta."""
    return f"""<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope
  xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"
  xmlns:tns="{NAMESPACE}">
  <soap:Body>
    <tns:ConsultarEstadoResponse>
      <estado>{estado}</estado>
    </tns:ConsultarEstadoResponse>
  </soap:Body>
</soap:Envelope>"""


def _soap_fault(mensaje: str) -> str:
    """Construye un SOAP Fault para errores inesperados."""
    return f"""<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <soap:Fault>
      <faultcode>soap:Server</faultcode>
      <faultstring>{mensaje}</faultstring>
    </soap:Fault>
  </soap:Body>
</soap:Envelope>"""


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/estado")
def get_wsdl(request: Request, wsdl: str = None):
    """Sirve el WSDL cuando se accede con ?wsdl"""
    if wsdl is not None:
        # PrefijoWafMiddleware guarda el prefijo del WAF (ej. "/comedor") en
        # scope["state"], no en scope["root_path"] — ver el comentario en
        # ese archivo sobre por qué root_path rompe app.mount() acá.
        prefijo_waf = request.scope.get("state", {}).get("waf_prefix", "")
        endpoint_url = str(request.base_url).rstrip("/") + prefijo_waf + "/soap/estado"
        wsdl_content = WSDL.replace("__ENDPOINT__", endpoint_url)
        return Response(content=wsdl_content, media_type="text/xml; charset=utf-8")
    return Response(
        content="<info>Servicio SOAP activo. Accedé con ?wsdl para obtener el WSDL.</info>",
        media_type="text/xml"
    )


@router.post("/estado")
async def consultar_estado(request: Request, db: Session = Depends(get_db)):
    """Procesa la operación SOAP ConsultarEstado."""
    try:
        # Verificar BD
        db.execute(text("SELECT 1"))
        estado = "ok"
    except Exception as e:
        logger.error("SOAP ConsultarEstado: BD no disponible — %s", e)
        estado = "error"

    return Response(
        content=_soap_response(estado),
        media_type="text/xml; charset=utf-8",
    )
