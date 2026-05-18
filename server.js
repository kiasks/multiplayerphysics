// Importamos los módulos necesarios
const http = require('http');
const { WebSocketServer } = require('ws');
const WebSocket = require('ws'); // Necesario para validar WebSocket.OPEN en el broadcast

// 1. Creamos el servidor HTTP nativo requerido por hostings como Render
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('¡Servidor de HTMLPHYSICS corriendo en la nube perfectamente!');
});

// 2. Conectamos el servidor de WebSockets al servidor HTTP que creamos arriba
const wss = new WebSocketServer({ server });

// Usamos el puerto dinámico asignado por Render o el 8080 de forma local si estás en tu PC
const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
    console.log(`Servidor WebSocket corriendo mundialmente en el puerto ${PORT}... ¡Listo para los jugadores!`);
});

const clientes = {}; 

wss.on('connection', (ws) => {
    const idUnico = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Registramos al jugador con su posición inicial
    clientes[idUnico] = {
        ws: ws,
        nombre: "Invitado",
        pos: { x: 0, y: 5, z: 0 }
    };

    ws.send(JSON.stringify({ type: 'init', id: idUnico }));

    // Sincronizar rivales existentes
    Object.keys(clientes).forEach((idRival) => {
        if (idRival !== idUnico) {
            ws.send(JSON.stringify({
                type: 'render_rival',
                id: idRival,
                nombre: clientes[idRival].nombre,
                pos: clientes[idRival].pos
            }));
        }
    });

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);

            switch (data.type) {
                case 'registro_nombre':
                    if (clientes[idUnico]) {
                        clientes[idUnico].nombre = data.nombre;
                        broadcast({
                            type: 'render_rival',
                            id: idUnico,
                            nombre: data.nombre,
                            pos: clientes[idUnico].pos
                        }, idUnico);
                    }
                    break;

                case 'mover':
                    if (clientes[idUnico]) {
                        clientes[idUnico].pos = data.pos;
                        // Transmitimos el movimiento para que los clientes actualicen sus físicas locales
                        broadcast({
                            type: 'render_rival',
                            id: idUnico,
                            nombre: clientes[idUnico].nombre,
                            pos: data.pos
                        }, idUnico);
                    }
                    break;

                case 'chat_mensaje':
                    broadcast({ type: 'chat_mensaje', nombre: data.nombre, texto: data.texto });
                    break;

                case 'spawn_objeto':
                    broadcast({
                        type: 'spawn_rival',
                        id: idUnico,
                        objType: data.objType,
                        pos: data.pos,
                        dir: data.dir,
                        shoot: data.shoot
                    }, idUnico);
                    break;

                case 'activar_ts':
                    broadcast({
                        type: 'ts_global_activado',
                        activadoPor: idUnico,
                        nombreActivador: clientes[idUnico]?.nombre || "Alguien",
                        duracionMax: data.duracionMax
                    });
                    break;

                case 'desactivar_ts':
                    broadcast({ type: 'ts_global_desactivado' });
                    break;
            }
        } catch (e) {
            console.error(e);
        }
    });

    ws.on('close', () => {
        delete clientes[idUnico];
        broadcast({ type: 'desconexion', id: idUnico });
    });
});

function broadcast(data, excluirId = null) {
    const paquete = JSON.stringify(data);
    Object.keys(clientes).forEach((id) => {
        if (id !== excluirId && clientes[id].ws.readyState === WebSocket.OPEN) {
            clientes[id].ws.send(paquete);
        }
    });
}
