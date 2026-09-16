/*
================================================================================
  SISTEMA COMEDOR — Aluminios del Uruguay
  Script:  sp_comedor_categorias.sql
  Base:    SUMMA  (SQL Server 2016+, cualquier nivel de compatibilidad)
  Autor:   Sistema Comedor / atejera
  Fecha:   2026-09-15
================================================================================

TABLA
─────
  dbo.categoria
  Columnas:
    Categoria  VARCHAR(50)   → nombre de la categoría (clave natural)

REGLAS DE NEGOCIO
──────────────────
  - Renombrar una categoría actualiza EN CASCADA, en la misma transacción:
      dbo.sub_categoria.Categoria
      dbo.Articulos.Categoria
    (Articulos.nombre_articulo NUNCA se toca — eso vive en
    sp_comedor_articulos.sql y es intencionalmente inmutable.)
  - Borrar una categoría se BLOQUEA si hay algún artículo (dbo.Articulos)
    que la esté usando — hay que reasignar o borrar esos artículos primero.
    Si no hay artículos, se borra la categoría Y sus subcategorías (no tiene
    sentido una subcategoría sin categoría padre, y por la misma validación
    de arriba sabemos que ningún artículo las está usando).

SPs EN ESTE SCRIPT
───────────────────
  sp_comedor_categorias_listar()
  sp_comedor_categorias_crear(@categoria)
  sp_comedor_categorias_editar(@categoria_actual, @categoria_nueva)
  sp_comedor_categorias_eliminar(@categoria)

RESPUESTA (primera fila, primera columna — string JSON)
───────────────────────────────────────────────────────
  listar   : [{"categoria":"Bebidas"}, {"categoria":"Snacks"}, ...] (o "[]")
  crear/editar/eliminar : {"Estado":"OK"|"ERROR","Mensaje":"..."}

NOTA: El backend Python arma el árbol categoría→subcategorías combinando
esta lista con la de sp_comedor_subcategorias.sql — no hace falta anidar
el JSON acá.
================================================================================
*/


-- ── 0. Crear tabla si no existe (por si el ambiente todavía no la tiene) ───────

IF NOT EXISTS (
    SELECT 1 FROM sys.tables
    WHERE name = 'categoria' AND schema_id = SCHEMA_ID('dbo')
)
BEGIN
    CREATE TABLE dbo.categoria (
        Categoria VARCHAR(50) NOT NULL PRIMARY KEY
    );
    PRINT 'Tabla dbo.categoria creada correctamente.';
END
ELSE
BEGIN
    PRINT 'Tabla dbo.categoria ya existe — no se modifica.';
END
GO


-- ── 1. Listar categorías ────────────────────────────────────────────────────────

IF OBJECT_ID('dbo.sp_comedor_categorias_listar', 'P') IS NOT NULL
    DROP PROCEDURE dbo.sp_comedor_categorias_listar;
GO

CREATE PROCEDURE dbo.sp_comedor_categorias_listar
AS
BEGIN
    SET NOCOUNT ON;

    SELECT ISNULL((
        SELECT Categoria AS categoria
        FROM dbo.categoria
        ORDER BY Categoria
        FOR JSON PATH
    ), '[]');
END;
GO


-- ── 2. Crear categoría ───────────────────────────────────────────────────────────

CREATE OR ALTER PROCEDURE dbo.sp_comedor_categorias_crear
    @categoria VARCHAR(50)
