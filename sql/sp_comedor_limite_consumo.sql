/*
================================================================================
  SISTEMA COMEDOR — Aluminios del Uruguay
  Script:  sp_comedor_limite_consumo.sql
  Base:    SUMMA  (SQL Server 2016+, cualquier nivel de compatibilidad)
  Autor:   Sistema Comedor / atejera
  Fecha:   2026-09-17
================================================================================

TABLA
─────
  dbo.Limite_consumo (ya existe en producción, creada manualmente — este
  script NO la toca si ya está, solo agrega los SPs de administración)
  Columnas:
    Articulo_consumo  VARCHAR(50)  → código de artículo (dbo.Articulos)
    max_consumo       INT          → cantidad máxima permitida
    en_ultimas_x_hs   INT          → ventana de horas sobre la que se cuenta

  No tiene columna id / PK propia: la clave natural para editar/eliminar
  una línea es (Articulo_consumo, en_ultimas_x_hs) — no tiene sentido tener
  dos límites distintos para el mismo artículo con la misma ventana de horas.

REGLA IMPORTANTE — dbo.sp_comedor_registrar_consumo
────────────────────────────────────────────────────
  La versión de sp_comedor_registrar_consumo actualmente en producción
  valida el consumo consultando ÚNICAMENTE la fila con en_ultimas_x_hs=12
  (hardcodeado). Agregar acá una línea con otra ventana (ej. 24hs) queda
  guardada y visible en el panel, pero NO se hace cumplir todavía en el
  registro de consumo — hace falta generalizar ese SP aparte si se
  necesitan ventanas de horas distintas de 12. No se toca en este script.

SPs EN ESTE SCRIPT
───────────────────
  sp_comedor_limite_consumo_listar(@codigo)
  sp_comedor_limite_consumo_guardar(@codigo, @max_consumo, @en_ultimas_x_hs)
  sp_comedor_limite_consumo_eliminar(@codigo, @en_ultimas_x_hs)

RESPUESTA (primera fila, primera columna — string JSON)
───────────────────────────────────────────────────────
  listar            : array de límites: [{"maxConsumo":2,"enUltimasXHs":12}, ...]
                       (array vacío "[]" si no hay límites — nunca NULL)
  guardar/eliminar  : {"Estado":"OK"|"ERROR","Mensaje":"..."}

NOTA: El backend Python hace json.loads(row[0]) con este resultado.
================================================================================
*/


-- ── 0. Crear tabla si por algún motivo no existe (no debería, ya está en prod) ─

IF NOT EXISTS (
    SELECT 1 FROM sys.tables
    WHERE name = 'Limite_consumo' AND schema_id = SCHEMA_ID('dbo')
)
BEGIN
    CREATE TABLE dbo.Limite_consumo (
        Articulo_consumo VARCHAR(50) NOT NULL,
        max_consumo      INT         NOT NULL,
        en_ultimas_x_hs  INT         NOT NULL
    );

    PRINT 'Tabla dbo.Limite_consumo creada correctamente.';
END
ELSE
BEGIN
    PRINT 'Tabla dbo.Limite_consumo ya existe — no se modifica.';
END
GO


-- ── 1. Listar los límites de un artículo ───────────────────────────────────────

IF OBJECT_ID('dbo.sp_comedor_limite_consumo_listar', 'P') IS NOT NULL
    DROP PROCEDURE dbo.sp_comedor_limite_consumo_listar;
GO

CREATE PROCEDURE dbo.sp_comedor_limite_consumo_listar
    @codigo VARCHAR(50)
AS
BEGIN
    SET NOCOUNT ON;

    BEGIN TRY

        SELECT ISNULL((
            SELECT
                max_consumo     AS maxConsumo,
                en_ultimas_x_hs AS enUltimasXHs
            FROM dbo.Limite_consumo
            WHERE Articulo_consumo = @codigo
            ORDER BY en_ultimas_x_hs
            FOR JSON PATH
        ), '[]');

    END TRY
    BEGIN CATCH

        THROW;

    END CATCH;
