$(function () {
  // --- VARIABLES GLOBALES ---
  const $resultados = $("#resultados");
  const $playlist = $("#playlist");
  const $favoritos = $("#favoritos");
  const $paginacion = $("#paginacion");

  let listaResultadosActual = [];
  let pagina = 1;
  const limite = 6;

  // --- FUNCIONES AUXILIARES ---
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

  const confirmarAccion = (titulo, callbackAccion) => {
    Swal.fire({
      title: titulo,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#3085d6",
      confirmButtonText: "Sí, continuar",
      cancelButtonText: "Cancelar",
    }).then((result) => {
      if (result.isConfirmed) {
        callbackAccion();
      }
    });
  };

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

  // --- FUNCIÓN MOSTRAR FORMULARIO  ---
  const mostrarFormulario = (modo, datos = {}) => {
    const esEdicion = modo === "editar";
    const origenActual = datos.origen || "playlist";

    const htmlDestino = `
         <select id="swal-destino" class="swal2-input" style="background:#2a2a2a; color:white;">
           <option value="playlist" ${
             origenActual === "playlist" ? "selected" : ""
           }>Guardar en Playlist Global</option>
           <option value="favoritos" ${
             origenActual === "favoritos" ? "selected" : ""
           }>Guardar en Mis Favoritos</option>
         </select>`;

    Swal.fire({
      title: esEdicion ? "Editar canción" : "Crear nueva canción",
      html: `
        ${htmlDestino}

        <p style="font-size: 12px; color: #888; margin-bottom: 15px;">
           <i class="fa-solid"></i> Nota: Solo las canciones creadas manualmente pueden editarse.
        </p>

        <input id="swal-titulo" class="swal2-input" placeholder="Título de la canción" value="${
          datos.track_name || ""
        }">
        <input id="swal-artista" class="swal2-input" placeholder="Nombre del artista" value="${
          datos.artist_name || ""
        }">
        <input id="swal-img" class="swal2-input" placeholder="URL de Imagen (Opcional)" value="${
          datos.artwork_url || ""
        }">
      `,
      focusConfirm: false,
      showCancelButton: true,
      confirmButtonText: "Guardar",
      cancelButtonText: "Cancelar",
      preConfirm: () => {
        const titulo = document.getElementById("swal-titulo").value;
        const artista = document.getElementById("swal-artista").value;
        const img = document.getElementById("swal-img").value;
        const destino = document.getElementById("swal-destino").value;

        if (!titulo || !artista) {
          Swal.showValidationMessage("Por favor escribe título y artista");
          return false;
        }
        return { titulo, artista, img, destino };
      },
    }).then((result) => {
      if (result.isConfirmed) {
        const form = result.value;
        const imagenFinal =
          form.img || "https://cdn-icons-png.flaticon.com/512/461/461238.png";

        // CORRECCIÓN CRÍTICA:
        // Buscamos datos.id primero (que es lo que enviamos desde Favoritos)
        // Si no, datos.track_id (si venimos de otro lado)
        // Si no, generamos uno nuevo.
        const trackIdFinal =
          datos.id ||
          datos.track_id ||
          "manual_" + Math.floor(Math.random() * 100000);

        // CASO 1: MIGRACIÓN (Cambió el destino al editar)
        if (esEdicion && form.destino !== origenActual) {
          // A) Mover de FAVORITOS -> PLAYLIST
          if (origenActual === "favoritos" && form.destino === "playlist") {
            $.post("/api/playlist", {
              track_id: trackIdFinal,
              track_name: form.titulo,
              artist_name: form.artista,
              artwork_url: imagenFinal,
              preview_url: "",
            }).done(() => {
              // Borrar de LocalStorage
              let favs = obtenerFavoritosStorage();
              // Usamos String() para asegurar que la comparación funcione
              favs = favs.filter(
                (f) => String(f.trackId || f.track_id) !== String(trackIdFinal)
              );
              localStorage.setItem("favoritos", JSON.stringify(favs));

              mostrarAlerta("Movida a Playlist Global", "success");
              cargarPlaylistGlobal();
              mostrarFavoritos();
            });
          }

          // B) Mover de PLAYLIST -> FAVORITOS
          else if (
            origenActual === "playlist" &&
            form.destino === "favoritos"
          ) {
            // Borrar de BD (Usamos el ID numérico datos.id)
            $.ajax({
              url: `/api/playlist/${datos.id}`,
              type: "DELETE",
              success: () => {
                // Crear en LocalStorage
                let favs = obtenerFavoritosStorage();
                // Importante: al mover a favoritos, usamos el track_id original, no el ID numérico de la BD
                // datos.track_id contiene el identificador de la canción (ej: manual_123 o 45812...)
                const idParaGuardar = datos.track_id || trackIdFinal;

                favs.push({
                  trackId: idParaGuardar,
                  trackName: form.titulo,
                  artistName: form.artista,
                  artworkUrl100: imagenFinal,
                  previewUrl: "",
                });
                localStorage.setItem("favoritos", JSON.stringify(favs));

                mostrarAlerta("Movida a Mis Favoritos", "success");
                cargarPlaylistGlobal();
                mostrarFavoritos();
              },
            });
          }
        }

        // CASO 2: GUARDADO NORMAL
        else {
          if (form.destino === "playlist") {
            const method = esEdicion ? "PUT" : "POST";
            const url = esEdicion
              ? `/api/playlist/${datos.id}`
              : "/api/playlist";

            $.ajax({
              url: url,
              type: method,
              contentType: "application/json",
              data: JSON.stringify({
                track_id: trackIdFinal,
                track_name: form.titulo,
                artist_name: form.artista,
                artwork_url: imagenFinal,
                preview_url: "",
              }),
              success: () => {
                mostrarAlerta(
                  esEdicion ? "Actualizada en Playlist" : "Creada en Playlist",
                  "success"
                );
                cargarPlaylistGlobal();
              },
            });
          } else {
            // Lógica LocalStorage
            let favs = obtenerFavoritosStorage();

            if (esEdicion) {
              const index = favs.findIndex(
                (f) => String(f.trackId || f.track_id) === String(trackIdFinal)
              );
              if (index !== -1) {
                favs[index].trackName = form.titulo;
                favs[index].artistName = form.artista;
                favs[index].artworkUrl100 = imagenFinal;
              }
            } else {
              favs.push({
                trackId: trackIdFinal,
                trackName: form.titulo,
                artistName: form.artista,
                artworkUrl100: imagenFinal,
                previewUrl: "",
              });
            }

            localStorage.setItem("favoritos", JSON.stringify(favs));
            mostrarAlerta(
              esEdicion ? "Actualizada en Favoritos" : "Creada en Favoritos",
              "success"
            );
            mostrarFavoritos();
          }
        }
      }
    });
  };

  // --- LÓGICA DE BÚSQUEDA ---
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

    $resultados.hide().html(htmlAcumulado).fadeIn(400);

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

  // --- LÓGICA DE PLAYLIST ---
  const cargarPlaylistGlobal = () => {
    $.get("/api/playlist", (datos) => {
      $playlist.empty();
      if (datos.length === 0) {
        $playlist.append("<small>La playlist está vacía.</small>");
        return;
      }

      $.each(datos, function (i, item) {
        const imagenHD = item.artwork_url.replace("100x100bb", "600x600bb");

        // Logica boton editar
        const esManual = String(item.track_id).startsWith("manual_");
        let botonEditarHTML = "";

        if (esManual) {
          const dataParaEditar = {
            id: item.id,
            track_id: item.track_id,
            track_name: item.track_name,
            artist_name: item.artist_name,
            artwork_url: item.artwork_url,
            origen: "playlist",
          };
          const dataJson = encodeURIComponent(JSON.stringify(dataParaEditar));

          botonEditarHTML = `
            <button class="btn-editar-playlist btn-playlist" data-json="${dataJson}" title="Editar" style="width:25px; height:25px; font-size:12px;">
              <i class="fa-solid fa-pen"></i>
            </button>
          `;
        }

        // Logica audio
        let audioHTML = "";
        if (item.preview_url && item.preview_url !== "") {
          audioHTML = `<audio controls src="${item.preview_url}"></audio>`;
        } else {
          audioHTML = `<span class="sin-preview">Sin previsualización</span>`;
        }

        const html = `
        <div class="tarjeta-cancion-horizontal">
            <img src="${imagenHD}" class="portada">
            <div class="info-cancion">
              <div><b>${item.track_name}</b><small>${
          item.artist_name
        }</small></div>
              ${audioHTML}
              ${crearEstrellas(item.track_id)}
            </div>
            
            <div style="display:flex; flex-direction:column; gap:5px;">
              ${botonEditarHTML}
              <button class="btn-eliminar-playlist btn-eliminar" data-db-id="${
                item.id
              }" title="Eliminar">
                <i class="fa-solid fa-xmark"></i>
              </button>
            </div>
          </div>
        `;
        $playlist.append(html);
        cargarCalificacion(item.track_id);
      });
    });
  };

  // --- LÓGICA DE FAVORITOS ---
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
      const trackName = item.trackName || item.track_name;
      const artistName = item.artistName || item.artist_name;
      const trackId = item.trackId || item.track_id;
      const previewUrl = item.previewUrl;

      const urlImg =
        item.artworkUrl100 ||
        item.artworkUrl ||
        "https://cdn-icons-png.flaticon.com/512/461/461238.png";
      const imagenHD = urlImg.replace("100x100bb", "600x600bb");

      let audioHTML = "";
      if (previewUrl && previewUrl !== "") {
        audioHTML = `<audio controls src="${previewUrl}"></audio>`;
      } else {
        audioHTML = `<span class="sin-preview">Sin previsualización</span>`;
      }

      const esManual = String(trackId).startsWith("manual_");
      let botonEditarHTML = "";

      if (esManual) {
        const dataParaEditar = {
          id: trackId,
          track_name: trackName,
          artist_name: artistName,
          artwork_url: urlImg,
          origen: "favoritos",
        };
        const dataJson = encodeURIComponent(JSON.stringify(dataParaEditar));

        botonEditarHTML = `
          <button class="btn-editar-favorito btn-playlist" data-json="${dataJson}" title="Editar" style="width:25px; height:25px; font-size:12px;">
            <i class="fa-solid fa-pen"></i>
          </button>
        `;
      }

      const html = `
      <div class="tarjeta-cancion-horizontal">
        <img src="${imagenHD}" class="portada">
        <div class="info-cancion">
          <div><b>${trackName}</b><small>${artistName}</small></div>
          ${audioHTML}
        </div>
        
        <div style="display:flex; flex-direction:column; gap:5px;">
            ${botonEditarHTML}
            <button class="btn-eliminar-favorito btn-eliminar" data-id="${trackId}">
                <i class="fa-solid fa-xmark"></i>
            </button>
        </div>
      </div>
      `;
      $favoritos.append(html);
    });
  };

  // --- LÓGICA DE CALIFICACIONES ---
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

  // --- EVENTOS ---
  // 1. Crear Manual
  $("#btn-crear-manual").on("click", function () {
    mostrarFormulario("crear");
  });

  // 2. Editar Playlist
  $playlist.on("click", ".btn-editar-playlist", function () {
    const dataString = decodeURIComponent($(this).data("json"));
    const data = JSON.parse(dataString);
    mostrarFormulario("editar", data);
  });

  // 3. Editar Favoritos
  $favoritos.on("click", ".btn-editar-favorito", function () {
    const dataString = decodeURIComponent($(this).data("json"));
    const data = JSON.parse(dataString);
    mostrarFormulario("editar", data);
  });

  // Buscador
  let tiempoEspera;
  $("#buscar").on("keyup", function () {
    const texto = $(this).val();
    clearTimeout(tiempoEspera);

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

  // Agregar a playlist (Desde resultados)
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

  // Eliminar de playlist
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

  // Toggle Favoritos (Desde resultados)
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

  // Eliminar desde favoritos
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

  // Calificar
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

  // Botón flotante nube
  $("#cloud-toggle-btn").on("click", function () {
    const $menu = $("#cloud-content");
    const $btn = $(this);

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