AS
BEGIN
    SET NOCOUNT ON;

    BEGIN TRY

        IF LEN(LTRIM(RTRIM(ISNULL(@categoria, '')))) = 0
        BEGIN
            SELECT '{"Estado":"ERROR","Mensaje":"El nombre de la categoria es requerido."}';
            RETURN;
        END;

        IF EXISTS (SELECT 1 FROM dbo.categoria WHERE Categoria = @categoria)
        BEGIN
            SELECT '{"Estado":"ERROR","Mensaje":"Ya existe una categoria con ese nombre."}';
            RETURN;
        END;

        INSERT INTO dbo.categoria (Categoria) VALUES (@categoria);

        SELECT '{"Estado":"OK","Mensaje":"Categoria creada correctamente."}';

    END TRY
    BEGIN CATCH

        SELECT '{"Estado":"ERROR","Mensaje":"'
               + REPLACE(REPLACE(ERROR_MESSAGE(), '\', '\\'), '"', '\"')
               + '"}';

    END CATCH;
END;
GO


-- ── 3. Renombrar categoría (cascada a sub_categoria y Articulos) ──────────────

CREATE OR ALTER PROCEDURE dbo.sp_comedor_categorias_editar
    @categoria_actual VARCHAR(50),
    @categoria_nueva  VARCHAR(50)
AS
BEGIN
    SET NOCOUNT ON;

    BEGIN TRY

        IF LEN(LTRIM(RTRIM(ISNULL(@categoria_nueva, '')))) = 0
        BEGIN
            SELECT '{"Estado":"ERROR","Mensaje":"El nuevo nombre de la categoria es requerido."}';
            RETURN;
        END;

        IF NOT EXISTS (SELECT 1 FROM dbo.categoria WHERE Categoria = @categoria_actual)
        BEGIN
            SELECT '{"Estado":"ERROR","Mensaje":"No existe una categoria con ese nombre."}';
            RETURN;
        END;

        IF @categoria_actual <> @categoria_nueva
           AND EXISTS (SELECT 1 FROM dbo.categoria WHERE Categoria = @categoria_nueva)
        BEGIN
            SELECT '{"Estado":"ERROR","Mensaje":"Ya existe otra categoria con el nuevo nombre."}';
            RETURN;
        END;

        BEGIN TRANSACTION;

            UPDATE dbo.categoria
            SET Categoria = @categoria_nueva
            WHERE Categoria = @categoria_actual;

            UPDATE dbo.sub_categoria
            SET Categoria = @categoria_nueva
            WHERE Categoria = @categoria_actual;

            UPDATE dbo.Articulos
            SET Categoria = @categoria_nueva
            WHERE Categoria = @categoria_actual;

        COMMIT TRANSACTION;

        SELECT '{"Estado":"OK","Mensaje":"Categoria renombrada correctamente."}';

    END TRY
    BEGIN CATCH

        IF XACT_STATE() <> 0 ROLLBACK TRANSACTION;

        SELECT '{"Estado":"ERROR","Mensaje":"'
               + REPLACE(REPLACE(ERROR_MESSAGE(), '\', '\\'), '"', '\"')
               + '"}';

    END CATCH;
END;
GO


-- ── 4. Eliminar categoría (bloqueada si tiene artículos asociados) ────────────

CREATE OR ALTER PROCEDURE dbo.sp_comedor_categorias_eliminar
    @categoria VARCHAR(50)
AS
BEGIN
    SET NOCOUNT ON;

    BEGIN TRY

        IF NOT EXISTS (SELECT 1 FROM dbo.categoria WHERE Categoria = @categoria)
        BEGIN
            SELECT '{"Estado":"ERROR","Mensaje":"No existe una categoria con ese nombre."}';
            RETURN;
        END;

        DECLARE @en_uso INT;
        SELECT @en_uso = COUNT(*) FROM dbo.Articulos WHERE Categoria = @categoria;

        IF @en_uso > 0
        BEGIN
            SELECT '{"Estado":"ERROR","Mensaje":"No se puede eliminar: hay '
                   + CAST(@en_uso AS VARCHAR(20))
                   + ' articulo(s) asociado(s) a esta categoria."}';
            RETURN;
        END;

        BEGIN TRANSACTION;

            -- Ninguna subcategoria de esta categoria puede estar en uso si
            -- @en_uso = 0 arriba (todo articulo con esa Categoria ya se
            -- habria contado), asi que se pueden borrar sin chequeo aparte.
            DELETE FROM dbo.sub_categoria WHERE Categoria = @categoria;
            DELETE FROM dbo.categoria     WHERE Categoria = @categoria;

        COMMIT TRANSACTION;

        SELECT '{"Estado":"OK","Mensaje":"Categoria eliminada correctamente."}';

    END TRY
    BEGIN CATCH

        IF XACT_STATE() <> 0 ROLLBACK TRANSACTION;

        SELECT '{"Estado":"ERROR","Mensaje":"'
               + REPLACE(REPLACE(ERROR_MESSAGE(), '\', '\\'), '"', '\"')
               + '"}';

    END CATCH;
END;
GO


-- ── Prueba rápida (descomentá para verificar) ─────────────────────────────────
/*
EXEC dbo.sp_comedor_categorias_listar;
EXEC dbo.sp_comedor_categorias_crear @categoria = 'Bebidas';
EXEC dbo.sp_comedor_categorias_editar @categoria_actual = 'Bebidas', @categoria_nueva = 'Bebidas Frías';
EXEC dbo.sp_comedor_categorias_eliminar @categoria = 'Bebidas Frías';
*/
