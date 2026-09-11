/*
================================================================================
  SISTEMA COMEDOR — Aluminios del Uruguay
  Script:  sp_comedor_precio_consumo.sql
  Base:    SUMMA  (SQL Server — cualquier versión)
  Autor:   Sistema Comedor / atejera
  Fecha:   2026-09-10
================================================================================

DESCRIPCIÓN
───────────
  Calcula el costo total de los artículos consumidos por un empleado que
  aún no han sido contabilizados (Contabilizado = 'No').
  Cruza dbo.Consumo_v1 con dbo.Articulos para obtener el precio unitario.

PARÁMETRO DE ENTRADA
────────────────────
  @numero_empleado  INT  → legajo del empleado

RESPUESTA (primera fila, primera columna — string JSON)
───────────────────────────────────────────────────────
  {"Estado":"OK","Total":1234.50,"Mensaje":"OK"}
  {"Estado":"ERROR","Total":0,"Mensaje":"<descripción del error>"}

NOTA: El backend Python hace json.loads(row[0]) con este resultado.
================================================================================
*/


IF OBJECT_ID('dbo.sp_comedor_precio_consumo', 'P') IS NOT NULL
    DROP PROCEDURE dbo.sp_comedor_precio_consumo;
GO

CREATE PROCEDURE dbo.sp_comedor_precio_consumo
    @numero_empleado  INT
AS
BEGIN
    SET NOCOUNT ON;

    BEGIN TRY

        DECLARE @total DECIMAL(18, 2);

        SELECT @total = SUM(ISNULL(art.precio, 0) * consumo.cantidad)
        FROM dbo.Consumo_v1 consumo
        OUTER APPLY (
            SELECT ISNULL(precio, 0) AS precio
            FROM dbo.Articulos art
            WHERE art.articulo_consumo = consumo.Articulo_consumo
        ) art
        WHERE consumo.usuario      = CAST(@numero_empleado AS VARCHAR(50))
          AND consumo.Contabilizado = 'No';

        -- Si no hay registros, SUM devuelve NULL → lo convertimos a 0
        SET @total = ISNULL(@total, 0);

        SELECT '{"Estado":"OK","Total":' + CAST(@total AS VARCHAR(30)) + ',"Mensaje":"OK"}';

    END TRY
    BEGIN CATCH

        SELECT '{"Estado":"ERROR","Total":0,"Mensaje":"'
               + REPLACE(REPLACE(ERROR_MESSAGE(), '\', '\\'), '"', '\"')
               + '"}';

    END CATCH;
END;
GO


-- ── Prueba rápida (descomentá para verificar) ─────────────────────────────────
/*
EXEC dbo.sp_comedor_precio_consumo @numero_empleado = 1234;
*/
