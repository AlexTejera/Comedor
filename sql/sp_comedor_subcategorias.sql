/*
================================================================================
  SISTEMA COMEDOR — Aluminios del Uruguay
  Script:  sp_comedor_subcategorias.sql
  Base:    SUMMA  (SQL Server 2016+, cualquier nivel de compatibilidad)
  Autor:   Sistema Comedor / atejera
  Fecha:   2026-09-15
================================================================================

TABLA
─────
  dbo.sub_categoria
  Columnas:
    Categoria      VARCHAR(50)   → debe existir en dbo.categoria
    sub_categoria  VARCHAR(50)
  Clave natural: (Categoria, sub_categoria)

REGLAS DE NEGOCIO
──────────────────
  - Renombrar una subcategoría actualiza EN CASCADA, en la misma transacción,
    dbo.Articulos.sub_categoria para esa combinación (Categoria, sub_categoria).
  - Borrar una subcategoría se BLOQUEA si hay algún artículo usándola.

SPs EN ESTE SCRIPT
───────────────────
  sp_comedor_subcategorias_listar(@categoria = NULL)
  sp_comedor_subcategorias_crear(@categoria, @sub_categoria)
  sp_comedor_subcategorias_editar(@categoria, @sub_categoria_actual, @sub_categoria_nueva)
  sp_comedor_subcategorias_eliminar(@categoria, @sub_categoria)

RESPUESTA (primera fila, primera columna — string JSON)
───────────────────────────────────────────────────────
  listar   : [{"categoria":"Bebidas","subCategoria":"Aguas"}, ...] (o "[]")
             @categoria = NULL → todas; @categoria = 'X' → solo las de esa categoria
  crear/editar/eliminar : {"Estado":"OK"|"ERROR","Mensaje":"..."}

NOTA: El backend Python combina esta lista con la de
sp_comedor_categorias_listar para armar el árbol categoría→subcategorías.
================================================================================
*/


-- ── 0. Crear tabla si no existe (por si el ambiente todavía no la tiene) ───────

IF NOT EXISTS (
    SELECT 1 FROM sys.tables
    WHERE name = 'sub_categoria' AND schema_id = SCHEMA_ID('dbo')
)
BEGIN
    CREATE TABLE dbo.sub_categoria (
        Categoria     VARCHAR(50) NOT NULL,
        sub_categoria VARCHAR(50) NOT NULL,
        CONSTRAINT PK_sub_categoria PRIMARY KEY (Categoria, sub_categoria),
        CONSTRAINT FK_sub_categoria_categoria FOREIGN KEY (Categoria)
            REFERENCES dbo.categoria (Categoria)
    );
    PRINT 'Tabla dbo.sub_categoria creada correctamente.';
END
ELSE
BEGIN
    PRINT 'Tabla dbo.sub_categoria ya existe — no se modifica.';
END
GO


-- ── 1. Listar subcategorías (todas, o filtradas por categoría) ─────────────────

IF OBJECT_ID('dbo.sp_comedor_subcategorias_listar', 'P') IS NOT NULL
    DROP PROCEDURE dbo.sp_comedor_subcategorias_listar;
GO

CREATE PROCEDURE dbo.sp_comedor_subcategorias_listar
    @categoria VARCHAR(50) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    SELECT ISNULL((
        SELECT
            Categoria     AS categoria,
            sub_categoria AS subCategoria
        FROM dbo.sub_categoria
        WHERE @categoria IS NULL OR Categoria = @categoria
        ORDER BY Categoria, sub_categoria
        FOR JSON PATH
    ), '[]');
END;
GO


-- ── 2. Crear subcategoría ────────────────────────────────────────────────────────

CREATE OR ALTER PROCEDURE dbo.sp_comedor_subcategorias_crear
    @categoria     VARCHAR(50),
    @sub_categoria VARCHAR(50)
