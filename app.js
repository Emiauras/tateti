'use strict';

const X = 'X';
const O = 'O';
const FICHAS_POR_JUGADOR = 3;


const LINEAS = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8], 
  [0, 3, 6], [1, 4, 7], [2, 5, 8], 
  [0, 4, 8], [2, 4, 6],            
];


const VECINOS = {
  0: [1, 3, 4],
  1: [0, 2, 4],
  2: [1, 5, 4],
  3: [0, 6, 4],
  4: [0, 1, 2, 3, 5, 6, 7, 8],
  5: [2, 8, 4],
  6: [3, 7, 4],
  7: [6, 8, 4],
  8: [7, 5, 4],
};

const contraria = (ficha) => (ficha === X ? O : X);

class JugadaInvalida extends Error {}

class JuegoTateti {
  constructor() {
    this.reiniciar();
  }

  reiniciar() {
    this.celdas = Array(9).fill(null);
    this.turno = X;
    this.colocadas = { [X]: 0, [O]: 0 };
    this.ganador = null;
    this.lineaGanadora = null;
    this.empate = false;
    this.turnoSaltado = null; 
  }

  get fase() {
    const faltan = this.colocadas[X] < FICHAS_POR_JUGADOR || this.colocadas[O] < FICHAS_POR_JUGADOR;
    return faltan ? 'colocacion' : 'movimiento';
  }

  get terminado() {
    return this.ganador !== null || this.empate;
  }

  sinColocar(jugador) {
    return FICHAS_POR_JUGADOR - this.colocadas[jugador];
  }

  destinosDesde(pos) {
    if (this.fase !== 'movimiento' || this.celdas[pos] !== this.turno) return [];
    return VECINOS[pos].filter((p) => this.celdas[p] === null);
  }

  puedeMover(jugador) {
    return this.celdas.some(
      (c, i) => c === jugador && VECINOS[i].some((p) => this.celdas[p] === null)
    );
  }

  colocar(pos) {
    this.#validarPartidaEnCurso();
    if (this.fase !== 'colocacion') {
      throw new JugadaInvalida('Ya están todas las fichas: ahora hay que moverlas.');
    }
    if (this.celdas[pos] !== null) {
      throw new JugadaInvalida('Ese punto ya está ocupado.');
    }
    this.celdas[pos] = this.turno;
    this.colocadas[this.turno]++;
    this.#terminarTurno();
  }

  mover(desde, hasta) {
    this.#validarPartidaEnCurso();
    if (this.fase !== 'movimiento') {
      throw new JugadaInvalida('Todavía hay fichas por colocar.');
    }
    if (this.celdas[desde] !== this.turno) {
      throw new JugadaInvalida(`Tenés que mover una ficha ${this.turno}.`);
    }
    if (!this.destinosDesde(desde).includes(hasta)) {
      throw new JugadaInvalida('Solo podés moverla a un punto vecino libre.');
    }
    this.celdas[desde] = null;
    this.celdas[hasta] = this.turno;
    this.#terminarTurno();
  }

  
  estado() {
    return {
      celdas: [...this.celdas],
      turno: this.turno,
      fase: this.fase,
      ganador: this.ganador,
      lineaGanadora: this.lineaGanadora,
      empate: this.empate,
      turnoSaltado: this.turnoSaltado,
      sinColocar: { [X]: this.sinColocar(X), [O]: this.sinColocar(O) },
    };
  }

  #validarPartidaEnCurso() {
    if (this.terminado) throw new JugadaInvalida('La partida terminó.');
  }

  #terminarTurno() {
    this.turnoSaltado = null;

    const linea = LINEAS.find(
      ([a, b, c]) => this.celdas[a] && this.celdas[a] === this.celdas[b] && this.celdas[a] === this.celdas[c]
    );
    if (linea) {
      this.ganador = this.celdas[linea[0]];
      this.lineaGanadora = linea;
      return;
    }

    this.turno = contraria(this.turno);

    // Si el jugador de turno quedó bloqueado, pierde el turno; si los dos lo están, es empate
    if (this.fase === 'movimiento' && !this.puedeMover(this.turno)) {
      if (this.puedeMover(contraria(this.turno))) {
        this.turnoSaltado = this.turno;
        this.turno = contraria(this.turno);
      } else {
        this.empate = true;
      }
    }
  }
}



class VistaTablero {
  #puntos = [];

  constructor({ tablero, estado, reservas, jugadores, botonReiniciar }) {
    this.tablero = tablero;
    this.estadoEl = estado;
    this.reservas = reservas;
    this.jugadores = jugadores;
    this.botonReiniciar = botonReiniciar;
    this.alTocarPunto = () => {};
    this.alReiniciar = () => {};

    for (let i = 0; i < 9; i++) {
      const punto = document.createElement('button');
      punto.type = 'button';
      punto.className = 'punto';
      punto.addEventListener('click', () => this.alTocarPunto(i));
      this.tablero.appendChild(punto);
      this.#puntos.push(punto);
    }
    this.botonReiniciar.addEventListener('click', () => this.alReiniciar());
  }

