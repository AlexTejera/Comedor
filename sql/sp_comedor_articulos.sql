/*
================================================================================
  SISTEMA COMEDOR — Aluminios del Uruguay
  Script:  sp_comedor_articulos.sql
  Base:    SUMMA  (SQL Server 2016+, cualquier nivel de compatibilidad)
  Autor:   Sistema Comedor / atejera
  Fecha:   2026-09-15
================================================================================

TABLA
─────
  dbo.Articulos
  Columnas:
    Articulo_consumo  VARCHAR(50)     → código de artículo (clave natural,
                                         referenciada por dbo.Consumo_v1)
    nombre_articulo   VARCHAR(50)
    descripcion       VARCHAR(300)
    Categoria         VARCHAR(50)     → debe existir en dbo.categoria
    sub_categoria     VARCHAR(50)     → debe existir en dbo.sub_categoria
                                         para esa Categoria
    precio            DECIMAL(10,4)

REGLA DE NEGOCIO IMPORTANTE
────────────────────────────
  Articulo_consumo (código) y nombre_articulo son INMUTABLES una vez creado
  el artículo — evita romper la trazabilidad contable de consumos ya
  registrados en dbo.Consumo_v1. sp_comedor_articulos_editar por eso NO
  recibe @nombre ni permite cambiar el código: solo descripción, categoría,
  subcategoría y precio.

  Por la misma razón, sp_comedor_articulos_eliminar bloquea el borrado si
  el artículo tiene consumos registrados en dbo.Consumo_v1 (en cualquier
  estado) — solo se puede eliminar un artículo que nunca se consumió.

SPs EN ESTE SCRIPT
───────────────────
  sp_comedor_articulos_listar()
  sp_comedor_articulos_crear(@codigo, @nombre, @descripcion, @categoria, @sub_categoria, @precio)
  sp_comedor_articulos_editar(@codigo, @descripcion, @categoria, @sub_categoria, @precio)
  sp_comedor_articulos_eliminar(@codigo)

RESPUESTA (primera fila, primera columna — string JSON)
───────────────────────────────────────────────────────
  listar   : array de artículos: [{"codigo":"...","nombre":"...", ...}, ...]
             (array vacío "[]" si no hay artículos — nunca NULL)
  crear/editar/eliminar : {"Estado":"OK"|"ERROR","Mensaje":"..."}

NOTA: El backend Python hace json.loads(row[0]) con este resultado.
================================================================================
*/


-- ── 1. Listar todos los artículos ─────────────────────────────────────────────

IF OBJECT_ID('dbo.sp_comedor_articulos_listar', 'P') IS NOT NULL
    DROP PROCEDURE dbo.sp_comedor_articulos_listar;
GO

CREATE PROCEDURE dbo.sp_comedor_articulos_listar
AS
BEGIN
    SET NOCOUNT ON;

    BEGIN TRY

        SELECT ISNULL((
            SELECT
                Articulo_consumo AS codigo,
                nombre_articulo  AS nombre,
                descripcion,
                Categoria        AS categoria,
                sub_categoria    AS subCategoria,
                precio
            FROM dbo.Articulos
            ORDER BY nombre_articulo
            FOR JSON PATH
        ), '[]');

    END TRY
    BEGIN CATCH

        -- Un error acá no tiene el mismo shape {"Estado":...} porque el
        -- backend espera directamente un array para "listar". Se retorna
        -- un array vacío y se loguea del lado de SQL Server con THROW,
        -- para que el backend lo detecte como error de comunicación ODBC
        -- en vez de interpretarlo como "0 artículos".
        THROW;

    END CATCH;
END;
GO


-- ── 2. Crear un artículo ───────────────────────────────────────────────────────

CREATE OR ALTER PROCEDURE dbo.sp_comedor_articulos_crear
    @codigo       VARCHAR(50),
    @nombre       VARCHAR(50),
    @descripcion  VARCHAR(300),
    @categoria    VARCHAR(50),
    @sub_categoria VARCHAR(50),
    @precio       DECIMAL(10,4)