END;
GO


-- ── 2. Crear o actualizar un límite (clave: codigo + horas) ────────────────────

CREATE OR ALTER PROCEDURE dbo.sp_comedor_limite_consumo_guardar
    @codigo          VARCHAR(50),
    @max_consumo     INT,
    @en_ultimas_x_hs INT
AS
BEGIN
    SET NOCOUNT ON;

    BEGIN TRY

        IF NOT EXISTS (SELECT 1 FROM dbo.Articulos WHERE Articulo_consumo = @codigo)
        BEGIN
            SELECT '{"Estado":"ERROR","Mensaje":"No existe un articulo con ese codigo."}';
            RETURN;
        END;

        IF ISNULL(@max_consumo, 0) <= 0
        BEGIN
            SELECT '{"Estado":"ERROR","Mensaje":"El maximo de consumo tiene que ser mayor a 0."}';
            RETURN;
        END;

        IF ISNULL(@en_ultimas_x_hs, 0) <= 0
        BEGIN
            SELECT '{"Estado":"ERROR","Mensaje":"La ventana de horas tiene que ser mayor a 0."}';
            RETURN;
        END;

        IF EXISTS (
            SELECT 1 FROM dbo.Limite_consumo
            WHERE Articulo_consumo = @codigo AND en_ultimas_x_hs = @en_ultimas_x_hs
        )
        BEGIN
            UPDATE dbo.Limite_consumo
            SET max_consumo = @max_consumo
            WHERE Articulo_consumo = @codigo AND en_ultimas_x_hs = @en_ultimas_x_hs;
        END
        ELSE
        BEGIN
            INSERT INTO dbo.Limite_consumo (Articulo_consumo, max_consumo, en_ultimas_x_hs)
            VALUES (@codigo, @max_consumo, @en_ultimas_x_hs);
        END;

        SELECT '{"Estado":"OK","Mensaje":"Limite guardado correctamente."}';

    END TRY
    BEGIN CATCH

        SELECT '{"Estado":"ERROR","Mensaje":"'
               + REPLACE(REPLACE(ERROR_MESSAGE(), '\', '\\'), '"', '\"')
               + '"}';

    END CATCH;
END;
GO


-- ── 3. Eliminar un límite ───────────────────────────────────────────────────────

CREATE OR ALTER PROCEDURE dbo.sp_comedor_limite_consumo_eliminar
    @codigo          VARCHAR(50),
    @en_ultimas_x_hs INT
AS
BEGIN
    SET NOCOUNT ON;

    BEGIN TRY

        IF NOT EXISTS (
            SELECT 1 FROM dbo.Limite_consumo
            WHERE Articulo_consumo = @codigo AND en_ultimas_x_hs = @en_ultimas_x_hs
        )
        BEGIN
            SELECT '{"Estado":"ERROR","Mensaje":"No existe ese limite para el articulo."}';
            RETURN;
        END;

        DELETE FROM dbo.Limite_consumo
        WHERE Articulo_consumo = @codigo AND en_ultimas_x_hs = @en_ultimas_x_hs;

        SELECT '{"Estado":"OK","Mensaje":"Limite eliminado correctamente."}';

    END TRY
    BEGIN CATCH

        SELECT '{"Estado":"ERROR","Mensaje":"'
               + REPLACE(REPLACE(ERROR_MESSAGE(), '\', '\\'), '"', '\"')
               + '"}';

    END CATCH;
END;
GO


-- ── Prueba rápida (descomentá para verificar) ─────────────────────────────────
/*
EXEC dbo.sp_comedor_limite_consumo_listar @codigo = '001';
EXEC dbo.sp_comedor_limite_consumo_guardar @codigo = '001', @max_consumo = 2, @en_ultimas_x_hs = 12;
EXEC dbo.sp_comedor_limite_consumo_eliminar @codigo = '001', @en_ultimas_x_hs = 12;
*/
