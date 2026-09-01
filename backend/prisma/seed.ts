import { PrismaClient, IconoCategoria, ColorCategoria, TipoCategoria } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const categorias = [
    { id: "cat-comida", nombre: "Comida", icono: IconoCategoria.SUPER, color: ColorCategoria.NARANJA, tipo: TipoCategoria.GASTO },
    { id: "cat-transporte", nombre: "Transporte", icono: IconoCategoria.CARRO, color: ColorCategoria.AZUL, tipo: TipoCategoria.GASTO },
    { id: "cat-renta", nombre: "Renta", icono: IconoCategoria.CASA, color: ColorCategoria.VERDE, tipo: TipoCategoria.GASTO },
    { id: "cat-servicios", nombre: "Servicios", icono: IconoCategoria.TELEFONO, color: ColorCategoria.INDIGO, tipo: TipoCategoria.GASTO },
    { id: "cat-ocio", nombre: "Ocio", icono: IconoCategoria.OCULOS, color: ColorCategoria.VIOLETA, tipo: TipoCategoria.GASTO },
    { id: "cat-deudas", nombre: "Deudas", icono: IconoCategoria.LLAVE, color: ColorCategoria.ROJO, tipo: TipoCategoria.GASTO },
    { id: "cat-otros", nombre: "Otros", icono: IconoCategoria.OTRO, color: ColorCategoria.BLANCO, tipo: TipoCategoria.GASTO },
    { id: "cat-vivienda", nombre: "Vivienda", icono: IconoCategoria.CASA, color: ColorCategoria.VERDE, tipo: TipoCategoria.GASTO },
    { id: "cat-salud", nombre: "Salud", icono: IconoCategoria.GIMNASIO, color: ColorCategoria.TURQUESA, tipo: TipoCategoria.GASTO },
    { id: "cat-educacion", nombre: "Educación", icono: IconoCategoria.LIBROS, color: ColorCategoria.AMARILLO, tipo: TipoCategoria.GASTO },
    { id: "cat-ingresos", nombre: "Ingresos", icono: IconoCategoria.LIBROS, color: ColorCategoria.VERDE, tipo: TipoCategoria.INGRESO },
    { id: "cat-sueldo", nombre: "Sueldo", icono: IconoCategoria.LIBROS, color: ColorCategoria.VERDE, tipo: TipoCategoria.INGRESO },
    { id: "cat-freelance", nombre: "Freelance", icono: IconoCategoria.AVION, color: ColorCategoria.AZUL, tipo: TipoCategoria.INGRESO },
    { id: "cat-otros-ingreso", nombre: "Otros", icono: IconoCategoria.OTRO, color: ColorCategoria.BLANCO, tipo: TipoCategoria.INGRESO },
  ];

  for (const cat of categorias) {
    await prisma.categoria.upsert({
      where: { id: cat.id },
      update: {
        nombre: cat.nombre,
        icono: cat.icono,
        color: cat.color,
        tipo: cat.tipo,
        activa: cat.id === "cat-renta" ? false : true,
      },
      create: {
        id: cat.id,
        nombre: cat.nombre,
        icono: cat.icono,
        color: cat.color,
        tipo: cat.tipo,
        activa: cat.id === "cat-renta" ? false : true,
      },
    });
  }

  console.log("Categorías sembradas correctamente");

  const subcategorias = [
    { nombre: "Despensa", categoriaId: "cat-comida" },
    { nombre: "Restaurante", categoriaId: "cat-comida" },
    { nombre: "Delivery", categoriaId: "cat-comida" },
    { nombre: "Supermercado", categoriaId: "cat-comida" },
    { nombre: "Kiosco", categoriaId: "cat-comida" },
    { nombre: "Cafetería", categoriaId: "cat-comida" },
    { nombre: "Antojitos", categoriaId: "cat-comida" },
    { nombre: "Mercado", categoriaId: "cat-comida" },

    { nombre: "Nafta", categoriaId: "cat-transporte" },
    { nombre: "Combustible", categoriaId: "cat-transporte" },
    { nombre: "Colectivo", categoriaId: "cat-transporte" },
    { nombre: "SUBE", categoriaId: "cat-transporte" },
    { nombre: "Uber", categoriaId: "cat-transporte" },
    { nombre: "Cabify", categoriaId: "cat-transporte" },
    { nombre: "Estacionamiento", categoriaId: "cat-transporte" },
    { nombre: "Peajes", categoriaId: "cat-transporte" },
    { nombre: "Mantenimiento", categoriaId: "cat-transporte" },
    { nombre: "Service", categoriaId: "cat-transporte" },
    { nombre: "Seguro vehicular", categoriaId: "cat-transporte" },
    { nombre: "Patente", categoriaId: "cat-transporte" },

    { nombre: "Alquiler", categoriaId: "cat-vivienda" },
    { nombre: "Expensas", categoriaId: "cat-vivienda" },
    { nombre: "ABL", categoriaId: "cat-vivienda" },
    { nombre: "Impuesto municipal", categoriaId: "cat-vivienda" },
    { nombre: "Mantenimiento hogar", categoriaId: "cat-vivienda" },
    { nombre: "Seguro del hogar", categoriaId: "cat-vivienda" },

    { nombre: "Luz", categoriaId: "cat-servicios" },
    { nombre: "Gas", categoriaId: "cat-servicios" },
    { nombre: "Agua", categoriaId: "cat-servicios" },
    { nombre: "Internet", categoriaId: "cat-servicios" },
    { nombre: "Teléfono", categoriaId: "cat-servicios" },
    { nombre: "Celular", categoriaId: "cat-servicios" },
    { nombre: "Streaming", categoriaId: "cat-servicios" },
    { nombre: "Prepaga", categoriaId: "cat-servicios" },
    { nombre: "Obra social", categoriaId: "cat-servicios" },
    { nombre: "Seguro", categoriaId: "cat-servicios" },
    { nombre: "Suscripciones", categoriaId: "cat-servicios" },

    { nombre: "Cine", categoriaId: "cat-ocio" },
    { nombre: "Concierto", categoriaId: "cat-ocio" },
    { nombre: "Deportes", categoriaId: "cat-ocio" },
    { nombre: "Viajes", categoriaId: "cat-ocio" },
    { nombre: "Salidas", categoriaId: "cat-ocio" },
    { nombre: "Juegos", categoriaId: "cat-ocio" },

    { nombre: "Cuota tarjeta", categoriaId: "cat-deudas" },
    { nombre: "Costo financiero tarjeta", categoriaId: "cat-deudas" },
    { nombre: "Préstamo personal", categoriaId: "cat-deudas" },
    { nombre: "Préstamo prendario", categoriaId: "cat-deudas" },
    { nombre: "Préstamo hipotecario", categoriaId: "cat-deudas" },
    { nombre: "Pago mínimo pendiente", categoriaId: "cat-deudas" },

    { nombre: "Salud", categoriaId: "cat-otros" },
    { nombre: "Farmacia", categoriaId: "cat-otros" },
    { nombre: "Educación", categoriaId: "cat-otros" },
    { nombre: "Mascotas", categoriaId: "cat-otros" },
    { nombre: "Regalos", categoriaId: "cat-otros" },
    { nombre: "Ropa", categoriaId: "cat-otros" },
    { nombre: "Indumentaria", categoriaId: "cat-otros" },
    { nombre: "Belleza", categoriaId: "cat-otros" },
    { nombre: "Cuidado personal", categoriaId: "cat-otros" },
    { nombre: "Donaciones", categoriaId: "cat-otros" },
    { nombre: "Salud", categoriaId: "cat-salud" },
    { nombre: "Farmacia", categoriaId: "cat-salud" },
    { nombre: "Educación", categoriaId: "cat-educacion" },

    { nombre: "Sueldo en blanco", categoriaId: "cat-sueldo" },
    { nombre: "Aguinaldo", categoriaId: "cat-sueldo" },
    { nombre: "Bono", categoriaId: "cat-sueldo" },
    { nombre: "Premio", categoriaId: "cat-sueldo" },
    { nombre: "Reembolso", categoriaId: "cat-sueldo" },

    { nombre: "Proyecto", categoriaId: "cat-freelance" },
    { nombre: "Cliente", categoriaId: "cat-freelance" },
    { nombre: "Honorarios", categoriaId: "cat-freelance" },

    { nombre: "Venta de artículos", categoriaId: "cat-otros-ingreso" },
    { nombre: "Reintegro", categoriaId: "cat-otros-ingreso" },
    { nombre: "Devolución", categoriaId: "cat-otros-ingreso" },
    { nombre: "Regalo recibido", categoriaId: "cat-otros-ingreso" },
    { nombre: "Alquiler cobrado", categoriaId: "cat-otros-ingreso" },
    { nombre: "Intereses", categoriaId: "cat-otros-ingreso" },
    { nombre: "Rendimientos", categoriaId: "cat-otros-ingreso" },
    { nombre: "Préstamo recibido", categoriaId: "cat-otros-ingreso" },
    { nombre: "Varios", categoriaId: "cat-otros-ingreso" },
  ];

  for (const sub of subcategorias) {
    await prisma.subcategoria.upsert({
      where: { categoriaId_nombre: { categoriaId: sub.categoriaId, nombre: sub.nombre } },
      update: {},
      create: {
        nombre: sub.nombre,
        categoriaId: sub.categoriaId,
      },
    });
  }

  await prisma.subcategoria.updateMany({
    where: {
      categoriaId: "cat-renta",
      activa: true,
    },
    data: { activa: false },
  });

  await prisma.subcategoria.updateMany({
    where: {
      categoriaId: "cat-otros",
      nombre: { in: ["Salud", "Farmacia", "Educación"] },
      activa: true,
    },
    data: { activa: false },
  });

  await prisma.subcategoria.updateMany({
    where: {
      categoriaId: "cat-servicios",
      nombre: "Streaming",
      activa: true,
    },
    data: { activa: false },
  });

  await prisma.subcategoria.updateMany({
    where: {
      categoriaId: "cat-transporte",
      nombre: "Patente",
      activa: true,
    },
    data: { activa: false },
  });

  console.log("Subcategorías sembradas correctamente");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