AS
BEGIN
    SET NOCOUNT ON;

    BEGIN TRY

        IF LEN(LTRIM(RTRIM(ISNULL(@codigo, '')))) = 0
        BEGIN
            SELECT '{"Estado":"ERROR","Mensaje":"El codigo del articulo es requerido."}';
            RETURN;
        END;

        IF LEN(LTRIM(RTRIM(ISNULL(@nombre, '')))) = 0
        BEGIN
            SELECT '{"Estado":"ERROR","Mensaje":"El nombre del articulo es requerido."}';
            RETURN;
        END;

        IF EXISTS (SELECT 1 FROM dbo.Articulos WHERE Articulo_consumo = @codigo)
        BEGIN
            SELECT '{"Estado":"ERROR","Mensaje":"Ya existe un articulo con ese codigo."}';
            RETURN;
        END;

        -- Validar que la categoria/subcategoria existan (referencial "a mano",
        -- ya que Articulos.Categoria/sub_categoria son texto libre sin FK real).
        IF NOT EXISTS (SELECT 1 FROM dbo.categoria WHERE Categoria = @categoria)
        BEGIN
            SELECT '{"Estado":"ERROR","Mensaje":"La categoria indicada no existe."}';
            RETURN;
        END;

        IF NOT EXISTS (
            SELECT 1 FROM dbo.sub_categoria
            WHERE Categoria = @categoria AND sub_categoria = @sub_categoria
        )
        BEGIN
            SELECT '{"Estado":"ERROR","Mensaje":"La subcategoria indicada no existe para esa categoria."}';
            RETURN;
        END;

        INSERT INTO dbo.Articulos
            (Articulo_consumo, nombre_articulo, descripcion, Categoria, sub_categoria, precio)
        VALUES
            (@codigo, @nombre, @descripcion, @categoria, @sub_categoria, ISNULL(@precio, 0));

        SELECT '{"Estado":"OK","Mensaje":"Articulo creado correctamente."}';

    END TRY
    BEGIN CATCH

        SELECT '{"Estado":"ERROR","Mensaje":"'
               + REPLACE(REPLACE(ERROR_MESSAGE(), '\', '\\'), '"', '\"')
               + '"}';

    END CATCH;
END;
GO


-- ── 3. Editar un artículo (NO permite cambiar codigo ni nombre) ────────────────

CREATE OR ALTER PROCEDURE dbo.sp_comedor_articulos_editar
    @codigo        VARCHAR(50),
    @descripcion   VARCHAR(300),
    @categoria     VARCHAR(50),
    @sub_categoria VARCHAR(50),
    @precio        DECIMAL(10,4)
AS
BEGIN
    SET NOCOUNT ON;

    BEGIN TRY

        IF NOT EXISTS (SELECT 1 FROM dbo.Articulos WHERE Articulo_consumo = @codigo)
        BEGIN
            SELECT '{"Estado":"ERROR","Mensaje":"No existe un articulo con ese codigo."}';
            RETURN;
        END;

        IF NOT EXISTS (SELECT 1 FROM dbo.categoria WHERE Categoria = @categoria)
        BEGIN
            SELECT '{"Estado":"ERROR","Mensaje":"La categoria indicada no existe."}';
            RETURN;
        END;

        IF NOT EXISTS (
            SELECT 1 FROM dbo.sub_categoria
            WHERE Categoria = @categoria AND sub_categoria = @sub_categoria
        )
        BEGIN
            SELECT '{"Estado":"ERROR","Mensaje":"La subcategoria indicada no existe para esa categoria."}';
            RETURN;
        END;

        UPDATE dbo.Articulos
        SET descripcion   = @descripcion,
            Categoria     = @categoria,
            sub_categoria = @sub_categoria,
            precio        = ISNULL(@precio, 0)
        WHERE Articulo_consumo = @codigo;

        SELECT '{"Estado":"OK","Mensaje":"Articulo actualizado correctamente."}';

    END TRY
    BEGIN CATCH

        SELECT '{"Estado":"ERROR","Mensaje":"'
               + REPLACE(REPLACE(ERROR_MESSAGE(), '\', '\\'), '"', '\"')
               + '"}';

    END CATCH;
END;
GO


-- ── 4. Eliminar un artículo (bloqueado si tiene consumos registrados) ──────────

CREATE OR ALTER PROCEDURE dbo.sp_comedor_articulos_eliminar
    @codigo VARCHAR(50)
AS
BEGIN
    SET NOCOUNT ON;

    BEGIN TRY

        IF NOT EXISTS (SELECT 1 FROM dbo.Articulos WHERE Articulo_consumo = @codigo)
        BEGIN
            SELECT '{"Estado":"ERROR","Mensaje":"No existe un articulo con ese codigo."}';
            RETURN;
        END;

        DECLARE @consumos INT;
        SELECT @consumos = COUNT(*) FROM dbo.Consumo_v1 WHERE Articulo_consumo = @codigo;

        IF @consumos > 0
        BEGIN
            SELECT '{"Estado":"ERROR","Mensaje":"No se puede eliminar: el articulo tiene '
                   + CAST(@consumos AS VARCHAR(20))
                   + ' consumo(s) registrado(s) en el historial."}';
            RETURN;
        END;

        DELETE FROM dbo.Articulos WHERE Articulo_consumo = @codigo;

        SELECT '{"Estado":"OK","Mensaje":"Articulo eliminado correctamente."}';

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
EXEC dbo.sp_comedor_articulos_listar;

EXEC dbo.sp_comedor_articulos_crear
    @codigo = 'AGUA500', @nombre = 'Agua 500ml', @descripcion = 'Botella de agua sin gas',
    @categoria = 'Bebidas', @sub_categoria = 'Aguas', @precio = 45.00;

EXEC dbo.sp_comedor_articulos_editar
    @codigo = 'AGUA500', @descripcion = 'Botella de agua sin gas 500ml',
    @categoria = 'Bebidas', @sub_categoria = 'Aguas', @precio = 48.00;

EXEC dbo.sp_comedor_articulos_eliminar @codigo = 'AGUA500';
*/
