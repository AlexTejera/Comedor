/*
================================================================================
  SISTEMA COMEDOR — Aluminios del Uruguay
  Script:  sp_comedor_validar_empleado.sql
  Base:    SUMMA  (SQL Server — cualquier versión)
  Autor:   Sistema Comedor / atejera
  Fecha:   2026-09-10
================================================================================

TABLA CONSULTADA
────────────────
  [Comedor].[dbo].[Usuario]
  Columnas relevantes:
    cod_tarjeta     → número de empleado (ingresado en el kiosko)
    nombre_usuario  → nombre completo del empleado
    Habilitado      → 'S' = habilitado / 'N' = no habilitado
    usuario         → nombre abreviado (no utilizado en este SP)

PARÁMETRO DE ENTRADA
────────────────────
  @numero_empleado  INT  → legajo ingresado en el kiosko

RESPUESTA (primera fila, primera columna — string JSON)
───────────────────────────────────────────────────────
  Encontrado y habilitado:
    {"Estado":"OK","Mensaje":"Empleado validado.","NombreEmpleado":"Juan Pérez"}

  No encontrado:
    {"Estado":"ERROR","Mensaje":"Empleado no encontrado.","NombreEmpleado":""}

  Encontrado pero inhabilitado:
    {"Estado":"ERROR","Mensaje":"Empleado no habilitado para usar el comedor.","NombreEmpleado":""}

NOTA: El backend Python hace json.loads(row[0]) con este resultado.
================================================================================
*/


-- ── Crear o reemplazar el SP ──────────────────────────────────────────────────

IF OBJECT_ID('dbo.sp_comedor_validar_empleado', 'P') IS NOT NULL
    DROP PROCEDURE dbo.sp_comedor_validar_empleado;
GO

CREATE PROCEDURE dbo.sp_comedor_validar_empleado
    @numero_empleado  INT
AS
BEGIN
    SET NOCOUNT ON;

    BEGIN TRY

        DECLARE @nombre     VARCHAR(200);
        DECLARE @habilitado VARCHAR(1);

        -- Buscar el empleado por número de tarjeta/legajo
        SELECT
            @nombre     = nombre_usuario,
            @habilitado = Habilitado
        FROM dbo.Usuario
        WHERE cod_tarjeta = @numero_empleado;

        -- Empleado no encontrado
        IF @nombre IS NULL
        BEGIN
            SELECT '{"Estado":"ERROR","Mensaje":"Empleado no encontrado.","NombreEmpleado":""}';
            RETURN;
        END;

        -- Empleado inhabilitado
        IF @habilitado <> 'S'
        BEGIN
            SELECT '{"Estado":"ERROR","Mensaje":"Empleado no habilitado para usar el comedor.","NombreEmpleado":""}';
            RETURN;
        END;

        -- Empleado válido — escapar comillas del nombre para no romper el JSON
        SET @nombre = REPLACE(REPLACE(@nombre, '\', '\\'), '"', '\"');

        SELECT '{"Estado":"OK","Mensaje":"Empleado validado.","NombreEmpleado":"' + @nombre + '"}';

    END TRY
    BEGIN CATCH

        SELECT '{"Estado":"ERROR","Mensaje":"'
               + REPLACE(REPLACE(ERROR_MESSAGE(), '\', '\\'), '"', '\"')
               + '","NombreEmpleado":""}';

    END CATCH;
END;
GO


-- ── Prueba rápida (descomentá para verificar) ─────────────────────────────────
/*
-- Caso OK (reemplazar con un legajo real):
EXEC dbo.sp_comedor_validar_empleado @numero_empleado = 1234;

-- Caso no encontrado:
EXEC dbo.sp_comedor_validar_empleado @numero_empleado = 9999999;
*/