  render(estado, { seleccion = null, destinos = [], mensaje = '' } = {}) {
    const terminado = estado.ganador !== null || estado.empate;

    this.#puntos.forEach((punto, i) => {
      const ficha = estado.celdas[i];
      punto.textContent = ficha ?? '';
      punto.className = 'punto';
      if (ficha) punto.classList.add(`ficha-${ficha.toLowerCase()}`);
      if (i === seleccion) punto.classList.add('seleccionada');
      if (destinos.includes(i)) punto.classList.add('destino');
      if (estado.lineaGanadora?.includes(i)) punto.classList.add('ganadora');
      punto.disabled = terminado;
      punto.setAttribute('aria-label', this.#describirPunto(i, ficha));
    });

    for (const jugador of [X, O]) {
      const reserva = this.reservas[jugador];
      reserva.replaceChildren(
        ...Array.from({ length: estado.sinColocar[jugador] }, () => {
          const f = document.createElement('span');
          f.className = `mini mini-${jugador.toLowerCase()}`;
          return f;
        })
      );
      this.jugadores[jugador].classList.toggle('activo', !terminado && estado.turno === jugador);
    }

    this.estadoEl.textContent = mensaje || this.#textoEstado(estado, seleccion);
    this.estadoEl.classList.toggle('final', terminado);
  }

  #textoEstado(estado, seleccion) {
    if (estado.ganador) return `¡Ganó ${estado.ganador}!`;
    if (estado.empate) return 'Empate: nadie puede mover.';

    const aviso = estado.turnoSaltado ? `${estado.turnoSaltado} no puede mover, pasa el turno. ` : '';
    if (estado.fase === 'colocacion') {
      const quedan = estado.sinColocar[estado.turno];
      return `${aviso}Turno de ${estado.turno}: colocá una ficha (te ${quedan === 1 ? 'queda 1' : `quedan ${quedan}`}).`;
    }
    if (seleccion !== null) return `${aviso}Turno de ${estado.turno}: elegí a dónde moverla.`;
    return `${aviso}Turno de ${estado.turno}: elegí una ficha para mover.`;
  }

  #describirPunto(i, ficha) {
    const fila = Math.floor(i / 3) + 1;
    const columna = (i % 3) + 1;
    return `Fila ${fila}, columna ${columna}: ${ficha ?? 'vacío'}`;
  }
}



class Controlador {
  #seleccion = null;

  constructor(juego, vista) {
    this.juego = juego;
    this.vista = vista;
    vista.alTocarPunto = (pos) => this.#tocarPunto(pos);
    vista.alReiniciar = () => this.#reiniciar();
    this.#actualizar();
  }

  #tocarPunto(pos) {
    if (this.juego.terminado) return;
    try {
      if (this.juego.fase === 'colocacion') {
        this.juego.colocar(pos);
        this.#actualizar();
      } else {
        this.#tocarEnMovimiento(pos);
      }
    } catch (error) {
      if (!(error instanceof JugadaInvalida)) throw error;
      this.#actualizar(error.message);
    }
  }

  #tocarEnMovimiento(pos) {
    const ficha = this.juego.celdas[pos];
    const turno = this.juego.turno;

    
    if (pos === this.#seleccion) {
      this.#seleccion = null;
      return this.#actualizar();
    }

    
    if (ficha === turno) {
      if (this.juego.destinosDesde(pos).length === 0) {
        return this.#actualizar('Esa ficha no tiene lugar para moverse. Elegí otra.');
      }
      this.#seleccion = pos;
      return this.#actualizar();
    }

    if (this.#seleccion === null) {
      const msg = ficha ? `Esa ficha es de ${ficha}. Elegí una ${turno}.` : `Primero elegí una de tus fichas (${turno}).`;
      return this.#actualizar(msg);
    }

    this.juego.mover(this.#seleccion, pos); 
    this.#seleccion = null;
    this.#actualizar();
  }

  #reiniciar() {
    this.juego.reiniciar();
    this.#seleccion = null;
    this.#actualizar();
  }

  #actualizar(mensaje = '') {
    const destinos = this.#seleccion === null ? [] : this.juego.destinosDesde(this.#seleccion);
    this.vista.render(this.juego.estado(), { seleccion: this.#seleccion, destinos, mensaje });
  }
}



if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    const vista = new VistaTablero({
      tablero: document.getElementById('tablero'),
      estado: document.getElementById('estado'),
      reservas: { [X]: document.getElementById('reserva-X'), [O]: document.getElementById('reserva-O') },
      jugadores: { [X]: document.getElementById('jugador-X'), [O]: document.getElementById('jugador-O') },
      botonReiniciar: document.getElementById('reiniciar'),
    });
    new Controlador(new JuegoTateti(), vista);
  });
}