AS
BEGIN
    SET NOCOUNT ON;

    BEGIN TRY

        IF LEN(LTRIM(RTRIM(ISNULL(@sub_categoria, '')))) = 0
        BEGIN
            SELECT '{"Estado":"ERROR","Mensaje":"El nombre de la subcategoria es requerido."}';
            RETURN;
        END;

        IF NOT EXISTS (SELECT 1 FROM dbo.categoria WHERE Categoria = @categoria)
        BEGIN
            SELECT '{"Estado":"ERROR","Mensaje":"La categoria indicada no existe."}';
            RETURN;
        END;

        IF EXISTS (
            SELECT 1 FROM dbo.sub_categoria
            WHERE Categoria = @categoria AND sub_categoria = @sub_categoria
        )
        BEGIN
            SELECT '{"Estado":"ERROR","Mensaje":"Ya existe esa subcategoria para esta categoria."}';
            RETURN;
        END;

        INSERT INTO dbo.sub_categoria (Categoria, sub_categoria)
        VALUES (@categoria, @sub_categoria);

        SELECT '{"Estado":"OK","Mensaje":"Subcategoria creada correctamente."}';

    END TRY
    BEGIN CATCH

        SELECT '{"Estado":"ERROR","Mensaje":"'
               + REPLACE(REPLACE(ERROR_MESSAGE(), '\', '\\'), '"', '\"')
               + '"}';

    END CATCH;
END;
GO


-- ── 3. Renombrar subcategoría (cascada a Articulos) ───────────────────────────

CREATE OR ALTER PROCEDURE dbo.sp_comedor_subcategorias_editar
    @categoria             VARCHAR(50),
    @sub_categoria_actual  VARCHAR(50),
    @sub_categoria_nueva   VARCHAR(50)
AS
BEGIN
    SET NOCOUNT ON;

    BEGIN TRY

        IF LEN(LTRIM(RTRIM(ISNULL(@sub_categoria_nueva, '')))) = 0
        BEGIN
            SELECT '{"Estado":"ERROR","Mensaje":"El nuevo nombre de la subcategoria es requerido."}';
            RETURN;
        END;

        IF NOT EXISTS (
            SELECT 1 FROM dbo.sub_categoria
            WHERE Categoria = @categoria AND sub_categoria = @sub_categoria_actual
        )
        BEGIN
            SELECT '{"Estado":"ERROR","Mensaje":"No existe esa subcategoria para esta categoria."}';
            RETURN;
        END;

        IF @sub_categoria_actual <> @sub_categoria_nueva
           AND EXISTS (
               SELECT 1 FROM dbo.sub_categoria
               WHERE Categoria = @categoria AND sub_categoria = @sub_categoria_nueva
           )
        BEGIN
            SELECT '{"Estado":"ERROR","Mensaje":"Ya existe otra subcategoria con el nuevo nombre en esta categoria."}';
            RETURN;
        END;

        BEGIN TRANSACTION;

            UPDATE dbo.sub_categoria
            SET sub_categoria = @sub_categoria_nueva
            WHERE Categoria = @categoria AND sub_categoria = @sub_categoria_actual;

            UPDATE dbo.Articulos
            SET sub_categoria = @sub_categoria_nueva
            WHERE Categoria = @categoria AND sub_categoria = @sub_categoria_actual;

        COMMIT TRANSACTION;

        SELECT '{"Estado":"OK","Mensaje":"Subcategoria renombrada correctamente."}';

    END TRY
    BEGIN CATCH

        IF XACT_STATE() <> 0 ROLLBACK TRANSACTION;

        SELECT '{"Estado":"ERROR","Mensaje":"'
               + REPLACE(REPLACE(ERROR_MESSAGE(), '\', '\\'), '"', '\"')
               + '"}';

    END CATCH;
END;
GO


-- ── 4. Eliminar subcategoría (bloqueada si tiene artículos asociados) ─────────

CREATE OR ALTER PROCEDURE dbo.sp_comedor_subcategorias_eliminar
    @categoria     VARCHAR(50),
    @sub_categoria VARCHAR(50)
AS
BEGIN
    SET NOCOUNT ON;

    BEGIN TRY

        IF NOT EXISTS (
            SELECT 1 FROM dbo.sub_categoria
            WHERE Categoria = @categoria AND sub_categoria = @sub_categoria
        )
        BEGIN
            SELECT '{"Estado":"ERROR","Mensaje":"No existe esa subcategoria para esta categoria."}';
            RETURN;
        END;

        DECLARE @en_uso INT;
        SELECT @en_uso = COUNT(*)
        FROM dbo.Articulos
        WHERE Categoria = @categoria AND sub_categoria = @sub_categoria;

        IF @en_uso > 0
        BEGIN
            SELECT '{"Estado":"ERROR","Mensaje":"No se puede eliminar: hay '
                   + CAST(@en_uso AS VARCHAR(20))
                   + ' articulo(s) asociado(s) a esta subcategoria."}';
            RETURN;
        END;

        DELETE FROM dbo.sub_categoria
        WHERE Categoria = @categoria AND sub_categoria = @sub_categoria;

        SELECT '{"Estado":"OK","Mensaje":"Subcategoria eliminada correctamente."}';

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
EXEC dbo.sp_comedor_subcategorias_listar;
EXEC dbo.sp_comedor_subcategorias_listar @categoria = 'Bebidas';
EXEC dbo.sp_comedor_subcategorias_crear @categoria = 'Bebidas', @sub_categoria = 'Aguas';
EXEC dbo.sp_comedor_subcategorias_editar @categoria = 'Bebidas', @sub_categoria_actual = 'Aguas', @sub_categoria_nueva = 'Aguas Saborizadas';
EXEC dbo.sp_comedor_subcategorias_eliminar @categoria = 'Bebidas', @sub_categoria = 'Aguas Saborizadas';
*/
