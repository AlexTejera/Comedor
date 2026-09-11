/*
================================================================================
  SISTEMA COMEDOR — Aluminios del Uruguay
  Script:  sp_comedor_registrar_consumo.sql
  Base:    SUMMA  (SQL Server 2016+, cualquier nivel de compatibilidad)
  Autor:   Sistema Comedor / atejera
  Fecha:   2026-09-10
================================================================================

TABLA DESTINO
─────────────
  dbo.Consumo_v1
  Columnas:
    usuario           VARCHAR(50)   → número de empleado (como string)
    Articulo_consumo  VARCHAR(50)   → código de artículo
    cantidad          INT
    fecha             DATETIME      → GETDATE() al momento del registro
    validado          VARCHAR(50)   → valor fijo 'Pendiente'
    Contabilizado     VARCHAR(50)   → valor fijo 'No'

PARÁMETROS DE ENTRADA
─────────────────────
  @numero_empleado  INT           → legajo del empleado
  @items            NVARCHAR(MAX) → JSON array:
                                    [{"articulo":"COD1","cantidad":1},
                                     {"articulo":"COD2","cantidad":2}]

RESPUESTA (primera fila, primera columna — string JSON)
───────────────────────────────────────────────────────
  Éxito:  {"Estado":"OK","Mensaje":"Consumo registrado correctamente."}
  Error:  {"Estado":"ERROR","Mensaje":"<descripción del error>"}

NOTA: El backend Python hace json.loads(row[0]) con este resultado.

COMPATIBILIDAD
──────────────
  No usa OPENJSON (requiere compat level 130).
  Usa JSON_VALUE con índice posicional, disponible en SQL Server 2016+
  independientemente del nivel de compatibilidad de la base de datos.
================================================================================
*/


-- ── 1. Crear tabla si no existe ───────────────────────────────────────────────

IF NOT EXISTS (
    SELECT 1 FROM sys.tables
    WHERE name = 'Consumo_v1' AND schema_id = SCHEMA_ID('dbo')
)
BEGIN
    CREATE TABLE dbo.Consumo_v1 (
        id                INT           IDENTITY(1,1) PRIMARY KEY,
        usuario           VARCHAR(50)   NOT NULL,
        Articulo_consumo  VARCHAR(50)   NOT NULL,
        cantidad          INT           NOT NULL DEFAULT 1,
        fecha             DATETIME      NOT NULL DEFAULT GETDATE(),
        validado          VARCHAR(50)   NOT NULL DEFAULT 'Pendiente',
        Contabilizado     VARCHAR(50)   NOT NULL DEFAULT 'No'
    );

    PRINT 'Tabla dbo.Consumo_v1 creada correctamente.';
END
ELSE
BEGIN
    PRINT 'Tabla dbo.Consumo_v1 ya existe — no se modifica.';
END
GO


-- ── 2. Stored procedure de registro de consumo ────────────────────────────────

CREATE OR ALTER PROCEDURE dbo.sp_comedor_registrar_consumo
    @numero_empleado  INT,
    @items            NVARCHAR(MAX)    -- JSON: [{"articulo":"COD","cantidad":N},...]
AS
BEGIN
    SET NOCOUNT ON;

    BEGIN TRY

        -- Validar que el parámetro sea JSON válido
        IF ISJSON(@items) = 0
        BEGIN
            SELECT '{"Estado":"ERROR","Mensaje":"El parametro items no es un JSON valido."}';
            RETURN;
        END;

        -- Recorrer el array JSON por índice posicional con JSON_VALUE.
        -- Esta técnica no requiere OPENJSON y funciona en cualquier
        -- nivel de compatibilidad de SQL Server 2016+.

        DECLARE @i          INT          = 0;
        DECLARE @articulo   VARCHAR(50);
        DECLARE @cantidad   INT;
        DECLARE @insertados INT          = 0;

        WHILE 1 = 1
        BEGIN
            -- Leer el elemento en la posición @i del array
            SET @articulo = JSON_VALUE(@items, '$[' + CAST(@i AS VARCHAR(10)) + '].articulo');
            SET @cantidad = TRY_CAST(
                                JSON_VALUE(@items, '$[' + CAST(@i AS VARCHAR(10)) + '].cantidad')
                            AS INT);

            -- JSON_VALUE devuelve NULL cuando el índice supera el tamaño del array → fin del loop
            IF @articulo IS NULL BREAK;

            -- Solo insertar si el artículo no está vacío y la cantidad es válida
            IF LEN(LTRIM(RTRIM(@articulo))) > 0 AND ISNULL(@cantidad, 0) > 0
            BEGIN
                INSERT INTO dbo.Consumo_v1
                    (usuario, Articulo_consumo, cantidad, fecha, validado, Contabilizado)
                VALUES (
                    CAST(@numero_empleado AS VARCHAR(50)),
                    @articulo,
                    @cantidad,
                    GETDATE(),
                    'Pendiente',
                    'No'
                );

                SET @insertados = @insertados + 1;
            END;

            SET @i = @i + 1;
        END;

        -- Verificar que se insertó al menos un registro
        IF @insertados = 0
        BEGIN
            SELECT '{"Estado":"ERROR","Mensaje":"La lista de articulos estaba vacia o no contenia items validos."}';
            RETURN;
        END;

        -- Retornar éxito al backend Python
        SELECT '{"Estado":"OK","Mensaje":"Consumo registrado correctamente."}';

    END TRY
    BEGIN CATCH

        -- Retornar error al backend Python
        SELECT '{"Estado":"ERROR","Mensaje":"'
               + REPLACE(REPLACE(ERROR_MESSAGE(), '\', '\\'), '"', '\"')
               + '"}';

    END CATCH;
END;
GO


-- ── 3. Prueba rápida (descomentá para verificar) ──────────────────────────────
/*
EXEC dbo.sp_comedor_registrar_consumo
    @numero_empleado = 1234,
    @items = '[{"articulo":"001","cantidad":1},{"articulo":"002","cantidad":2}]';

SELECT TOP 5 * FROM dbo.Consumo_v1 ORDER BY id DESC;
*/
