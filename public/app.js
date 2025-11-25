$(function () {
  // VARIABLES GLOBALES
  const $resultados = $("#resultados");
  const $playlist = $("#playlist");
  const $favoritos = $("#favoritos");
  const $paginacion = $("#paginacion");

  let listaResultadosActual = [];
  let pagina = 1;
  const limite = 6;

  // FUNCIONES AUXILIARES
  const mostrarAlerta = (titulo, tipo) => {
    Swal.fire({
      title: titulo,
      icon: tipo,
      toast: true,
      position: "top-end",
      timer: 2000,
      showConfirmButton: false,
    });
  };

  // Función reutilizable para confirmar acciones
  const confirmarAccion = (titulo, callbackAccion) => {
    Swal.fire({
      title: titulo,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#3085d6",
      confirmButtonText: "Sí, eliminar",
      cancelButtonText: "Cancelar",
    }).then((result) => {
      if (result.isConfirmed) {
        callbackAccion();
      }
    });
  };

  // Generar HTML de estrellas
  function crearEstrellas(trackId) {
    return `
      <div class="contenedor-estrellas" data-id="${trackId}">
        <div class="estrellas-box">
          <span class="estrella" data-val="1">★</span>
          <span class="estrella" data-val="2">★</span>
          <span class="estrella" data-val="3">★</span>
          <span class="estrella" data-val="4">★</span>
          <span class="estrella" data-val="5">★</span>
        </div>
        <small class="texto-promedio">Sin votos</small>
      </div>
    `;
  }

  // LÓGICA DE BÚSQUEDA
  const buscarMusica = (texto) => {
    $resultados.html(
      '<div class="loading-message"><div class="spinner"></div><p>Buscando...</p></div>'
    );
    const url = `https://itunes.apple.com/search?term=${encodeURIComponent(
      texto
    )}&entity=song&limit=60&callback=?`;

    $.getJSON(url)
      .done((datos) => {
        listaResultadosActual = datos.results || [];
        pagina = 1;
        mostrarPagina();
      })
      .fail(() => {
        $resultados.html("<p>Hubo un error al buscar.</p>");
      });
  };

  const mostrarPagina = () => {
    if (listaResultadosActual.length === 0) {
      $resultados.html(
        "<div class='empty-message'>No se encontraron canciones.</div>"
      );
      return;
    }

    const inicio = (pagina - 1) * limite;
    const fin = inicio + limite;
    const cancionesPagina = listaResultadosActual.slice(inicio, fin);

    let htmlAcumulado = "";
    let idsCalificar = [];

    $.each(cancionesPagina, function (i, cancion) {
      const id = cancion.trackId;
      const titulo = cancion.trackName;
      const artista = cancion.artistName;
      const imagen = cancion.artworkUrl100.replace("100x100bb", "600x600bb");
      const audio = cancion.previewUrl;

      let claseFavorito = "";
      const misFavoritos = obtenerFavoritosStorage();

      // Verificar favoritos
      if (misFavoritos.some((fav) => fav.trackId == id)) {
        claseFavorito = "activo";
      }

      htmlAcumulado += `
        <div class="tarjeta-cancion">
          <img src="${imagen}" alt="Portada">
          <div class="informacion">
            <b>${titulo}</b>
            <small>${artista}</small>
            <audio controls src="${audio}"></audio>
            ${crearEstrellas(id)}
          </div>
          <div class="botones">
            <button class="btn-playlist" data-id="${id}" title="Agregar a Playlist"><i class="fa-solid fa-plus"></i></button>
            <button class="btn-favorito ${claseFavorito}" data-id="${id}" title="Favoritos"><i class="fa-solid fa-heart"></i></button>
          </div>
        </div>
      `;
      idsCalificar.push(id);
    });

    // Efecto visual de carga
    $resultados.hide().html(htmlAcumulado).fadeIn(400);

    // Iterar IDs
    $.each(idsCalificar, function (i, id) {
      cargarCalificacion(id);
    });
    actualizarBtnsPag();

    if ($resultados.offset()) {
      $("html, body").animate(
        { scrollTop: $resultados.offset().top - 20 },
        300
      );
    }
  };

  const actualizarBtnsPag = () => {
    $paginacion.empty();
    const totalPaginas = Math.ceil(listaResultadosActual.length / limite);

    if (totalPaginas > 1) {
      for (let i = 1; i <= totalPaginas; i++) {
        const clase = i === pagina ? "btn-primary" : "";
        $paginacion.append(
          `<button class="${clase}" data-pag="${i}">${i}</button>`
        );
      }
    }
  };

  // LÓGICA DE PLAYLIST
  const cargarPlaylistGlobal = () => {
    $.get("/api/playlist", (datos) => {
      $playlist.empty();
      if (datos.length === 0) {
        $playlist.append("<small>La playlist está vacía.</small>");
        return;
      }

      $.each(datos, function (i, item) {
        const imagenHD = item.artwork_url.replace("100x100bb", "600x600bb");
        const html = `
        <div class="tarjeta-cancion-horizontal">
            <img src="${imagenHD}" class="portada">
            <div class="info-cancion">
              <div><b>${item.track_name}</b><small>${
          item.artist_name
        }</small></div>
              <audio controls src="${item.preview_url}"></audio>
              ${crearEstrellas(item.track_id)}
            </div>
            <button class="btn-eliminar-playlist btn-eliminar" data-db-id="${
              item.id
            }"><i class="fa-solid fa-xmark"></i></button>
          </div>
        `;
        $playlist.append(html);
        cargarCalificacion(item.track_id);
      });
    });
  };

  // LÓGICA DE FAVORITOS
  const obtenerFavoritosStorage = () => {
    const guardados = localStorage.getItem("favoritos");
    return guardados ? JSON.parse(guardados) : [];
  };

  const mostrarFavoritos = () => {
    const lista = obtenerFavoritosStorage();
    $favoritos.empty();

    if (lista.length === 0) {
      $favoritos.append("<small>No tienes favoritos.</small>");
      return;
    }

    $.each(lista, function (i, item) {
      const imagenHD = item.artworkUrl100.replace("100x100bb", "600x600bb");
      const html = `
      <div class="tarjeta-cancion-horizontal">
        <img src="${imagenHD}" class="portada">
        <div class="info-cancion">
          <div><b>${item.trackName}</b><small>${item.artistName}</small></div>
        <audio controls src="${item.previewUrl}"></audio>
        </div>
        <button class="btn-eliminar-favorito btn-eliminar" data-id="${item.trackId}">
            <i class="fa-solid fa-xmark"></i>
        </button>
      </div>
`;
      $favoritos.append(html);
    });
  };

  // LÓGICA DE CALIFICACIONES
  const cargarCalificacion = (trackId) => {
    $.get(`/api/rating/${trackId}`, (res) => {
      const $cajas = $(`.contenedor-estrellas[data-id="${trackId}"]`);

      if (res.rating_count > 0) {
        const promedio = (res.rating_sum / res.rating_count).toFixed(1);
        $cajas
          .find(".texto-promedio")
          .html(`<b>${promedio} ★</b> (${res.rating_count})`);

        $cajas.find(".estrella").each(function () {
          const valorEstrella = $(this).data("val");
          $(this).toggleClass("activo", valorEstrella <= Math.round(promedio));
        });
      }
    });
  };

  // EVENTOS
  // Buscador
  let tiempoEspera;
  $("#buscar").on("keyup", function () {
    const texto = $(this).val();
    clearTimeout(tiempoEspera);

    // Limpiar todo si está vacío
    if (texto.length < 2) {
      $resultados.empty();
      $paginacion.empty();
      listaResultadosActual = [];
      return;
    }

    tiempoEspera = setTimeout(() => {
      buscarMusica(texto);
    }, 500);
  });

  // Paginación
  $paginacion.on("click", "button", function () {
    pagina = $(this).data("pag");
    mostrarPagina();
  });

  // Agregar a playlist
  $resultados.on("click", ".btn-playlist", function () {
    const id = $(this).data("id");
    const cancion = listaResultadosActual.find((c) => c.trackId == id);

    if (cancion) {
      $.post("/api/playlist", {
        track_id: cancion.trackId,
        track_name: cancion.trackName,
        artist_name: cancion.artistName,
        artwork_url: cancion.artworkUrl100,
        preview_url: cancion.previewUrl,
      })
        .done(() => {
          mostrarAlerta("Agregada a la playlist", "success");
          cargarPlaylistGlobal();
        })
        .fail(() => {
          mostrarAlerta("Error o ya existe en la playlist", "info");
        });
    }
  });

  // Eliminar de playlist + SweetAlert
  $playlist.on("click", ".btn-eliminar-playlist", function () {
    const idDb = $(this).data("db-id");

    confirmarAccion("¿Eliminar de Playlist Global?", function () {
      $.ajax({
        url: `/api/playlist/${idDb}`,
        type: "DELETE",
        success: function () {
          cargarPlaylistGlobal();
          mostrarAlerta("Eliminada", "success");
        },
      });
    });
  });

  // Agregar o quitar favoritos
  $resultados.on("click", ".btn-favorito", function () {
    const id = $(this).data("id");
    const cancion = listaResultadosActual.find((c) => c.trackId == id);
    let favoritos = obtenerFavoritosStorage();

    const existe = favoritos.find((f) => f.trackId == id);

    if (existe) {
      favoritos = favoritos.filter((f) => f.trackId != id);
      mostrarAlerta("Eliminado de favoritos", "info");
      $(this).removeClass("activo");
    } else {
      favoritos.push(cancion);
      mostrarAlerta("Guardado en favoritos", "success");
      $(this).addClass("activo");
    }

    localStorage.setItem("favoritos", JSON.stringify(favoritos));
    mostrarFavoritos();
  });

  // Eliminar desde favoritos + SweetAlert
  $favoritos.on("click", ".btn-eliminar-favorito", function () {
    const id = $(this).data("id");

    confirmarAccion("¿Eliminar de tus favoritos?", function () {
      let favoritos = obtenerFavoritosStorage();
      favoritos = favoritos.filter((f) => f.trackId != id);
      localStorage.setItem("favoritos", JSON.stringify(favoritos));
      mostrarFavoritos();
      mostrarPagina();
      mostrarAlerta("Eliminado", "info");
    });
  });

  // Calificar con estrellas
  $(document).on("click", ".estrella", function () {
    const valor = $(this).data("val");
    const trackId = $(this).closest(".contenedor-estrellas").data("id");

    $.post("/api/rate", { track_id: trackId, rating: valor }).done(() => {
      mostrarAlerta("Calificación guardada", "success");
      $(`.contenedor-estrellas[data-id="${trackId}"]`).each(function () {
        cargarCalificacion(trackId);
      });
    });
  });

  // Lógica de botón flotante
  $("#cloud-toggle-btn").on("click", function () {
    const $menu = $("#cloud-content");
    const $btn = $(this);

    // Toggle de clases y texto
    if ($menu.hasClass("active")) {
      $menu.removeClass("active");
      $btn.html("<span>Enlaces a la nube</span>");
      $btn.css("background-color", "#4a90e2");
    } else {
      $menu.addClass("active");
      $btn.html("<span>✖</span>");
      $btn.css("background-color", "#aa1919");
    }
  });

  // Inicializar
  cargarPlaylistGlobal();
  mostrarFavoritos();
});
